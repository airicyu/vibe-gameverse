import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HttpError } from "./errors.ts";
import { lastAssistantText, openPiSession, parseAssistantJson } from "./gm-pi.ts";
import { parseGeneratedWorld, type GeneratedWorld, type Primer } from "./schema.ts";
import { mockGeneratedWorld } from "./world-mock.ts";

const root = join(import.meta.dir, "..");

function gmMode(): "pi" | "mock" {
  return process.env.GM_MODE === "mock" ? "mock" : "pi";
}

function userPrompt(primer: Primer): string {
  return [
    "Invent a concrete playable seed from this primer. Do not copy primer text into summary, private_notes, or persona. Optional persona: omit or 1–2000 UTF-16 after trim. NPC memory_tier: omit or 0 only; 1 and 2 are rewritten to 0.",
    JSON.stringify(primer),
  ].join("\n");
}

export async function generateCustomSeed(primer: Primer, signal?: AbortSignal): Promise<GeneratedWorld> {
  if (signal?.aborted) throw new HttpError(400, { error: "aborted" });
  if (gmMode() === "mock") return mockGeneratedWorld(primer);

  const system = [
    await readFile(join(root, "prompts", "world-generate.md"), "utf8"),
    "Reply with a single JSON object only. No markdown, no tools.",
  ].join("\n\n");

  const jobDir = await mkdtemp(join(tmpdir(), "vibe-world-gen-"));
  const session = await openPiSession({
    cwd: jobDir,
    sessionDir: join(jobDir, "generate-sessions"),
    systemPrompt: system,
    fresh: true,
  });

  let lastErr: unknown = new Error("generation failed");
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal?.aborted) throw new HttpError(400, { error: "aborted" });
      const prompt =
        attempt === 0
          ? userPrompt(primer)
          : [
              "Previous JSON was invalid for the world-seed contract.",
              lastErr instanceof Error ? lastErr.message : String(lastErr),
              "Resend ONE JSON object with title, gm_note, gm_canon, entities, scene, relations.",
              "Exactly one player id player; ≥1 npc; ≥1 place; scene.scene_id is a place; present includes player and an npc.",
              "Do not copy primer fields into summary, private_notes, or persona. Optional persona: omit or 1–2000 UTF-16 after trim. NPC memory_tier omit or 0; 1 and 2 become 0.",
            ].join(" ");
      await session.prompt(prompt);
      await session.agent.waitForIdle();
      if (signal?.aborted) throw new HttpError(400, { error: "aborted" });
      try {
        return parseGeneratedWorld(parseAssistantJson(lastAssistantText(session)), primer);
      } catch (err) {
        lastErr = err;
      }
    }
    throw new HttpError(400, {
      error: "generation_failed",
      message: lastErr instanceof Error ? lastErr.message : String(lastErr),
    });
  } finally {
    session.dispose();
    await rm(jobDir, { recursive: true, force: true });
  }
}
