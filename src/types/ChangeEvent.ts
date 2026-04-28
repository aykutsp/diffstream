import type { DiffHunk, DiffSummary } from "./DiffTypes";

export type ChangeEventType = "created" | "deleted" | "modified" | "saved" | "external-change" | "renamed";
export type ChangeSource = "vscode-save" | "filesystem-watcher" | "initial-snapshot" | "unknown";

export interface ChangeEvent {
  id: string;
  timestamp: number;
  workspaceFolder: string;
  filePath: string;
  relativePath: string;
  type: ChangeEventType;
  diffSummary: DiffSummary;
  hunks: DiffHunk[];
  truncated: boolean;
  source: ChangeSource;
}
