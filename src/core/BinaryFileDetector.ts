import * as vscode from "vscode";

const TEXT_DECODER = new TextDecoder("utf-8", { fatal: false });

export class BinaryFileDetector {
  async isBinary(uri: vscode.Uri, maxBytes = 8192): Promise<boolean> {
    const full = await vscode.workspace.fs.readFile(uri);
    const sample = full.slice(0, Math.min(full.length, maxBytes));

    if (sample.includes(0)) {
      return true;
    }

    const decoded = TEXT_DECODER.decode(sample);
    if (!decoded) {
      return false;
    }

    const replacementCount = Array.from(decoded).filter((char) => char === "\uFFFD").length;
    return replacementCount / decoded.length > 0.05;
  }

  isBinaryBuffer(buffer: Uint8Array): boolean {
    const sample = buffer.slice(0, Math.min(buffer.length, 8192));
    if (sample.includes(0)) {
      return true;
    }
    const decoded = TEXT_DECODER.decode(sample);
    const replacementCount = Array.from(decoded).filter((char) => char === "\uFFFD").length;
    return decoded.length > 0 && replacementCount / decoded.length > 0.05;
  }
}
