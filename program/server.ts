import index from "./public/index.html";
import { HttpError } from "./errors.ts";
import { serverLogPath, turnLog } from "./log.ts";
import { debugRunCompact } from "./compact.ts";
import {
  bootWorlds,
  getScreen,
  loadActiveSave,
  loadChatTail,
  loadEpisodes,
  loadGmNote,
  loadPending,
  loadRelations,
  loadScene,
  syncWorldGate,
} from "./kb.ts";
import {
  deleteCurrentWorld,
  getSetupStatus,
  listWorlds,
  loadWorld,
  requestHome,
  requestNewGame,
  setupCustom,
  setupDefault,
} from "./setup.ts";
import { runTurn } from "./turn.ts";
import { runGmChat } from "./gm-meta.ts";
import { getAppConfig } from "./config.ts";

await getAppConfig();
await bootWorlds();

const gmMode = process.env.GM_MODE === "mock" ? "mock" : "pi";

function jsonError(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json(err.body, { status: err.status });
  }
  throw err;
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 8787),
  idleTimeout: 180,
  routes: {
    "/": index,

    "/api/turn": {
      POST: async (req) => {
        const body: unknown = await req.json();
        turnLog("http", "POST /api/turn");
        try {
          return Response.json(await runTurn(body));
        } catch (err) {
          if (err instanceof HttpError) return jsonError(err);
          turnLog("http", `turn failed  ${err instanceof Error ? err.message : String(err)}`);
          throw err;
        }
      },
    },

    "/api/state": {
      GET: async () => {
        const screen = await getScreen();
        const playing = screen === "playing";
        const gate = await syncWorldGate();
        const save = playing ? await loadActiveSave() : null;
        const [gm_note, episodes, chat_tail, relations, scene, pending] = playing
          ? await Promise.all([
              loadGmNote(),
              loadEpisodes(),
              loadChatTail(),
              loadRelations(),
              loadScene(),
              loadPending(),
            ])
          : ["", [], [], [], null, null];
        return Response.json({
          screen,
          needs_setup: !playing,
          setup_status: getSetupStatus(),
          world: playing && gate.world ? { id: gate.world.id, source: gate.world.source, save_name: gate.world.save_name } : null,
          save: save ? { id: save.id, save_name: save.save_name } : null,
          scene: playing ? scene : null,
          gm_note: playing ? gm_note : "",
          episode_count: playing ? episodes.length : 0,
          episodes: playing ? episodes.slice(-12) : [],
          chat_tail: playing ? chat_tail : [],
          relations: playing ? relations : [],
          gm_mode: gmMode,
          debug: getAppConfig().debug,
          adjudication: playing && pending ? { status: "pending" } : playing ? null : null,
          gm_chat: playing ? { messages: pending?.messages ?? [] } : { messages: [] },
        });
      },
    },

    "/api/gm-chat": {
      POST: async (req) => {
        const body: unknown = await req.json();
        turnLog("http", "POST /api/gm-chat");
        try {
          return Response.json(await runGmChat(body));
        } catch (err) {
          if (err instanceof HttpError) return jsonError(err);
          turnLog("http", `gm-chat failed  ${err instanceof Error ? err.message : String(err)}`);
          throw err;
        }
      },
    },

    "/api/worlds": {
      GET: async () => {
        try {
          return Response.json(await listWorlds());
        } catch (err) {
          return jsonError(err);
        }
      },
    },

    "/api/worlds/load": {
      POST: async (req) => {
        try {
          const body: unknown = await req.json().catch(() => ({}));
          return Response.json(await loadWorld(body));
        } catch (err) {
          return jsonError(err);
        }
      },
    },

    "/api/worlds/delete": {
      POST: async (req) => {
        try {
          const body: unknown = await req.json().catch(() => ({}));
          return Response.json(await deleteCurrentWorld(body));
        } catch (err) {
          return jsonError(err);
        }
      },
    },

    "/api/home": {
      POST: async () => {
        try {
          return Response.json(await requestHome());
        } catch (err) {
          return jsonError(err);
        }
      },
    },

    "/api/setup/default": {
      POST: async (req) => {
        try {
          const body: unknown = await req.json().catch(() => ({}));
          const result = await setupDefault(body);
          return Response.json({
            ok: true,
            world: result.world,
            save: result.save,
            opening: result.opening
              ? { turn_id: result.opening.turn_id, gm: result.opening.gm }
              : null,
          });
        } catch (err) {
          return jsonError(err);
        }
      },
    },

    "/api/setup/custom": {
      POST: async (req) => {
        try {
          const body: unknown = await req.json().catch(() => ({}));
          const result = await setupCustom(body, req.signal);
          return Response.json({
            ok: true,
            world: result.world,
            save: result.save,
            opening: result.opening
              ? { turn_id: result.opening.turn_id, gm: result.opening.gm }
              : null,
          });
        } catch (err) {
          return jsonError(err);
        }
      },
    },

    "/api/new-game": {
      POST: async () => {
        try {
          return Response.json(await requestNewGame());
        } catch (err) {
          return jsonError(err);
        }
      },
    },

    "/api/debug/session-compact": {
      POST: async () => {
        turnLog("http", "POST /api/debug/session-compact");
        try {
          if (!getAppConfig().debug) {
            throw new HttpError(404, { error: "not_found" });
          }
          if ((await getScreen()) !== "playing") {
            throw new HttpError(409, { error: "not_playing" });
          }
          const gate = await syncWorldGate();
          if (gate.needs_setup) {
            throw new HttpError(409, { needs_setup: true, error: "needs_setup" });
          }
          const result = await debugRunCompact();
          return Response.json({
            ok: result.compacted,
            compacted: result.compacted,
            archive_id: result.archiveId ?? null,
            turn_id: result.turn_id,
          });
        } catch (err) {
          return jsonError(err);
        }
      },
    },

    "/api/*": Response.json({ message: "Not found" }, { status: 404 }),
  },

  error(error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: msg }, { status: 400 });
  },
});

console.log(`vibe-gameverse  ${server.url}  (GM_MODE=${gmMode})`);
turnLog("boot", `server.log=${serverLogPath()} debug=${getAppConfig().debug}`);
