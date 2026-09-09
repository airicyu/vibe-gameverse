import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.VIBE_GAMEVERSE_KB_WORLDS = mkdtempSync(join(tmpdir(), "vibe-gameverse-worlds-"));
process.env.VIBE_GAMEVERSE_LOG = join(process.env.VIBE_GAMEVERSE_KB_WORLDS, "server.log");
process.env.GM_MODE = "mock";
if (!process.env.VIBE_GAMEVERSE_CONFIG) {
  const cfgDir = mkdtempSync(join(tmpdir(), "vibe-gameverse-cfg-"));
  const cfgPath = join(cfgDir, "config.yaml");
  writeFileSync(
    cfgPath,
    `compact:
  max_turns_without_compact: 20
  recent_turns_to_keep: 3
  force_after_input_tokens: 100000
  force_after_jsonl_bytes: 400000
`,
  );
  process.env.VIBE_GAMEVERSE_CONFIG = cfgPath;
}
