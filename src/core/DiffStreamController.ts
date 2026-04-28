import * as crypto from "node:crypto";
import * as vscode from "vscode";
import { DiffService } from "./DiffService";
import { FileWatcherService } from "./FileWatcherService";
import { IgnoreService } from "./IgnoreService";
import { SnapshotStore } from "./SnapshotStore";
import type { FileChangeNotification } from "./FileWatcherService";
import type { FeedStore } from "./FeedStore";
import type { ChangeEvent, ChangeEventType, ChangeSource } from "../types/ChangeEvent";
import type { DiffResult } from "../types/DiffTypes";
import { readUriText } from "../utils/fileUtils";
import { relativeToWorkspace, uriKey, workspaceRootFor } from "../utils/pathUtils";

export interface DiffStreamState {
  running: boolean;
  paused: boolean;
}

export class DiffStreamController implements vscode.Disposable {
  private readonly snapshotStore = new SnapshotStore();
  private readonly diffService = new DiffService();
  private readonly ignoreService = new IgnoreService(this.loadIgnoreSettings());
  private readonly watcher: FileWatcherService;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly stateEmitter = new vscode.EventEmitter<DiffStreamState>();
  private readonly lastSignatures = new Map<string, string>();
  private readonly pendingDeletes = new Map<string, { change: FileChangeNotification; timeout: NodeJS.Timeout }>();
  private running = false;
  private paused = false;

  readonly onDidChangeState = this.stateEmitter.event;

  constructor(private readonly context: vscode.ExtensionContext, readonly feedStore: FeedStore) {
    this.watcher = new FileWatcherService(this.snapshotStore, this.ignoreService, this.loadWatcherSettings());
    this.disposables.push(
      this.watcher.onDidChange((change) => void this.handleFileChange(change)),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("diffstream")) {
          this.reloadSettings();
        }
      })
    );
  }

  async initialize(): Promise<void> {
    await this.feedStore.hydrate();
    if (this.config().get<boolean>("autoStart", true) && this.config().get<boolean>("enabled", true)) {
      this.start();
    }
  }

  start(): void {
    if (this.running || !this.config().get<boolean>("enabled", true)) {
      return;
    }
    this.running = true;
    this.paused = false;
    this.watcher.start();
    this.fireState();
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    this.paused = false;
    this.watcher.stop();
    this.fireState();
  }

  pause(): void {
    if (!this.running) {
      return;
    }
    this.paused = true;
    this.fireState();
  }

  resume(): void {
    if (!this.running) {
      this.start();
      return;
    }
    this.paused = false;
    this.fireState();
  }

  clearFeed(): void {
    this.feedStore.clear();
  }

  getState(): DiffStreamState {
    return { running: this.running, paused: this.paused };
  }

  dispose(): void {
    this.watcher.dispose();
    this.feedStore.dispose();
    this.stateEmitter.dispose();
    for (const pending of this.pendingDeletes.values()) {
      clearTimeout(pending.timeout);
    }
    this.pendingDeletes.clear();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async handleFileChange(change: FileChangeNotification): Promise<void> {
    if (change.skipped === "ignored" || change.skipped === "unchanged") {
      return;
    }

    if (this.paused) {
      return;
    }

    if (change.kind === "deleted") {
      this.queuePotentialRename(change);
      return;
    }

    if (change.kind === "created") {
      const renameEvent = this.consumePotentialRename(change);
      if (renameEvent) {
        this.emitEvent(change.uri, renameEvent);
        return;
      }
    }

    const event = await this.toChangeEvent(change);
    if (!event) {
      return;
    }

    this.emitEvent(change.uri, event);
  }

  private emitEvent(uri: vscode.Uri, event: ChangeEvent): void {
    const signature = this.signature(event);
    const key = uriKey(uri);
    if (this.lastSignatures.get(key) === signature) {
      return;
    }

    this.lastSignatures.set(key, signature);
    this.feedStore.add(event);
  }

  private queuePotentialRename(change: FileChangeNotification): void {
    const key = uriKey(change.uri);
    const timeout = setTimeout(() => {
      this.pendingDeletes.delete(key);
      void this.toChangeEvent(change).then((event) => {
        if (event) {
          this.emitEvent(change.uri, event);
        }
      });
    }, Math.max(600, this.config().get<number>("debounceMs", 300) * 3));

    this.pendingDeletes.set(key, { change, timeout });
  }

  private consumePotentialRename(createChange: FileChangeNotification): ChangeEvent | undefined {
    if (!createChange.currentContent) {
      return undefined;
    }

    for (const [key, pending] of this.pendingDeletes) {
      if (!pending.change.previousContent || pending.change.previousContent !== createChange.currentContent) {
        continue;
      }

      clearTimeout(pending.timeout);
      this.pendingDeletes.delete(key);
      const oldRelativePath = relativeToWorkspace(pending.change.uri);
      const newRelativePath = relativeToWorkspace(createChange.uri);

      return {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        workspaceFolder: workspaceRootFor(createChange.uri),
        filePath: createChange.uri.fsPath,
        relativePath: newRelativePath,
        type: "renamed",
        diffSummary: {
          added: 0,
          removed: 0,
          modified: 0,
          unchanged: 0,
          totalChanges: 0,
          message: `File renamed from ${oldRelativePath} to ${newRelativePath}.`
        },
        hunks: [],
        truncated: false,
        source: "filesystem-watcher"
      };
    }

    return undefined;
  }

  private async toChangeEvent(change: FileChangeNotification): Promise<ChangeEvent | undefined> {
    const folder = vscode.workspace.getWorkspaceFolder(change.uri);
    const base = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      workspaceFolder: workspaceRootFor(change.uri),
      filePath: change.uri.fsPath,
      relativePath: relativeToWorkspace(change.uri, folder),
      source: this.sourceFor(change) as ChangeSource
    };

    let diff: DiffResult;
    let type: ChangeEventType;

    if (change.kind === "created") {
      type = "created";
      diff = this.diffService.diffCreated(change.currentContent ?? "", this.config().get<boolean>("showInitialFileContentOnCreate", true));
    } else if (change.kind === "deleted") {
      type = "deleted";
      const previous = change.previousContent ?? "";
      diff = this.diffService.diffDeleted(previous, this.config().get<boolean>("showRemovedContentOnDelete", false));
    } else if (change.kind === "saved") {
      type = "saved";
      diff = this.diffService.diff(change.previousContent ?? "", change.currentContent ?? "");
    } else if (change.skipped === "large") {
      type = "external-change";
      diff = {
        summary: { added: 0, removed: 0, modified: 0, unchanged: 0, totalChanges: 0, message: "Large file change detected. Diff skipped because the file exceeds the configured size limit." },
        hunks: [],
        truncated: true
      };
    } else if (change.skipped === "binary") {
      type = "external-change";
      diff = {
        summary: { added: 0, removed: 0, modified: 0, unchanged: 0, totalChanges: 0, message: "Binary file change detected. Diff skipped." },
        hunks: [],
        truncated: false
      };
    } else if (change.currentContent !== undefined && change.previousContent !== undefined) {
      type = this.isOpenInVisibleEditor(change.uri) ? "modified" : "external-change";
      diff = this.diffService.diff(change.previousContent, change.currentContent);
    } else {
      return undefined;
    }

    if (diff.summary.totalChanges === 0 && type !== "saved" && type !== "created" && type !== "deleted" && !diff.truncated) {
      return undefined;
    }

    return { ...base, type, diffSummary: diff.summary, hunks: diff.hunks, truncated: diff.truncated };
  }

  async openFile(filePath: string, line?: number): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    if (line && line > 0) {
      const position = new vscode.Position(line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    }
  }

  async copyDiff(eventId: string): Promise<void> {
    const event = this.feedStore.getAll().find((item) => item.id === eventId);
    if (!event) {
      return;
    }
    await vscode.env.clipboard.writeText(this.formatEventMarkdown(event));
  }

  async exportFeedMarkdown(): Promise<void> {
    const content = this.feedStore.getAll().map((event) => this.formatEventMarkdown(event)).join("\n\n");
    await vscode.env.clipboard.writeText(content);
    void vscode.window.showInformationMessage("DiffStream feed copied as Markdown.");
  }

  private async readCurrentTextIfExists(uri: vscode.Uri): Promise<string | undefined> {
    try {
      return await readUriText(uri);
    } catch {
      return undefined;
    }
  }

  private formatEventMarkdown(event: ChangeEvent): string {
    const lines = [
      `### ${new Date(event.timestamp).toLocaleTimeString()} ${event.relativePath}`,
      `**${event.type}**: ${event.diffSummary.message}`
    ];

    for (const hunk of event.hunks) {
      lines.push("", `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
      for (const line of hunk.lines) {
        const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
        lines.push(`${prefix} ${line.content}`);
      }
    }

    return lines.join("\n");
  }

  private signature(event: ChangeEvent): string {
    const payload = JSON.stringify({
      relativePath: event.relativePath,
      type: event.type,
      summary: event.diffSummary,
      hunks: event.hunks
    });
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  private sourceFor(change: FileChangeNotification): ChangeSource {
    return change.kind === "saved" ? "vscode-save" : "filesystem-watcher";
  }

  private isOpenInVisibleEditor(uri: vscode.Uri): boolean {
    return vscode.window.visibleTextEditors.some((editor) => editor.document.uri.toString() === uri.toString());
  }

  private reloadSettings(): void {
    this.feedStore.setMaxItems(this.config().get<number>("maxFeedItems", 300));
    this.ignoreService.update(this.loadIgnoreSettings());
    this.watcher.updateSettings(this.loadWatcherSettings());

    if (!this.config().get<boolean>("enabled", true)) {
      this.stop();
    } else if (this.config().get<boolean>("autoStart", true) && !this.running) {
      this.start();
    }
  }

  private loadIgnoreSettings() {
    return {
      ignoredGlobs: this.config().get<string[]>("ignoredGlobs", []),
      ignoredExtensions: this.config().get<string[]>("ignoredExtensions", [])
    };
  }

  private loadWatcherSettings() {
    return {
      debounceMs: this.config().get<number>("debounceMs", 300),
      maxFileSizeBytes: this.config().get<number>("maxFileSizeBytes", 1048576)
    };
  }

  private config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("diffstream");
  }

  private fireState(): void {
    this.stateEmitter.fire(this.getState());
  }
}
