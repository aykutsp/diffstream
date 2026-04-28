using System;
using System.Collections.Concurrent;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using EnvDTE;

namespace DiffStream.VisualStudio.Core
{
    public sealed class DiffStreamController : IDisposable
    {
        private const long MaxFileSizeBytes = 1024 * 1024;
        private readonly DTE? dte;
        private readonly SnapshotStore snapshots = new SnapshotStore();
        private readonly DiffService diffService = new DiffService();
        private readonly IgnoreService ignoreService = new IgnoreService();
        private readonly BinaryFileDetector binaryDetector = new BinaryFileDetector();
        private readonly ConcurrentDictionary<string, Timer> debounceTimers = new ConcurrentDictionary<string, Timer>(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, string> lastSignatures = new ConcurrentDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private string? workspaceRoot;
        private FileSystemWatcher? watcher;
        private bool running;
        private bool paused;

        public DiffStreamController(DTE? dte)
        {
            this.dte = dte;
            FeedStore = new FeedStore(Application.Current?.Dispatcher ?? System.Windows.Threading.Dispatcher.CurrentDispatcher);
        }

        public FeedStore FeedStore { get; }

        public void Start()
        {
            Microsoft.VisualStudio.Shell.ThreadHelper.ThrowIfNotOnUIThread();
            if (running)
            {
                return;
            }

            var root = workspaceRoot = GetWorkspaceRoot();
            if (string.IsNullOrEmpty(root) || !Directory.Exists(root))
            {
                return;
            }

            running = true;
            paused = false;
            watcher = new FileSystemWatcher(root)
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size | NotifyFilters.CreationTime,
                EnableRaisingEvents = true
            };
            watcher.Created += (_, args) => Schedule(args.FullPath, ChangeEventType.Created);
            watcher.Changed += (_, args) => Schedule(args.FullPath, ChangeEventType.LocalChange);
            watcher.Deleted += (_, args) => Schedule(args.FullPath, ChangeEventType.Deleted);
            watcher.Renamed += (_, args) => ScheduleRename(args.OldFullPath, args.FullPath);

            _ = PrimeSnapshotsAsync(root);
        }

        public void Stop()
        {
            running = false;
            watcher?.Dispose();
            watcher = null;
            foreach (var timer in debounceTimers.Values)
            {
                timer.Dispose();
            }

            debounceTimers.Clear();
        }

        public void Pause() => paused = true;

        public void Resume()
        {
            if (!running)
            {
                Microsoft.VisualStudio.Shell.ThreadHelper.ThrowIfNotOnUIThread();
                Start();
            }

            paused = false;
        }

        public void ClearFeed() => FeedStore.Clear();

        public void Dispose()
        {
            Stop();
        }

        private void Schedule(string filePath, ChangeEventType type)
        {
            if (!running || paused || Directory.Exists(filePath) || ignoreService.IsIgnored(filePath))
            {
                return;
            }

            var key = NormalizePath(filePath);
            debounceTimers.AddOrUpdate(
                key,
                _ => new Timer(_ => _ = ProcessAsync(filePath, type), null, 300, Timeout.Infinite),
                (_, existing) =>
                {
                    existing.Change(300, Timeout.Infinite);
                    return existing;
                });
        }

        private void ScheduleRename(string oldPath, string newPath)
        {
            if (!running || paused || ignoreService.IsIgnored(newPath))
            {
                return;
            }

            var changeEvent = new ChangeEvent
            {
                Timestamp = DateTimeOffset.Now,
                FilePath = newPath,
                RelativePath = RelativePath(newPath),
                Type = ChangeEventType.Renamed,
                Summary = new DiffSummary { Message = $"File renamed from {RelativePath(oldPath)} to {RelativePath(newPath)}." }
            };
            snapshots.Remove(oldPath, out var oldContent);
            if (File.Exists(newPath) && oldContent != null)
            {
                snapshots.Set(newPath, oldContent);
            }

            FeedStore.Add(changeEvent);
        }

        private async Task ProcessAsync(string filePath, ChangeEventType type)
        {
            try
            {
                if (type == ChangeEventType.Deleted)
                {
                    snapshots.Remove(filePath, out var previous);
                    var deletedDiff = diffService.Deleted(previous ?? string.Empty, false);
                    AddEvent(filePath, ChangeEventType.Deleted, deletedDiff);
                    return;
                }

                if (!File.Exists(filePath))
                {
                    return;
                }

                var info = new FileInfo(filePath);
                if (info.Length > MaxFileSizeBytes)
                {
                    AddEvent(filePath, ChangeEventType.LocalChange, new DiffResult
                    {
                        Truncated = true,
                        Summary = new DiffSummary { Message = "Large file change detected. Diff skipped because the file exceeds the size limit." }
                    });
                    return;
                }

                if (await binaryDetector.IsBinaryAsync(filePath).ConfigureAwait(false))
                {
                    return;
                }

                var current = await ReadAllTextSharedAsync(filePath).ConfigureAwait(false);
                var hadPrevious = snapshots.TryGet(filePath, out var previousContent);
                snapshots.Set(filePath, current);

                DiffResult diff;
                if (type == ChangeEventType.Created || !hadPrevious)
                {
                    diff = diffService.Created(current, true);
                    type = ChangeEventType.Created;
                }
                else
                {
                    diff = diffService.Diff(previousContent, current);
                }

                if (diff.Summary.TotalChanges == 0 && !diff.Truncated && type != ChangeEventType.Created)
                {
                    return;
                }

                AddEvent(filePath, type, diff);
            }
            catch
            {
                // File watcher events can race with writers and deletes. Dropping one noisy event is safer than blocking the IDE.
            }
        }

        private void AddEvent(string filePath, ChangeEventType type, DiffResult diff)
        {
            var changeEvent = new ChangeEvent
            {
                Timestamp = DateTimeOffset.Now,
                FilePath = filePath,
                RelativePath = RelativePath(filePath),
                Type = type,
                Summary = diff.Summary,
                Truncated = diff.Truncated
            };
            changeEvent.Hunks.AddRange(diff.Hunks);

            var signature = $"{changeEvent.Type}|{changeEvent.RelativePath}|{changeEvent.Summary.Message}";
            if (lastSignatures.TryGetValue(filePath, out var previousSignature) && previousSignature == signature)
            {
                return;
            }

            lastSignatures[filePath] = signature;
            FeedStore.Add(changeEvent);
        }

        private async Task PrimeSnapshotsAsync(string root)
        {
            await Task.Run(async () =>
            {
                foreach (var file in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
                {
                    if (ignoreService.IsIgnored(file))
                    {
                        continue;
                    }

                    try
                    {
                        var info = new FileInfo(file);
                        if (info.Length > MaxFileSizeBytes || await binaryDetector.IsBinaryAsync(file).ConfigureAwait(false))
                        {
                            continue;
                        }

                        snapshots.Set(file, await ReadAllTextSharedAsync(file).ConfigureAwait(false));
                    }
                    catch
                    {
                        // Snapshot priming is opportunistic.
                    }
                }
            }).ConfigureAwait(false);
        }

        private string? GetWorkspaceRoot()
        {
            Microsoft.VisualStudio.Shell.ThreadHelper.ThrowIfNotOnUIThread();
            var solutionPath = dte?.Solution?.FullName;
            if (!string.IsNullOrEmpty(solutionPath))
            {
                return Path.GetDirectoryName(solutionPath);
            }

            return null;
        }

        private string RelativePath(string filePath)
        {
            var root = workspaceRoot ?? string.Empty;

            if (string.IsNullOrEmpty(root))
            {
                return Path.GetFileName(filePath);
            }

            var rootUri = new Uri(AppendDirectorySeparator(root));
            var fileUri = new Uri(filePath);
            return Uri.UnescapeDataString(rootUri.MakeRelativeUri(fileUri).ToString()).Replace('/', Path.DirectorySeparatorChar);
        }

        private static string AppendDirectorySeparator(string path)
        {
            return path.EndsWith(Path.DirectorySeparatorChar.ToString(), StringComparison.Ordinal) ? path : path + Path.DirectorySeparatorChar;
        }

        private static string NormalizePath(string filePath) => filePath.Replace('\\', '/');

        private static async Task<string> ReadAllTextSharedAsync(string filePath)
        {
            using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete, 4096, true))
            using (var reader = new StreamReader(stream))
            {
                return await reader.ReadToEndAsync().ConfigureAwait(false);
            }
        }
    }
}
