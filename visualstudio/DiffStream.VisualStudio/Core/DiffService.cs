using System;
using System.Collections.Generic;
using System.Linq;

namespace DiffStream.VisualStudio.Core
{
    public sealed class DiffService
    {
        private const int MaxVisibleChanges = 120;

        public DiffResult Diff(string oldContent, string newContent)
        {
            oldContent = Normalize(oldContent);
            newContent = Normalize(newContent);
            if (oldContent == newContent)
            {
                return SummaryOnly("No line changes detected.");
            }

            var oldLines = Split(oldContent);
            var newLines = Split(newContent);
            var operations = BuildOperations(oldLines, newLines);
            var result = new DiffResult();
            var hunk = new DiffHunk { OldStart = 1, NewStart = 1 };
            var oldLine = 1;
            var newLine = 1;
            var visibleChanges = 0;

            foreach (var operation in operations)
            {
                if (operation.Type != DiffLineType.Unchanged)
                {
                    visibleChanges++;
                    if (visibleChanges > MaxVisibleChanges)
                    {
                        result.Truncated = true;
                        if (operation.Type == DiffLineType.Added)
                        {
                            result.Summary.Added++;
                            newLine++;
                        }
                        else
                        {
                            result.Summary.Removed++;
                            oldLine++;
                        }

                        continue;
                    }
                }

                var line = new DiffLine { Type = operation.Type, Content = operation.Content };
                if (operation.Type == DiffLineType.Added)
                {
                    line.NewLineNumber = newLine++;
                    result.Summary.Added++;
                }
                else if (operation.Type == DiffLineType.Removed)
                {
                    line.OldLineNumber = oldLine++;
                    result.Summary.Removed++;
                }
                else
                {
                    line.OldLineNumber = oldLine++;
                    line.NewLineNumber = newLine++;
                }

                hunk.Lines.Add(line);
            }

            hunk.OldLines = hunk.Lines.Count(line => line.Type != DiffLineType.Added);
            hunk.NewLines = hunk.Lines.Count(line => line.Type != DiffLineType.Removed);
            result.Hunks.Add(hunk);
            result.Summary.Modified = CountModifiedPairs(hunk.Lines);
            result.Summary.Message = BuildMessage(result.Summary, result.Truncated);
            return result;
        }

        public DiffResult Created(string content, bool showContent)
        {
            return showContent ? Diff(string.Empty, content) : SummaryOnly("File created.");
        }

        public DiffResult Deleted(string content, bool showContent)
        {
            return showContent ? Diff(content, string.Empty) : SummaryOnly("File deleted.");
        }

        private static List<DiffLine> BuildOperations(string[] oldLines, string[] newLines)
        {
            var table = new int[oldLines.Length + 1, newLines.Length + 1];
            for (var i = oldLines.Length - 1; i >= 0; i--)
            {
                for (var j = newLines.Length - 1; j >= 0; j--)
                {
                    table[i, j] = oldLines[i] == newLines[j]
                        ? table[i + 1, j + 1] + 1
                        : Math.Max(table[i + 1, j], table[i, j + 1]);
                }
            }

            var operations = new List<DiffLine>();
            var oldIndex = 0;
            var newIndex = 0;
            while (oldIndex < oldLines.Length && newIndex < newLines.Length)
            {
                if (oldLines[oldIndex] == newLines[newIndex])
                {
                    operations.Add(new DiffLine { Type = DiffLineType.Unchanged, Content = oldLines[oldIndex] });
                    oldIndex++;
                    newIndex++;
                }
                else if (table[oldIndex + 1, newIndex] >= table[oldIndex, newIndex + 1])
                {
                    operations.Add(new DiffLine { Type = DiffLineType.Removed, Content = oldLines[oldIndex++] });
                }
                else
                {
                    operations.Add(new DiffLine { Type = DiffLineType.Added, Content = newLines[newIndex++] });
                }
            }

            while (oldIndex < oldLines.Length)
            {
                operations.Add(new DiffLine { Type = DiffLineType.Removed, Content = oldLines[oldIndex++] });
            }

            while (newIndex < newLines.Length)
            {
                operations.Add(new DiffLine { Type = DiffLineType.Added, Content = newLines[newIndex++] });
            }

            return operations;
        }

        private static DiffResult SummaryOnly(string message)
        {
            return new DiffResult { Summary = new DiffSummary { Message = message } };
        }

        private static string Normalize(string content) => content.Replace("\r\n", "\n").Replace("\r", "\n");

        private static string[] Split(string content)
        {
            if (string.IsNullOrEmpty(content))
            {
                return Array.Empty<string>();
            }

            return Normalize(content).TrimEnd('\n').Split('\n');
        }

        private static int CountModifiedPairs(IEnumerable<DiffLine> lines)
        {
            var list = lines.ToList();
            var count = 0;
            for (var i = 0; i < list.Count - 1; i++)
            {
                if (list[i].Type == DiffLineType.Removed && list[i + 1].Type == DiffLineType.Added)
                {
                    count++;
                }
            }

            return count;
        }

        private static string BuildMessage(DiffSummary summary, bool truncated)
        {
            var parts = new List<string>();
            if (summary.Added > 0) parts.Add($"{summary.Added} added");
            if (summary.Removed > 0) parts.Add($"{summary.Removed} removed");
            if (summary.Modified > 0) parts.Add($"{summary.Modified} modified");
            var message = parts.Count == 0 ? "No line changes detected." : string.Join(", ", parts);
            return truncated ? $"{message}. Large file change detected; showing first {MaxVisibleChanges} changes." : message;
        }
    }
}
