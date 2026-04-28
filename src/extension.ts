import * as vscode from "vscode";
import { DiffStreamController } from "./core/DiffStreamController";
import { FeedStore } from "./core/FeedStore";
import { FeedWebviewProvider } from "./ui/FeedWebviewProvider";
import { StatusBarController } from "./ui/StatusBarController";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const maxFeedItems = vscode.workspace.getConfiguration("diffstream").get<number>("maxFeedItems", 300);
  const feedStore = new FeedStore(maxFeedItems, context.workspaceState);
  const controller = new DiffStreamController(context, feedStore);
  const provider = new FeedWebviewProvider(context.extensionUri, controller, feedStore);
  const statusBar = new StatusBarController(controller);

  context.subscriptions.push(
    controller,
    provider,
    statusBar,
    vscode.window.registerWebviewViewProvider(FeedWebviewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.window.registerWebviewViewProvider(FeedWebviewProvider.explorerViewType, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.commands.registerCommand("diffstream.openFeed", async () => {
      try {
        await vscode.commands.executeCommand("workbench.view.extension.diffstream");
        await vscode.commands.executeCommand("diffstream.feed.focus");
      } catch {
        await vscode.commands.executeCommand("workbench.view.explorer");
        await vscode.commands.executeCommand("diffstream.feed.explorer.focus");
      }
    }),
    vscode.commands.registerCommand("diffstream.start", () => controller.start()),
    vscode.commands.registerCommand("diffstream.stop", () => controller.stop()),
    vscode.commands.registerCommand("diffstream.pause", () => controller.pause()),
    vscode.commands.registerCommand("diffstream.resume", () => controller.resume()),
    vscode.commands.registerCommand("diffstream.clearFeed", () => controller.clearFeed()),
    vscode.commands.registerCommand("codepulse.openFeed", async () => {
      await vscode.commands.executeCommand("diffstream.openFeed");
    }),
    vscode.commands.registerCommand("codepulse.start", () => controller.start()),
    vscode.commands.registerCommand("codepulse.stop", () => controller.stop()),
    vscode.commands.registerCommand("codepulse.pause", () => controller.pause()),
    vscode.commands.registerCommand("codepulse.resume", () => controller.resume()),
    vscode.commands.registerCommand("codepulse.clearFeed", () => controller.clearFeed())
  );

  await controller.initialize();
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions automatically.
}
