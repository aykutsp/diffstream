import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePath } from "../utils/pathUtils";
import { normalizeLineEndings, splitLines } from "../utils/fileUtils";

describe("path and file utilities", () => {
  it("normalizes Windows separators", () => {
    assert.equal(normalizePath("src\\core\\file.ts"), "src/core/file.ts");
  });

  it("splits normalized lines without final empty line", () => {
    assert.deepEqual(splitLines(normalizeLineEndings("a\r\nb\r\n")), ["a", "b"]);
  });
});
