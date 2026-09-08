const log = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("input");
const meta = document.getElementById("meta");
const heading = document.getElementById("heading");
const setupEl = document.getElementById("setup");
const playEl = document.getElementById("play");
const customForm = document.getElementById("custom-form");
const setupMsg = document.getElementById("setup-msg");
const setupDefaultBtn = document.getElementById("setup-default");
const setupCustomToggle = document.getElementById("setup-custom-toggle");
const setupCustomSubmit = document.getElementById("setup-custom-submit");
const debugPanel = document.getElementById("debug-panel");
const debugCompactBtn = document.getElementById("debug-compact");
const debugMsg = document.getElementById("debug-msg");

let sceneId = null;
let worldTitle = null;

function add(who, text, cls) {
  const div = document.createElement("div");
  div.className = `bubble ${cls}`;
  div.innerHTML = `<div class="who">${who}</div><div class="text"></div>`;
  div.querySelector(".text").textContent = text;
  log.appendChild(div);
  div.scrollIntoView({ behavior: "smooth", block: "end" });
}

function setNeutralChrome() {
  document.title = "vibe-gameverse";
  heading.textContent = "vibe-gameverse";
  input.placeholder = "隨便說一句……";
}

function setWorldChrome(title) {
  worldTitle = title;
  document.title = title;
  heading.textContent = title;
  input.placeholder = `你在「${title}」……`;
}

function showSetup() {
  setupEl.hidden = false;
  playEl.hidden = true;
  input.disabled = true;
  setNeutralChrome();
}

function showPlay(title) {
  setupEl.hidden = true;
  playEl.hidden = false;
  input.disabled = false;
  setWorldChrome(title);
}

function applyMeta(s) {
  const mode = s.gm_mode ?? "?";
  if (s.needs_setup) {
    meta.textContent = `模式 ${mode} · 尚未選擇起始劇本`;
    debugPanel.hidden = true;
    return;
  }
  meta.textContent = `模式 ${mode} · 已寫 ${s.episode_count} 則 episode · 關係 ${s.relations.length} 條`;
  debugPanel.hidden = !s.debug;
}

function setSetupBusy(busy) {
  setupDefaultBtn.disabled = busy;
  setupCustomToggle.disabled = busy;
  setupCustomSubmit.disabled = busy;
  setupMsg.textContent = busy ? "生成中…" : "";
}

async function fetchState() {
  return fetch("/api/state").then((r) => r.json());
}

async function enterReady(s, { greet } = { greet: false }) {
  sceneId = s.scene?.scene_id ?? null;
  showPlay(s.world.title);
  applyMeta(s);
  if (greet) {
    log.innerHTML = "";
    add("系統", `世界：${s.world.title}。隨便說一句。`, "narration");
  }
}

async function hydrate({ greetIfReady = true } = {}) {
  const s = await fetchState();
  applyMeta(s);
  if (s.needs_setup) {
    showSetup();
    setSetupBusy(s.setup_status === "generating");
    return;
  }
  const shouldGreet = greetIfReady && log.childElementCount === 0;
  await enterReady(s, { greet: shouldGreet });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const player_text = input.value.trim();
  if (!player_text) return;
  add("你", player_text, "you");
  input.value = "";
  input.disabled = true;
  try {
    const body = { player_text };
    if (sceneId) body.scene_id = sceneId;
    const res = await fetch("/api/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    add("敘事", data.gm.narration, "narration");
    for (const line of data.gm.npc_lines) {
      add(line.name || line.npc_id, line.text, "npc");
    }
    const s = await fetchState();
    sceneId = s.scene?.scene_id ?? sceneId;
    applyMeta(s);
  } catch (err) {
    add("錯誤", String(err.message || err), "err");
  } finally {
    input.disabled = false;
    input.focus();
  }
});

document.getElementById("restart").addEventListener("click", async () => {
  log.innerHTML = "";
  const title = worldTitle || "這一局";
  add(
    "系統",
    `畫面已清、session 視覺重開。世界：${title}。KB 與 GM note 仍在；下一句會帶入記憶切片。`,
    "narration",
  );
  const s = await fetchState();
  sceneId = s.scene?.scene_id ?? sceneId;
  applyMeta(s);
});

debugCompactBtn.addEventListener("click", async () => {
  debugCompactBtn.disabled = true;
  debugMsg.textContent = "compact 進行中…";
  try {
    const res = await fetch("/api/debug/session-compact", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    debugMsg.textContent = data.compacted
      ? `已封存 ${data.archive_id}（${data.turn_id}）`
      : `compact 失敗（${data.turn_id}）；活 session 仍在`;
    add("系統", debugMsg.textContent, data.compacted ? "narration" : "err");
    applyMeta(await fetchState());
  } catch (err) {
    debugMsg.textContent = String(err.message || err);
    add("錯誤", debugMsg.textContent, "err");
  } finally {
    debugCompactBtn.disabled = false;
  }
});

document.getElementById("newgame").addEventListener("click", async () => {
  const res = await fetch("/api/new-game", { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    add("錯誤", data.error || res.statusText, "err");
    return;
  }
  log.innerHTML = "";
  sceneId = null;
  worldTitle = null;
  customForm.hidden = true;
  setupMsg.textContent = "";
  showSetup();
  applyMeta({ gm_mode: (await fetchState()).gm_mode, needs_setup: true, debug: false });
});

setupDefaultBtn.addEventListener("click", async () => {
  setSetupBusy(true);
  try {
    const res = await fetch("/api/setup/default", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    const s = await fetchState();
    await enterReady(s, { greet: true });
  } catch (err) {
    setupMsg.textContent = String(err.message || err);
  } finally {
    setSetupBusy(false);
  }
});

setupCustomToggle.addEventListener("click", () => {
  customForm.hidden = !customForm.hidden;
});

customForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setSetupBusy(true);
  try {
    const res = await fetch("/api/setup/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        worldview: document.getElementById("worldview").value,
        protagonist: document.getElementById("protagonist").value,
        extras: document.getElementById("extras").value,
        starting_point: document.getElementById("starting_point").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    const s = await fetchState();
    await enterReady(s, { greet: true });
  } catch (err) {
    setupMsg.textContent = String(err.message || err);
  } finally {
    setSetupBusy(false);
  }
});

hydrate();
