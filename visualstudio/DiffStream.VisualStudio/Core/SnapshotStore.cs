using System.Collections.Concurrent;

namespace DiffStream.VisualStudio.Core
{
    public sealed class SnapshotStore
    {
        private readonly ConcurrentDictionary<string, string> snapshots = new ConcurrentDictionary<string, string>();

        public bool TryGet(string filePath, out string content)
        {
            return snapshots.TryGetValue(NormalizePath(filePath), out content!);
        }

        public void Set(string filePath, string content)
        {
            snapshots[NormalizePath(filePath)] = NormalizeLineEndings(content);
        }

        public bool Remove(string filePath, out string content)
        {
            return snapshots.TryRemove(NormalizePath(filePath), out content!);
        }

        private static string NormalizePath(string filePath) => filePath.Replace('\\', '/');

        private static string NormalizeLineEndings(string content) => content.Replace("\r\n", "\n").Replace("\r", "\n");
    }
}
