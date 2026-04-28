using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace DiffStream.VisualStudio.Core
{
    public enum ChangeEventType
    {
        Created,
        Deleted,
        Modified,
        Saved,
        LocalChange,
        Renamed
    }

    public enum DiffLineType
    {
        Added,
        Removed,
        Unchanged
    }

    public sealed class DiffLine
    {
        public DiffLineType Type { get; set; }
        public int? OldLineNumber { get; set; }
        public int? NewLineNumber { get; set; }
        public string Content { get; set; } = string.Empty;
    }

    public sealed class DiffHunk
    {
        public int OldStart { get; set; }
        public int OldLines { get; set; }
        public int NewStart { get; set; }
        public int NewLines { get; set; }
        public List<DiffLine> Lines { get; } = new List<DiffLine>();
    }

    public sealed class DiffSummary
    {
        public int Added { get; set; }
        public int Removed { get; set; }
        public int Modified { get; set; }
        public int TotalChanges => Added + Removed;
        public string Message { get; set; } = string.Empty;
    }

    public sealed class DiffResult
    {
        public DiffSummary Summary { get; set; } = new DiffSummary();
        public List<DiffHunk> Hunks { get; } = new List<DiffHunk>();
        public bool Truncated { get; set; }
    }

    public sealed class ChangeEvent
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.Now;
        public string FilePath { get; set; } = string.Empty;
        public string RelativePath { get; set; } = string.Empty;
        public ChangeEventType Type { get; set; }
        public DiffSummary Summary { get; set; } = new DiffSummary();
        public List<DiffHunk> Hunks { get; } = new List<DiffHunk>();
        public bool Truncated { get; set; }
    }

    public sealed class ChangeEventViewModel
    {
        public ChangeEventViewModel(ChangeEvent changeEvent)
        {
            Event = changeEvent;
            foreach (var hunk in changeEvent.Hunks)
            {
                DisplayLines.Add($"@@ -{hunk.OldStart},{hunk.OldLines} +{hunk.NewStart},{hunk.NewLines} @@");
                foreach (var line in hunk.Lines)
                {
                    var prefix = line.Type == DiffLineType.Added ? "+" : line.Type == DiffLineType.Removed ? "-" : " ";
                    var number = line.Type == DiffLineType.Removed ? line.OldLineNumber : line.NewLineNumber ?? line.OldLineNumber;
                    DisplayLines.Add($"{number,4} {prefix} {line.Content}");
                }
            }
        }

        public ChangeEvent Event { get; }
        public string TimeText => Event.Timestamp.ToLocalTime().ToString("HH:mm:ss");
        public string Type => Event.Type.ToString();
        public string RelativePath => Event.RelativePath;
        public string Summary => Event.Summary.Message;
        public ObservableCollection<string> DisplayLines { get; } = new ObservableCollection<string>();
    }

    public abstract class ObservableObject : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler? PropertyChanged;

        protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
