import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as vscode from "vscode";
import { IgnoreService } from "../core/IgnoreService";

describe("IgnoreService", () => {
  it("ignores configured glob patterns", () => {
    const service = new IgnoreService({ ignoredGlobs: ["**/node_modules/**"], ignoredExtensions: [] });

    assert.equal(service.isIgnored(vscode.Uri.file("node_modules/pkg/index.js")), true);
  });

  it("ignores configured extensions", () => {
    const service = new IgnoreService({ ignoredGlobs: [], ignoredExtensions: [".png"] });

    assert.equal(service.isIgnored(vscode.Uri.file("assets/logo.png")), true);
  });
});
