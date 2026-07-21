import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

const executeFile = promisify(execFile);
type ExecuteFile = (
  file: string,
  args: readonly string[],
  options: { readonly encoding: "utf8"; readonly maxBuffer: number },
) => Promise<{ readonly stdout: string; readonly stderr: string }>;
const defaultExecute: ExecuteFile = async (file, args, options) => await executeFile(file, args, options);
const SecretNameSchema = z.enum(["oauth-refresh-token", "oauth-client-id"]);

export type RunnerSecretName = z.infer<typeof SecretNameSchema>;

export interface KeychainPort {
  read(name: RunnerSecretName): Promise<string | null>;
  write(name: RunnerSecretName, value: string): Promise<void>;
  delete(name: RunnerSecretName): Promise<void>;
}

export class MacOSKeychain implements KeychainPort {
  constructor(
    private readonly account: string,
    private readonly execute: ExecuteFile = defaultExecute,
  ) {
    if (process.platform !== "darwin") throw new Error("The Fullwell local runner currently requires macOS");
  }

  async read(name: RunnerSecretName): Promise<string | null> {
    SecretNameSchema.parse(name);
    try {
      const result = await this.execute("/usr/bin/security", ["find-generic-password", "-a", this.account, "-s", serviceName(name), "-w"], { encoding: "utf8", maxBuffer: 16_384 });
      return result.stdout.replace(/[\r\n]+$/, "");
    } catch (error) {
      if (isMissingKeychainItem(error)) return null;
      throw new Error(`Unable to read ${name} from macOS Keychain`, { cause: error });
    }
  }

  async write(name: RunnerSecretName, value: string): Promise<void> {
    SecretNameSchema.parse(name);
    if (value.length < 1 || value.length > 4_096) throw new Error("Keychain secret length is invalid");
    await this.execute("/usr/bin/security", ["add-generic-password", "-U", "-a", this.account, "-s", serviceName(name), "-w", value], { encoding: "utf8", maxBuffer: 16_384 });
  }

  async delete(name: RunnerSecretName): Promise<void> {
    SecretNameSchema.parse(name);
    try {
      await this.execute("/usr/bin/security", ["delete-generic-password", "-a", this.account, "-s", serviceName(name)], { encoding: "utf8", maxBuffer: 16_384 });
    } catch (error) {
      if (!isMissingKeychainItem(error)) throw new Error(`Unable to delete ${name} from macOS Keychain`, { cause: error });
    }
  }
}

function serviceName(name: RunnerSecretName): string {
  return `com.fullwell.local-runner.${name}`;
}

function isMissingKeychainItem(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 44;
}
