import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { AppError } from "../core/errors.js";
import type { ExportArtifactPort } from "../core/ports.js";
import { assertExportSize, MAX_EXPORT_BYTES } from "./policy.js";

export class FileExportArtifactStore implements ExportArtifactPort {
  private readonly root: string;
  constructor(root: string, private readonly maximumBytes = MAX_EXPORT_BYTES) { this.root = resolve(root); }
  async write(id: string, content: Uint8Array): Promise<string> {
    if (!/^exp_[0-9a-z]{16,64}$/.test(id)) throw new AppError("VALIDATION_FAILED", "Export artifact ID is invalid");
    assertExportSize(content.byteLength, this.maximumBytes);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const path = resolve(this.root, `${id}.bin`);
    await writeFile(path, content, { mode: 0o600, flag: "wx" });
    return basename(path);
  }
  async read(path: string): Promise<Uint8Array> {
    this.assertPath(path);
    return await readFile(resolve(this.root, path)).catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") throw new AppError("NOT_FOUND", "Export download was not found");
      throw error;
    });
  }
  async remove(path: string): Promise<void> {
    this.assertPath(path);
    await unlink(resolve(this.root, path)).catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
      throw error;
    });
  }
  private assertPath(path: string): void {
    if (!/^exp_[0-9a-z]{16,64}\.bin$/.test(path)) throw new AppError("NOT_FOUND", "Export download was not found");
  }
}

export class MemoryExportArtifactStore implements ExportArtifactPort {
  private readonly artifacts = new Map<string, Uint8Array>();
  constructor(private readonly maximumBytes = MAX_EXPORT_BYTES) {}
  async write(id: string, content: Uint8Array): Promise<string> { assertExportSize(content.byteLength, this.maximumBytes); const path = `${id}.bin`; this.artifacts.set(path, content); return path; }
  async read(path: string): Promise<Uint8Array> {
    const content = this.artifacts.get(path);
    if (content === undefined) throw new AppError("NOT_FOUND", "Export download was not found");
    return content;
  }
  async remove(path: string): Promise<void> { this.artifacts.delete(path); }
}
