import * as vscode from "vscode";
import type { ChangeEvent } from "../types/ChangeEvent";

const STORAGE_KEY = "diffstream.feed";

export class FeedStore {
  private readonly events: ChangeEvent[] = [];
  private readonly emitter = new vscode.EventEmitter<ChangeEvent[]>();
  readonly onDidChange = this.emitter.event;

  constructor(private maxItems: number, private readonly workspaceState?: vscode.Memento) {}

  async hydrate(): Promise<void> {
    const stored = this.workspaceState?.get<ChangeEvent[]>(STORAGE_KEY, []);
    if (stored?.length) {
      this.events.splice(0, this.events.length, ...stored.slice(-this.maxItems));
      this.emitter.fire(this.getAll());
    }
  }

  add(event: ChangeEvent): void {
    this.events.push(event);
    while (this.events.length > this.maxItems) {
      this.events.shift();
    }
    void this.persist();
    this.emitter.fire(this.getAll());
  }

  clear(): void {
    this.events.splice(0, this.events.length);
    void this.persist();
    this.emitter.fire([]);
  }

  getAll(): ChangeEvent[] {
    return [...this.events];
  }

  setMaxItems(maxItems: number): void {
    this.maxItems = maxItems;
    while (this.events.length > this.maxItems) {
      this.events.shift();
    }
    void this.persist();
    this.emitter.fire(this.getAll());
  }

  dispose(): void {
    this.emitter.dispose();
  }

  private async persist(): Promise<void> {
    await this.workspaceState?.update(STORAGE_KEY, this.events);
  }
}
