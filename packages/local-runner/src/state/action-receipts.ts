import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HostActionReceiptSchema, RequestIdSchema, type HostActionReceipt, type RequestId } from "@hfj/contracts";

export class ActionReceiptStore {
  constructor(private readonly root: string) {}

  async read(requestIdInput: RequestId): Promise<HostActionReceipt | null> {
    const requestId = RequestIdSchema.parse(requestIdInput);
    try {
      return HostActionReceiptSchema.parse(JSON.parse(await readFile(this.path(requestId), "utf8")));
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async write(receiptInput: HostActionReceipt): Promise<void> {
    const receipt = HostActionReceiptSchema.parse(receiptInput);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const target = this.path(receipt.request_id);
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(receipt)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, target);
  }

  async remove(requestIdInput: RequestId): Promise<void> {
    await rm(this.path(RequestIdSchema.parse(requestIdInput)), { force: true });
  }

  async purge(): Promise<void> {
    await rm(this.root, { recursive: true, force: true });
  }

  private path(requestId: RequestId): string {
    return resolve(this.root, `${requestId}.json`);
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
