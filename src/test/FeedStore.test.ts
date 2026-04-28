import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FeedStore } from "../core/FeedStore";
import type { ChangeEvent } from "../types/ChangeEvent";

function event(id: string): ChangeEvent {
  return {
    id,
    timestamp: Date.now(),
    workspaceFolder: "/workspace",
    filePath: `/workspace/${id}.ts`,
    relativePath: `${id}.ts`,
    type: "modified",
    diffSummary: { added: 1, removed: 0, modified: 0, unchanged: 0, totalChanges: 1, message: "1 added" },
    hunks: [],
    truncated: false,
    source: "filesystem-watcher"
  };
}

describe("FeedStore", () => {
  it("keeps only max feed items", () => {
    const store = new FeedStore(2);

    store.add(event("one"));
    store.add(event("two"));
    store.add(event("three"));

    assert.deepEqual(store.getAll().map((item) => item.id), ["two", "three"]);
  });

  it("clears events", () => {
    const store = new FeedStore(10);

    store.add(event("one"));
    store.clear();

    assert.equal(store.getAll().length, 0);
  });
});
