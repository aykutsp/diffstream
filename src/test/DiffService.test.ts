import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DiffService } from "../core/DiffService";

describe("DiffService", () => {
  it("detects added and removed lines", () => {
    const result = new DiffService().diff("const a = 1;\nconst b = 2;\n", "const a = 1;\nconst c = 3;\nconst d = 4;\n");

    assert.equal(result.summary.added, 2);
    assert.equal(result.summary.removed, 1);
    assert.ok(result.hunks.length > 0);
  });

  it("normalizes line endings", () => {
    const result = new DiffService().diff("a\r\nb\r\n", "a\nb\n");

    assert.equal(result.summary.totalChanges, 0);
    assert.equal(result.hunks.length, 0);
  });

  it("truncates large diffs", () => {
    const result = new DiffService().diff("", Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n"), { maxChanges: 5 });

    assert.equal(result.truncated, true);
    assert.equal(result.hunks.flatMap((hunk) => hunk.lines).filter((line) => line.type === "added").length, 5);
  });
});
