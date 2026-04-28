import * as path from "node:path";
import * as vscode from "vscode";

export function normalizePath(input: string): string {
  return input.replace(/\\/g, "/");
}

export function uriKey(uri: vscode.Uri): string {
  return normalizePath(uri.fsPath);
}

export function getWorkspaceFolder(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.getWorkspaceFolder(uri);
}

export function relativeToWorkspace(uri: vscode.Uri, folder?: vscode.WorkspaceFolder): string {
  const workspaceFolder = folder ?? getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    return normalizePath(path.basename(uri.fsPath));
  }

  return normalizePath(path.relative(workspaceFolder.uri.fsPath, uri.fsPath)) || normalizePath(path.basename(uri.fsPath));
}

export function workspaceRootFor(uri: vscode.Uri): string {
  return normalizePath(getWorkspaceFolder(uri)?.uri.fsPath ?? "");
}

export function extensionOf(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}
