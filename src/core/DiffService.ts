import { diffLines } from "diff";
import type { DiffHunk, DiffLine, DiffResult, DiffSummary } from "../types/DiffTypes";
import { normalizeLineEndings, splitLines } from "../utils/fileUtils";

export interface DiffOptions {
  maxChanges?: number;
  contextLines?: number;
}

const DEFAULT_MAX_CHANGES = 120;
const DEFAULT_CONTEXT_LINES = 2;

export class DiffService {
  diff(oldContent: string, newContent: string, options: DiffOptions = {}): DiffResult {
    const normalizedOld = normalizeLineEndings(oldContent);
    const normalizedNew = normalizeLineEndings(newContent);

    if (normalizedOld === normalizedNew) {
      return this.emptyResult("No line changes detected.");
    }

    const maxChanges = options.maxChanges ?? DEFAULT_MAX_CHANGES;
    const contextLines = options.contextLines ?? DEFAULT_CONTEXT_LINES;
    const parts = diffLines(normalizedOld, normalizedNew, { newlineIsToken: false });

    let oldLine = 1;
    let newLine = 1;
    let current: DiffLine[] = [];
    let oldStart = 1;
    let newStart = 1;
    let leadingContext: DiffLine[] = [];
    const hunks: DiffHunk[] = [];
    let added = 0;
    let removed = 0;
    let unchanged = 0;
    let visibleChanges = 0;
    let truncated = false;

    const flush = () => {
      if (current.length === 0) {
        return;
      }
      const oldLines = current.filter((line) => line.type !== "added").length;
      const newLines = current.filter((line) => line.type !== "removed").length;
      hunks.push({ oldStart, oldLines, newStart, newLines, lines: current });
      current = [];
    };

    for (const part of parts) {
      const lines = splitLines(part.value);
      if (part.added) {
        if (current.length === 0) {
          oldStart = oldLine;
          newStart = newLine;
          current.push(...leadingContext);
        }
        for (const content of lines) {
          if (visibleChanges >= maxChanges) {
            truncated = true;
            newLine++;
            added++;
            continue;
          }
          current.push({ type: "added", newLineNumber: newLine, content });
          newLine++;
          added++;
          visibleChanges++;
        }
        leadingContext = [];
        continue;
      }

      if (part.removed) {
        if (current.length === 0) {
          oldStart = oldLine;
          newStart = newLine;
          current.push(...leadingContext);
        }
        for (const content of lines) {
          if (visibleChanges >= maxChanges) {
            truncated = true;
            oldLine++;
            removed++;
            continue;
          }
          current.push({ type: "removed", oldLineNumber: oldLine, content });
          oldLine++;
          removed++;
          visibleChanges++;
        }
        leadingContext = [];
        continue;
      }

      unchanged += lines.length;
      if (current.length > 0) {
        const context = lines.slice(0, contextLines);
        for (const content of context) {
          current.push({ type: "unchanged", oldLineNumber: oldLine, newLineNumber: newLine, content });
          oldLine++;
          newLine++;
        }
        flush();

        const remaining = lines.slice(context.length);
        if (remaining.length > contextLines) {
          oldLine += remaining.length - contextLines;
          newLine += remaining.length - contextLines;
          leadingContext = remaining.slice(-contextLines).map((content, index) => ({
            type: "unchanged",
            oldLineNumber: oldLine + index,
            newLineNumber: newLine + index,
            content
          }));
          oldLine += contextLines;
          newLine += contextLines;
        } else {
          leadingContext = remaining.map((content, index) => ({
            type: "unchanged",
            oldLineNumber: oldLine + index,
            newLineNumber: newLine + index,
            content
          }));
          oldLine += remaining.length;
          newLine += remaining.length;
        }
      } else {
        if (lines.length > contextLines) {
          oldLine += lines.length - contextLines;
          newLine += lines.length - contextLines;
          leadingContext = lines.slice(-contextLines).map((content, index) => ({
            type: "unchanged",
            oldLineNumber: oldLine + index,
            newLineNumber: newLine + index,
            content
          }));
          oldLine += contextLines;
          newLine += contextLines;
        } else {
          leadingContext = lines.map((content, index) => ({
            type: "unchanged",
            oldLineNumber: oldLine + index,
            newLineNumber: newLine + index,
            content
          }));
          oldLine += lines.length;
          newLine += lines.length;
        }
      }
    }

    flush();

    const modified = this.countModifiedPairs(hunks);
    const summary: DiffSummary = {
      added,
      removed,
      modified,
      unchanged,
      totalChanges: added + removed,
      message: this.buildSummaryMessage(added, removed, modified, truncated, maxChanges)
    };

    return { summary, hunks, truncated };
  }

  diffCreated(content: string, showContent: boolean, options?: DiffOptions): DiffResult {
    return showContent ? this.diff("", content, options) : this.summaryOnly("File created.");
  }

  diffDeleted(content: string, showContent: boolean, options?: DiffOptions): DiffResult {
    return showContent ? this.diff(content, "", options) : this.summaryOnly("File deleted.");
  }

  private emptyResult(message: string): DiffResult {
    return {
      summary: { added: 0, removed: 0, modified: 0, unchanged: 0, totalChanges: 0, message },
      hunks: [],
      truncated: false
    };
  }

  private summaryOnly(message: string): DiffResult {
    return {
      summary: { added: 0, removed: 0, modified: 0, unchanged: 0, totalChanges: 0, message },
      hunks: [],
      truncated: false
    };
  }

  private countModifiedPairs(hunks: DiffHunk[]): number {
    let modified = 0;
    for (const hunk of hunks) {
      for (let index = 0; index < hunk.lines.length - 1; index++) {
        if (hunk.lines[index].type === "removed" && hunk.lines[index + 1].type === "added") {
          modified++;
        }
      }
    }
    return modified;
  }

  private buildSummaryMessage(added: number, removed: number, modified: number, truncated: boolean, maxChanges: number): string {
    const parts = [
      added > 0 ? `${added} added` : "",
      removed > 0 ? `${removed} removed` : "",
      modified > 0 ? `${modified} modified` : ""
    ].filter(Boolean);
    const base = parts.length > 0 ? parts.join(", ") : "No line changes detected";
    return truncated ? `${base}. Large file change detected. Showing first ${maxChanges} changes.` : base;
  }
}
