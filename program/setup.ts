import { HttpError } from "./errors.ts";
import { createPlaySession, disposePlaySession } from "./gm-pi.ts";
import {
  commitCustomWorld,
  commitDefaultWorld,
  resetPlaythrough,
  syncWorldGate,
} from "./kb.ts";
import { PrimerSchema, type World } from "./schema.ts";
import { generateCustomSeed } from "./world-generate.ts";

export type SetupStatus = "idle" | "generating";

let setupStatus: SetupStatus = "idle";
let setupFlight: Promise<unknown> | null = null;
let setupAbort: AbortController | null = null;

export function getSetupStatus(): SetupStatus {
  return setupStatus;
}

async function assertCanSetup(): Promise<void> {
  if (setupStatus === "generating" || setupFlight) {
    throw new HttpError(409, { generating: true, error: "setup already running" });
  }
  const gate = await syncWorldGate();
  if (!gate.needs_setup) {
    throw new HttpError(409, { error: "already ready", needs_setup: false });
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

export async function setupDefault(): Promise<World> {
  return withSetupLock(async (signal) => {
    if (signal.aborted) throw new HttpError(400, { error: "aborted" });
    const world = await commitDefaultWorld();
    if (signal.aborted) throw new HttpError(400, { error: "aborted" });
    await createPlaySession();
    return world;
  });
}

export async function setupCustom(raw: unknown, requestSignal?: AbortSignal): Promise<World> {
  const parsed = PrimerSchema.safeParse(raw ?? {});
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
      const world = await commitCustomWorld(parsed.data, generated);
      await createPlaySession();
      return world;
    } finally {
      lockSignal.removeEventListener("abort", forward);
      requestSignal?.removeEventListener("abort", forward);
    }
  });
}

export async function requestNewGame(): Promise<{ ok: true; needs_setup: true }> {
  if (setupStatus === "generating") {
    if (setupAbort) {
      setupAbort.abort();
      await setupFlight?.catch(() => {});
    } else {
      throw new HttpError(409, { generating: true, error: "setup in progress" });
    }
  }
  await resetPlaythrough();
  await disposePlaySession();
  return { ok: true, needs_setup: true };
}
