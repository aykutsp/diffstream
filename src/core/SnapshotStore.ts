import type * as vscode from "vscode";
import { normalizeLineEndings } from "../utils/fileUtils";
import { uriKey } from "../utils/pathUtils";

export interface Snapshot {
  content: string;
  version: number;
  updatedAt: number;
}

export class SnapshotStore {
  private readonly snapshots = new Map<string, Snapshot>();

  get(uri: vscode.Uri): Snapshot | undefined {
    return this.snapshots.get(uriKey(uri));
  }

  getContent(uri: vscode.Uri): string | undefined {
    return this.get(uri)?.content;
  }

  set(uri: vscode.Uri, content: string): Snapshot {
    const key = uriKey(uri);
    const previous = this.snapshots.get(key);
    const snapshot: Snapshot = {
      content: normalizeLineEndings(content),
      version: (previous?.version ?? 0) + 1,
      updatedAt: Date.now()
    };
    this.snapshots.set(key, snapshot);
    return snapshot;
  }

  delete(uri: vscode.Uri): Snapshot | undefined {
    const key = uriKey(uri);
    const previous = this.snapshots.get(key);
    this.snapshots.delete(key);
    return previous;
  }

  has(uri: vscode.Uri): boolean {
    return this.snapshots.has(uriKey(uri));
  }

  clear(): void {
    this.snapshots.clear();
  }

  size(): number {
    return this.snapshots.size;
  }
}
