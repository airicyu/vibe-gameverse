import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAppConfig } from "./config.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function serverLogPath(): string {
  const override = process.env.VIBE_GAMEVERSE_LOG?.trim();
  return override && override.length > 0 ? override : join(root, "server.log");
}

function stamp(): string {
  return new Date().toISOString().slice(11, 23);
}

function isDebug(): boolean {
  try {
    return getAppConfig().debug === true;
  } catch {
    return false;
  }
}

function appendFileLine(level: string, scope: string, msg: string): void {
  const body = msg.replace(/\r\n/g, "\n").replace(/\n/g, "\n    ");
  const line = `${stamp()}  ${level.padEnd(5)} [${scope}] ${body}\n`;
  try {
    appendFileSync(serverLogPath(), line);
  } catch {
    /* logging must not crash the game */
  }
}

/** Console + server.log (info). */
export function turnLog(scope: string, msg: string): void {
  console.log(`${stamp()}  [${scope}] ${msg}`);
  appendFileLine("info", scope, msg);
}

/** server.log only. Used for parse payloads and scratch compact replies. */
export function debugLog(scope: string, msg: string): void {
  appendFileLine("debug", scope, msg);
}

export function debugEnabled(): boolean {
  return isDebug();
}
