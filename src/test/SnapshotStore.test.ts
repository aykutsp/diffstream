import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as vscode from "vscode";
import { SnapshotStore } from "../core/SnapshotStore";

describe("SnapshotStore", () => {
  it("stores normalized content and increments versions", () => {
    const uri = vscode.Uri.file("src/example.ts");
    const store = new SnapshotStore();

    const first = store.set(uri, "a\r\nb\r\n");
    const second = store.set(uri, "a\nc\n");

    assert.equal(first.version, 1);
    assert.equal(second.version, 2);
    assert.equal(store.getContent(uri), "a\nc\n");
  });

  it("deletes snapshots", () => {
    const uri = vscode.Uri.file("src/delete.ts");
    const store = new SnapshotStore();

    store.set(uri, "content");
    const previous = store.delete(uri);

    assert.equal(previous?.content, "content");
    assert.equal(store.has(uri), false);
  });
});
