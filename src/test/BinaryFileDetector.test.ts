import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BinaryFileDetector } from "../core/BinaryFileDetector";

describe("BinaryFileDetector", () => {
  it("detects null-byte binary buffers", () => {
    const detector = new BinaryFileDetector();

    assert.equal(detector.isBinaryBuffer(new Uint8Array([65, 0, 66])), true);
  });

  it("allows normal UTF-8 text buffers", () => {
    const detector = new BinaryFileDetector();

    assert.equal(detector.isBinaryBuffer(Buffer.from("const value = 1;\n", "utf8")), false);
  });
});
