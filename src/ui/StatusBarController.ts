import * as vscode from "vscode";
import type { DiffStreamController, DiffStreamState } from "../core/DiffStreamController";

export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly disposable: vscode.Disposable;

  constructor(controller: DiffStreamController) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = "diffstream.openFeed";
    this.disposable = controller.onDidChangeState((state) => this.update(state));
    this.update(controller.getState());
    this.item.show();
  }

  update(state: DiffStreamState): void {
    if (!state.running) {
      this.item.text = "$(circle-slash) DiffStream stopped";
      this.item.tooltip = "DiffStream is stopped. Click to open the feed.";
      return;
    }

    if (state.paused) {
      this.item.text = "$(debug-pause) DiffStream paused";
      this.item.tooltip = "DiffStream feed is paused. Click to open the feed.";
      return;
    }

    this.item.text = "$(pulse) DiffStream watching";
    this.item.tooltip = "DiffStream is watching workspace changes.";
  }

  dispose(): void {
    this.disposable.dispose();
    this.item.dispose();
  }
}
