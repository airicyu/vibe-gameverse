import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.VIBE_GAMEVERSE_KB_RUNTIME = mkdtempSync(join(tmpdir(), "vibe-gameverse-test-"));
if (!process.env.GM_MODE) process.env.GM_MODE = "mock";
