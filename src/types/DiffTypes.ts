export type DiffLineType = "added" | "removed" | "unchanged";

export interface DiffLine {
  type: DiffLineType;
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  totalChanges: number;
  message: string;
}

export interface DiffResult {
  summary: DiffSummary;
  hunks: DiffHunk[];
  truncated: boolean;
}
