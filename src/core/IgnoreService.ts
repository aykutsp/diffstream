import * as minimatch from "minimatch";
import type * as vscode from "vscode";
import { extensionOf, normalizePath, relativeToWorkspace } from "../utils/pathUtils";

export interface IgnoreSettings {
  ignoredGlobs: string[];
  ignoredExtensions: string[];
}

const DEFAULT_IGNORED_GLOBS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/coverage/**",
  "**/.next/**",
  "**/.turbo/**",
  "**/vendor/**",
  "**/target/**",
  "**/.idea/**"
];

export class IgnoreService {
  private settings: IgnoreSettings;

  constructor(settings?: Partial<IgnoreSettings>) {
    this.settings = {
      ignoredGlobs: settings?.ignoredGlobs ?? DEFAULT_IGNORED_GLOBS,
      ignoredExtensions: settings?.ignoredExtensions ?? []
    };
  }

  update(settings: Partial<IgnoreSettings>): void {
    this.settings = {
      ignoredGlobs: settings.ignoredGlobs ?? this.settings.ignoredGlobs,
      ignoredExtensions: settings.ignoredExtensions ?? this.settings.ignoredExtensions
    };
  }

  isIgnored(uri: vscode.Uri): boolean {
    const relativePath = normalizePath(relativeToWorkspace(uri));
    const absolutePath = normalizePath(uri.fsPath);
    const ext = extensionOf(uri.fsPath);
    const ignoredExtensions = this.settings.ignoredExtensions.map((item) => item.toLowerCase());

    if (ext && ignoredExtensions.includes(ext)) {
      return true;
    }

    return this.settings.ignoredGlobs.some((pattern) => {
      const normalized = normalizePath(pattern);
      return minimatch.minimatch(relativePath, normalized, { dot: true }) ||
        minimatch.minimatch(absolutePath, normalized, { dot: true });
    });
  }
}
