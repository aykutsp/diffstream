import Module = require("node:module");
import * as path from "node:path";

class EventEmitter<T> {
  private listeners: Array<(event: T) => void> = [];
  readonly event = (listener: (event: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter((item) => item !== listener); } };
  };
  fire(event: T): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
  dispose(): void {
    this.listeners = [];
  }
}

class Uri {
  scheme = "file";
  constructor(readonly fsPath: string) {}
  static file(filePath: string): Uri {
    return new Uri(path.resolve(filePath));
  }
  toString(): string {
    return this.fsPath;
  }
}

const vscodeMock = {
  EventEmitter,
  Uri,
  FileType: {
    File: 1,
    Directory: 2
  },
  workspace: {
    getWorkspaceFolder: (_uri: Uri) => ({
      uri: Uri.file(process.cwd()),
      name: "workspace",
      index: 0
    }),
    getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
    fs: {}
  }
};

type ModuleWithLoad = typeof Module & {
  _load: (request: string, parent: NodeModule | null, isMain: boolean) => unknown;
};

const moduleWithLoad = Module as ModuleWithLoad;
const originalLoad = moduleWithLoad._load;
moduleWithLoad._load = function patchedLoad(request: string, parent: NodeModule | null, isMain: boolean) {
  if (request === "vscode") {
    return vscodeMock;
  }
  return originalLoad.call(this, request, parent, isMain);
};
