import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AppConfigSchema, type AppConfig } from "./schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let cached: AppConfig | null = null;

export function appConfigPath(): string {
  const override = process.env.VIBE_GAMEVERSE_CONFIG?.trim();
  return override && override.length > 0 ? override : join(root, "config.yaml");
}

export function loadAppConfigFromDisk(): AppConfig {
  const path = appConfigPath();
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(`config.yaml missing or unreadable: ${path}`);
  }
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(text);
  } catch (err) {
    throw new Error(`config.yaml YAML parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  const result = AppConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`config.yaml invalid: ${result.error.message}`);
  }
  return result.data;
}

export function getAppConfig(): AppConfig {
  cached ??= loadAppConfigFromDisk();
  return cached;
}

/** 測試用：清快取以便改 env 後重讀。 */
export function resetAppConfigCache(): void {
  cached = null;
}
