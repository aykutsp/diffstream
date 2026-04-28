import type * as vscode from "vscode";
import type { DiffStreamController } from "../core/DiffStreamController";
import type { FeedStore } from "../core/FeedStore";

type WebviewMessage =
  | { type: "command:clear" }
  | { type: "command:pause" }
  | { type: "command:resume" }
  | { type: "command:openFile"; filePath: string; line?: number }
  | { type: "command:copyDiff"; eventId: string }
  | { type: "command:copyContext" };

export class FeedWebviewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = "diffstream.feed";
  static readonly explorerViewType = "diffstream.feed.explorer";
  private view?: vscode.WebviewView;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly controller: DiffStreamController,
    private readonly feedStore: FeedStore
  ) {
    this.disposables.push(
      this.feedStore.onDidChange((events) => this.post("feed:update", { events })),
      this.controller.onDidChangeState((state) => this.post("state:update", { state }))
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = this.html(webviewView.webview);

    this.disposables.push(webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      void this.handleMessage(message);
    }));

    this.post("feed:update", { events: this.feedStore.getAll() });
    this.post("state:update", { state: this.controller.getState() });
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case "command:clear":
        this.controller.clearFeed();
        this.post("feed:clear", {});
        break;
      case "command:pause":
        this.controller.pause();
        this.post("feed:pause", {});
        break;
      case "command:resume":
        this.controller.resume();
        this.post("feed:resume", {});
        break;
      case "command:openFile":
        await this.controller.openFile(message.filePath, message.line);
        break;
      case "command:copyDiff":
        await this.controller.copyDiff(message.eventId);
        break;
      case "command:copyContext":
        await this.controller.exportFeedMarkdown();
        break;
    }
  }

  private post(type: string, payload: Record<string, unknown>): void {
    this.view?.webview.postMessage({ type, ...payload });
  }

  private html(webview: vscode.Webview): string {
    const nonce = getNonce();
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
      <title>DiffStream Feed</title>
  <style>
    :root {
      color-scheme: light dark;
    }
    body {
      margin: 0;
      padding: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font: var(--vscode-font-size) var(--vscode-font-family);
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: grid;
      gap: 8px;
      padding: 10px;
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-sideBar-border);
    }
    .actions, .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    button {
      height: 26px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 4px;
      padding: 0 8px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      cursor: pointer;
      font: inherit;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      color: var(--vscode-foreground);
      background: var(--vscode-button-secondaryBackground);
    }
    button.active {
      outline: 1px solid var(--vscode-focusBorder);
    }
    input {
      box-sizing: border-box;
      width: 100%;
      height: 28px;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      padding: 0 8px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      font: inherit;
    }
    .feed {
      display: grid;
      gap: 10px;
      padding: 10px;
    }
    .empty {
      padding: 18px 10px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }
    .event {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-editor-background);
      overflow: hidden;
    }
    .event-header {
      display: grid;
      gap: 5px;
      padding: 9px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .meta {
      display: flex;
      gap: 8px;
      align-items: center;
      min-width: 0;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .path {
      color: var(--vscode-foreground);
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .badge {
      border-radius: 999px;
      padding: 1px 6px;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
      white-space: nowrap;
    }
    .summary {
      color: var(--vscode-descriptionForeground);
      overflow-wrap: anywhere;
    }
    .event-actions {
      display: flex;
      gap: 6px;
      padding-top: 2px;
    }
    .diff {
      margin: 0;
      padding: 8px 0;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.45;
      white-space: pre;
    }
    .line {
      display: grid;
      grid-template-columns: 44px 1fr;
      gap: 8px;
      padding: 0 9px;
    }
    .line-number {
      color: var(--vscode-editorLineNumber-foreground);
      text-align: right;
      user-select: none;
    }
    .added {
      color: var(--vscode-gitDecoration-addedResourceForeground);
      background: color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground) 12%, transparent);
    }
    .removed {
      color: var(--vscode-gitDecoration-deletedResourceForeground);
      background: color-mix(in srgb, var(--vscode-gitDecoration-deletedResourceForeground) 12%, transparent);
    }
    .unchanged {
      color: var(--vscode-descriptionForeground);
    }
    .hunk {
      color: var(--vscode-textLink-foreground);
      padding: 2px 9px;
    }
    .warning {
      padding: 8px 9px;
      color: var(--vscode-editorWarning-foreground);
      background: var(--vscode-inputValidation-warningBackground);
    }
  </style>
</head>
<body>
  <section class="toolbar">
    <div class="actions">
      <button id="pauseResume" title="Pause or resume DiffStream">Pause</button>
      <button id="clear" class="secondary" title="Clear the feed">Clear</button>
      <button id="copyContext" class="secondary" title="Copy recent changes as Markdown">Context</button>
    </div>
    <input id="search" type="search" placeholder="Filter by file path" aria-label="Filter by file path">
    <div id="filters" class="filters"></div>
  </section>
  <main id="feed" class="feed"></main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const state = { events: [], filter: "all", query: "", paused: false };
    const filters = ["all", "added", "removed", "modified", "created", "deleted"];
    const feed = document.getElementById("feed");
    const filtersEl = document.getElementById("filters");
    const search = document.getElementById("search");
    const pauseResume = document.getElementById("pauseResume");

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function iconFor(type) {
      return { created: "+", deleted: "-", modified: "~", saved: "S", "external-change": "E", renamed: "R" }[type] || "*";
    }

    function lineRange(event) {
      const nums = [];
      for (const hunk of event.hunks || []) {
        for (const line of hunk.lines || []) {
          if (line.newLineNumber) nums.push(line.newLineNumber);
          else if (line.oldLineNumber) nums.push(line.oldLineNumber);
        }
      }
      if (!nums.length) return "";
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      return min === max ? "line " + min : "lines " + min + "-" + max;
    }

    function matchesFilter(event) {
      if (state.filter === "all") return true;
      if (state.filter === "created" || state.filter === "deleted" || state.filter === "modified") return event.type === state.filter;
      if (state.filter === "added") return event.diffSummary.added > 0;
      if (state.filter === "removed") return event.diffSummary.removed > 0;
      return true;
    }

    function renderFilters() {
      filtersEl.innerHTML = filters.map(filter =>
        '<button class="secondary ' + (state.filter === filter ? 'active' : '') + '" data-filter="' + filter + '">' +
        escapeHtml(filter[0].toUpperCase() + filter.slice(1)) + '</button>'
      ).join("");
    }

    function renderLine(line) {
      const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
      const number = line.type === "removed" ? line.oldLineNumber : line.newLineNumber || line.oldLineNumber || "";
      return '<div class="line ' + line.type + '">' +
        '<span class="line-number">' + escapeHtml(number) + '</span>' +
        '<span>' + escapeHtml(prefix + " " + line.content) + '</span>' +
      '</div>';
    }

    function renderEvent(event) {
      const time = new Date(event.timestamp).toLocaleTimeString();
      const range = lineRange(event);
      const hunks = (event.hunks || []).map(hunk =>
        '<div class="hunk">@@ -' + hunk.oldStart + ',' + hunk.oldLines + ' +' + hunk.newStart + ',' + hunk.newLines + ' @@</div>' +
        hunk.lines.map(renderLine).join("")
      ).join("");
      const warning = event.truncated ? '<div class="warning">Large file change detected. Showing a compact diff.</div>' : "";
      return '<article class="event">' +
        '<header class="event-header">' +
          '<div class="meta"><span>' + escapeHtml(time) + '</span><span class="badge">' + escapeHtml(iconFor(event.type) + " " + event.type) + '</span></div>' +
          '<div class="path">' + escapeHtml(event.relativePath) + '</div>' +
          '<div class="summary">' + escapeHtml((range ? range + ": " : "") + event.diffSummary.message) + '</div>' +
          '<div class="event-actions">' +
            '<button class="secondary" data-open="' + escapeHtml(event.id) + '">Open</button>' +
            '<button class="secondary" data-copy="' + escapeHtml(event.id) + '">Copy Diff</button>' +
          '</div>' +
        '</header>' +
        warning +
        '<pre class="diff">' + hunks + '</pre>' +
      '</article>';
    }

    function render() {
      renderFilters();
      pauseResume.textContent = state.paused ? "Resume" : "Pause";
      const query = state.query.trim().toLowerCase();
      const visible = state.events
        .filter(matchesFilter)
        .filter(event => !query || event.relativePath.toLowerCase().includes(query))
        .slice()
        .reverse();
      feed.innerHTML = visible.length ? visible.map(renderEvent).join("") : '<div class="empty">No DiffStream events yet.</div>';
    }

    document.getElementById("clear").addEventListener("click", () => vscode.postMessage({ type: "command:clear" }));
    document.getElementById("copyContext").addEventListener("click", () => vscode.postMessage({ type: "command:copyContext" }));
    pauseResume.addEventListener("click", () => vscode.postMessage({ type: state.paused ? "command:resume" : "command:pause" }));
    search.addEventListener("input", (event) => { state.query = event.target.value; render(); });
    filtersEl.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-filter]");
      if (!button) return;
      state.filter = button.dataset.filter;
      render();
    });
    feed.addEventListener("click", (event) => {
      const copyButton = event.target.closest("button[data-copy]");
      if (copyButton) {
        vscode.postMessage({ type: "command:copyDiff", eventId: copyButton.dataset.copy });
        return;
      }
      const openButton = event.target.closest("button[data-open]");
      if (openButton) {
        const item = state.events.find(event => event.id === openButton.dataset.open);
        if (item) vscode.postMessage({ type: "command:openFile", filePath: item.filePath });
      }
    });

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "feed:update") {
        state.events = message.events || [];
        render();
      }
      if (message.type === "state:update") {
        state.paused = Boolean(message.state && message.state.paused);
        render();
      }
      if (message.type === "feed:clear") {
        state.events = [];
        render();
      }
    });

    render();
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < 32; index++) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}
