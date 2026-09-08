import { HttpError } from "./errors.ts";
import { createPlaySession, disposePlaySession, openLoadedPlaySession } from "./gm-pi.ts";
import {
  clearPointer,
  commitCustomWorld,
  commitDefaultWorld,
  deleteActiveWorldDir,
  getScreen,
  isPlayableWorld,
  listPlayableWorlds,
  loadActiveSave,
  setActiveWorld,
  syncWorldGate,
  type PlayableWorldListItem,
} from "./kb.ts";
import { PrimerSchema, parseSaveName, type SaveMeta, type World, WORLD_UUID_RE } from "./schema.ts";
import { runOpeningTurnIfNeeded, type TurnResult } from "./turn.ts";
import { generateCustomSeed } from "./world-generate.ts";

export type SetupStatus = "idle" | "generating";

let setupStatus: SetupStatus = "idle";
let setupFlight: Promise<unknown> | null = null;
let setupAbort: AbortController | null = null;

export function getSetupStatus(): SetupStatus {
  return setupStatus;
}

function requireSaveName(raw: unknown): string {
  try {
    return parseSaveName(raw);
  } catch {
    throw new HttpError(400, { error: "save_name_invalid" });
  }
}

/** Only home (not generating) may setup. Existing playable worlds do not block. */
async function assertCanSetup(): Promise<void> {
  if (setupStatus === "generating" || setupFlight) {
    throw new HttpError(409, { generating: true, error: "setup already running" });
  }
  const screen = await getScreen();
  if (screen === "playing") {
    throw new HttpError(409, { error: "must_home", screen: "playing" });
  }
}

async function withSetupLock<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  await assertCanSetup();
  const ac = new AbortController();
  setupAbort = ac;
  setupStatus = "generating";
  const run = (async () => {
    try {
      return await fn(ac.signal);
    } finally {
      setupStatus = "idle";
      setupFlight = null;
      setupAbort = null;
    }
  })();
  setupFlight = run;
  return run;
}

export type SetupResult = {
  world: World;
  save: SaveMeta;
  opening: TurnResult | null;
};

export async function setupDefault(raw?: unknown): Promise<SetupResult> {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const saveName = requireSaveName(body.save_name);
  return withSetupLock(async (signal) => {
    if (signal.aborted) throw new HttpError(400, { error: "aborted" });
    const result = await commitDefaultWorld(saveName);
    if (signal.aborted) throw new HttpError(400, { error: "aborted" });
    await createPlaySession();
    const opening = await runOpeningTurnIfNeeded();
    return { ...result, opening };
  });
}

export async function setupCustom(raw: unknown, requestSignal?: AbortSignal): Promise<SetupResult> {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const saveName = requireSaveName(body.save_name);
  const { save_name: _s, ...primerRaw } = body;
  const parsed = PrimerSchema.safeParse(primerRaw);
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.code === "too_big");
    throw new HttpError(400, {
      error: tooLong ? "primer_too_long" : "primer_invalid",
      issues: parsed.error.issues,
    });
  }
  return withSetupLock(async (lockSignal) => {
    const combined = new AbortController();
    const forward = () => combined.abort();
    lockSignal.addEventListener("abort", forward);
    requestSignal?.addEventListener("abort", forward);
    if (lockSignal.aborted || requestSignal?.aborted) combined.abort();
    try {
      if (combined.signal.aborted) throw new HttpError(400, { error: "aborted" });
      const generated = await generateCustomSeed(parsed.data, combined.signal);
      if (combined.signal.aborted) throw new HttpError(400, { error: "aborted" });
      const result = await commitCustomWorld(parsed.data, generated, saveName);
      await createPlaySession();
      const opening = await runOpeningTurnIfNeeded();
      return { ...result, opening };
    } finally {
      lockSignal.removeEventListener("abort", forward);
      requestSignal?.removeEventListener("abort", forward);
    }
  });
}

/** Dispose + clear pointer; does not delete uuid dirs. Idempotent. */
export async function requestHome(): Promise<{ ok: true; screen: "home" }> {
  if (setupStatus === "generating") {
    if (setupAbort) {
      setupAbort.abort();
      await setupFlight?.catch(() => {});
    } else {
      throw new HttpError(409, { generating: true, error: "setup in progress" });
    }
  }
  await disposePlaySession();
  await clearPointer();
  return { ok: true, screen: "home" };
}

/** Alias: same as home. Must not clear parent worlds. */
export async function requestNewGame(): Promise<{ ok: true; screen: "home" }> {
  return requestHome();
}

export async function listWorlds(): Promise<{ worlds: PlayableWorldListItem[] }> {
  return { worlds: await listPlayableWorlds() };
}

export async function loadWorld(
  raw: unknown,
): Promise<{ ok: true; world: World; save: SaveMeta; opening: TurnResult | null }> {
  if (setupStatus === "generating" || setupFlight) {
    throw new HttpError(409, { generating: true, error: "setup already running" });
  }
  if (!raw || typeof raw !== "object") {
    throw new HttpError(400, { error: "id_required" });
  }
  const id = (raw as Record<string, unknown>).id;
  if (typeof id !== "string") {
    throw new HttpError(400, { error: "id_required" });
  }
  const screen = await getScreen();
  if (screen === "playing") {
    throw new HttpError(409, { error: "must_home", screen: "playing" });
  }
  if (!WORLD_UUID_RE.test(id) || !(await isPlayableWorld(id))) {
    throw new HttpError(409, { error: "not_playable" });
  }
  await disposePlaySession();
  await setActiveWorld(id);
  const gate = await syncWorldGate();
  if (gate.needs_setup || !gate.world) {
    await clearPointer();
    throw new HttpError(409, { error: "not_playable" });
  }
  await openLoadedPlaySession();
  const meta = await loadActiveSave();
  if (!meta) throw new HttpError(409, { error: "not_playable" });
  const opening = await runOpeningTurnIfNeeded();
  return { ok: true, world: gate.world, save: meta, opening };
}

export async function deleteCurrentWorld(raw: unknown): Promise<{ ok: true; screen: "home" }> {
  const screen = await getScreen();
  if (screen !== "playing") {
    throw new HttpError(409, { error: "not_playing" });
  }
  if (!raw || typeof raw !== "object") {
    throw new HttpError(400, { error: "confirm_required" });
  }
  const confirm = (raw as Record<string, unknown>).confirm;
  if (typeof confirm !== "string" || confirm.trim() !== "delete") {
    throw new HttpError(400, { error: "confirm_mismatch" });
  }
  await disposePlaySession();
  await deleteActiveWorldDir();
  return { ok: true, screen: "home" };
}
