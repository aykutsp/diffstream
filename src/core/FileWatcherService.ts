import * as vscode from "vscode";
import { BinaryFileDetector } from "./BinaryFileDetector";
import type { IgnoreService } from "./IgnoreService";
import type { SnapshotStore } from "./SnapshotStore";
import { PerKeyDebouncer } from "../utils/debounce";
import { readUriText, statUri } from "../utils/fileUtils";
import { uriKey } from "../utils/pathUtils";

export type FileChangeKind = "created" | "changed" | "deleted" | "saved";

export interface FileChangeNotification {
  uri: vscode.Uri;
  kind: FileChangeKind;
  previousContent?: string;
  currentContent?: string;
  skipped?: "ignored" | "large" | "binary" | "missing" | "read-error" | "unchanged";
  error?: unknown;
}

export interface WatcherSettings {
  debounceMs: number;
  maxFileSizeBytes: number;
}

export class FileWatcherService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly debouncer = new PerKeyDebouncer();
  private readonly emitter = new vscode.EventEmitter<FileChangeNotification>();
  private readonly binaryDetector = new BinaryFileDetector();
  private watcher?: vscode.FileSystemWatcher;
  private running = false;

  readonly onDidChange = this.emitter.event;

  constructor(
    private readonly snapshotStore: SnapshotStore,
    private readonly ignoreService: IgnoreService,
    private settings: WatcherSettings
  ) {}

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.watcher = vscode.workspace.createFileSystemWatcher("**/*", false, false, false);
    this.disposables.push(
      this.watcher.onDidCreate((uri) => this.schedule(uri, "created")),
      this.watcher.onDidChange((uri) => this.schedule(uri, "changed")),
      this.watcher.onDidDelete((uri) => this.schedule(uri, "deleted")),
      vscode.workspace.onDidSaveTextDocument((document) => this.schedule(document.uri, "saved"))
    );

    void this.primeSnapshots();
  }

  stop(): void {
    this.running = false;
    this.debouncer.dispose();
    this.watcher?.dispose();
    this.watcher = undefined;
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  updateSettings(settings: WatcherSettings): void {
    this.settings = settings;
  }

  dispose(): void {
    this.stop();
    this.emitter.dispose();
  }

  private schedule(uri: vscode.Uri, kind: FileChangeKind): void {
    if (!this.running || uri.scheme !== "file") {
      return;
    }

    const key = uriKey(uri);
    if (kind === "saved") {
      this.debouncer.cancel(key);
      void this.process(uri, kind);
      return;
    }

    this.debouncer.schedule(key, this.settings.debounceMs, () => {
      void this.process(uri, kind);
    });
  }

  private async process(uri: vscode.Uri, kind: FileChangeKind): Promise<void> {
    if (this.ignoreService.isIgnored(uri)) {
      this.emitter.fire({ uri, kind, skipped: "ignored" });
      return;
    }

    if (kind === "deleted") {
      const previous = this.snapshotStore.delete(uri);
      this.emitter.fire({ uri, kind, previousContent: previous?.content });
      return;
    }

    const stat = await statUri(uri);
    if (!stat || stat.type === vscode.FileType.Directory) {
      this.emitter.fire({ uri, kind, skipped: "missing" });
      return;
    }

    if (stat.size > this.settings.maxFileSizeBytes) {
      this.emitter.fire({ uri, kind, skipped: "large" });
      return;
    }

    try {
      if (await this.binaryDetector.isBinary(uri)) {
        this.emitter.fire({ uri, kind, skipped: "binary" });
        return;
      }

      const previousContent = this.snapshotStore.getContent(uri);
      const currentContent = await readUriText(uri);
      this.snapshotStore.set(uri, currentContent);

      if (kind !== "created" && previousContent === undefined) {
        this.emitter.fire({ uri, kind, currentContent, skipped: "unchanged" });
        return;
      }

      if (previousContent === currentContent && kind !== "saved") {
        this.emitter.fire({ uri, kind, previousContent, currentContent, skipped: "unchanged" });
        return;
      }

      this.emitter.fire({ uri, kind, previousContent, currentContent });
    } catch (error) {
      this.emitter.fire({ uri, kind, skipped: "read-error", error });
    }
  }

  private async primeSnapshots(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
      return;
    }

    const files = await vscode.workspace.findFiles("**/*", "{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/coverage/**,**/.next/**,**/.turbo/**,**/vendor/**,**/target/**,**/.idea/**}", 5000);
    await Promise.all(files.map(async (uri) => {
      if (this.ignoreService.isIgnored(uri) || this.snapshotStore.has(uri)) {
        return;
      }
      const stat = await statUri(uri);
      if (!stat || stat.type === vscode.FileType.Directory || stat.size > this.settings.maxFileSizeBytes) {
        return;
      }
      try {
        if (!(await this.binaryDetector.isBinary(uri))) {
          this.snapshotStore.set(uri, await readUriText(uri));
        }
      } catch {
        // Snapshot priming is opportunistic; live events will still be handled.
      }
    }));
  }
}
