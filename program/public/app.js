const log = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const restartBtn = document.getElementById("restart");
const goHomeBtn = document.getElementById("go-home");
const deleteWorldBtn = document.getElementById("delete-world");
const turnBusyEl = document.getElementById("turn-busy");
const meta = document.getElementById("meta");
const heading = document.getElementById("heading");
const homeEl = document.getElementById("home");
const playEl = document.getElementById("play");
const newStoryEl = document.getElementById("new-story");
const loadStoryEl = document.getElementById("load-story");
const customForm = document.getElementById("custom-form");
const setupMsg = document.getElementById("setup-msg");
const loadMsg = document.getElementById("load-msg");
const worldList = document.getElementById("world-list");
const saveNameInput = document.getElementById("save-name");
const setupDefaultBtn = document.getElementById("setup-default");
const setupCustomToggle = document.getElementById("setup-custom-toggle");
const setupCustomSubmit = document.getElementById("setup-custom-submit");
const debugPanel = document.getElementById("debug-panel");
const debugCompactBtn = document.getElementById("debug-compact");
const debugMsg = document.getElementById("debug-msg");
const deleteDialog = document.getElementById("delete-dialog");
const deleteConfirmInput = document.getElementById("delete-confirm");
const deleteMsg = document.getElementById("delete-msg");

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

function showGmBubbles(gm) {
  if (!gm) return false;
  if (gm.narration) add("敘事", gm.narration, "narration");
  for (const line of gm.npc_lines || []) {
    add(line.name || line.npc_id, line.text, "npc");
  }
  return Boolean(gm.narration || (gm.npc_lines && gm.npc_lines.length));
}

function showChatTail(entries) {
  if (!entries || !entries.length) return false;
  add("系統", "—— 近期對話 ——", "narration");
  for (const entry of entries) {
    if (!entry.hide_player && entry.player_text) add("你", entry.player_text, "you");
    if (entry.narration) add("敘事", entry.narration, "narration");
    for (const line of entry.npc_lines || []) {
      add(line.name || line.npc_id, line.text, "npc");
    }
  }
  return true;
}

function showEpisodeFallback(episodes) {
  if (!episodes || !episodes.length) return false;
  add("系統", "—— 近期經過（舊存檔無對白尾） ——", "narration");
  for (const ep of episodes) {
    if (ep.summary) add("經過", ep.summary, "narration");
  }
  return true;
}

function setNeutralChrome() {
  document.title = "vibe-gameverse";
  heading.textContent = "vibe-gameverse";
  input.placeholder = "隨便說一句……（Enter 送出，Shift+Enter 換行）";
}

function setWorldChrome(title) {
  worldTitle = title;
  document.title = title;
  heading.textContent = title;
  input.placeholder = `你在「${title}」……（Enter 送出，Shift+Enter 換行）`;
}

function showHome() {
  homeEl.hidden = false;
  playEl.hidden = true;
  input.disabled = true;
  setNeutralChrome();
}

function showPlay(title) {
  homeEl.hidden = true;
  playEl.hidden = false;
  input.disabled = false;
  sendBtn.disabled = false;
  restartBtn.disabled = false;
  goHomeBtn.disabled = false;
  deleteWorldBtn.disabled = false;
  setWorldChrome(title);
}

function applyMeta(s) {
  const mode = s.gm_mode ?? "?";
  if (s.screen !== "playing") {
    meta.textContent = `模式 ${mode} · 主頁`;
    debugPanel.hidden = true;
    return;
  }
  const name = s.world?.save_name ?? s.save?.save_name ?? "";
  meta.textContent = `模式 ${mode}${name ? ` · 「${name}」` : ""} · 已寫 ${s.episode_count} 則 episode · 關係 ${s.relations.length} 條`;
  debugPanel.hidden = !s.debug;
}

function setSetupBusy(busy) {
  setupDefaultBtn.disabled = busy;
  setupCustomToggle.disabled = busy;
  setupCustomSubmit.disabled = busy;
  saveNameInput.disabled = busy;
  setupMsg.textContent = busy ? "生成中…" : "";
}

function isPlayingVisible() {
  return !playEl.hidden;
}

/** 對局 turn 等待中 UI（勿與 setSetupBusy 混用）。 */
function setTurnBusy(busy) {
  if (busy) {
    turnBusyEl.hidden = false;
    form.setAttribute("aria-busy", "true");
    input.disabled = true;
    sendBtn.disabled = true;
    restartBtn.disabled = true;
    goHomeBtn.disabled = true;
    deleteWorldBtn.disabled = true;
    if (!debugPanel.hidden) debugCompactBtn.disabled = true;
    return;
  }
  turnBusyEl.hidden = true;
  form.removeAttribute("aria-busy");
  if (!isPlayingVisible()) {
    input.disabled = true;
    return;
  }
  input.disabled = false;
  sendBtn.disabled = false;
  restartBtn.disabled = false;
  goHomeBtn.disabled = false;
  deleteWorldBtn.disabled = false;
  if (!debugPanel.hidden) debugCompactBtn.disabled = false;
  input.focus();
}

function readSaveName() {
  return (saveNameInput.value || "").trim();
}

async function fetchState() {
  return fetch("/api/state").then((r) => r.json());
}

async function enterReady(s, { greet = false, opening = null } = {}) {
  sceneId = s.scene?.scene_id ?? null;
  showPlay(s.world.save_name || s.save?.save_name);
  applyMeta(s);
  if (greet || opening?.gm) {
    log.innerHTML = "";
    if (opening?.gm) {
      showGmBubbles(opening.gm);
    } else if (showChatTail(s.chat_tail)) {
      /* restored recent dialogue */
    } else if (showEpisodeFallback(s.episodes)) {
      /* pre-chat-tail saves */
    } else {
      const name = s.world?.save_name || s.save?.save_name || "";
      add("系統", name ? `世界：${name}。隨便說一句。` : "隨便說一句。", "narration");
    }
  }
}

function resetHomePanels() {
  newStoryEl.hidden = true;
  loadStoryEl.hidden = true;
  customForm.hidden = true;
  setupMsg.textContent = "";
  loadMsg.textContent = "";
  worldList.innerHTML = "";
}

async function hydrate({ greetIfReady = true } = {}) {
  const s = await fetchState();
  applyMeta(s);
  if (s.screen !== "playing") {
    showHome();
    resetHomePanels();
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
  setTurnBusy(true);
  try {
    const body = { player_text };
    if (sceneId) body.scene_id = sceneId;
    const res = await fetch("/api/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.error === "not_playing" || data.needs_setup) {
        log.innerHTML = "";
        await hydrate({ greetIfReady: false });
        return;
      }
      if (!isPlayingVisible()) return;
      throw new Error(data.error || res.statusText);
    }
    if (!isPlayingVisible()) return;
    add("敘事", data.gm.narration, "narration");
    for (const line of data.gm.npc_lines) {
      add(line.name || line.npc_id, line.text, "npc");
    }
    const s = await fetchState();
    sceneId = s.scene?.scene_id ?? sceneId;
    applyMeta(s);
  } catch (err) {
    if (!isPlayingVisible()) return;
    add("錯誤", String(err.message || err), "err");
  } finally {
    setTurnBusy(false);
  }
});

/** Enter 送出；Shift+Enter 換行。 */
input.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  if (input.disabled) return;
  form.requestSubmit();
});

restartBtn.addEventListener("click", async () => {
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

goHomeBtn.addEventListener("click", async () => {
  const res = await fetch("/api/home", { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    add("錯誤", data.error || res.statusText, "err");
    return;
  }
  log.innerHTML = "";
  sceneId = null;
  worldTitle = null;
  await hydrate({ greetIfReady: false });
});

deleteWorldBtn.addEventListener("click", () => {
  deleteConfirmInput.value = "";
  deleteMsg.textContent = "";
  deleteDialog.showModal();
});

document.getElementById("delete-confirm-btn").addEventListener("click", async () => {
  deleteMsg.textContent = "";
  const res = await fetch("/api/worlds/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: deleteConfirmInput.value }),
  });
  const data = await res.json();
  if (!res.ok) {
    deleteMsg.textContent = data.error || res.statusText;
    return;
  }
  deleteDialog.close();
  log.innerHTML = "";
  sceneId = null;
  worldTitle = null;
  await hydrate({ greetIfReady: false });
});

document.getElementById("home-new").addEventListener("click", () => {
  loadStoryEl.hidden = true;
  newStoryEl.hidden = false;
  setupMsg.textContent = "";
});

document.getElementById("home-load").addEventListener("click", async () => {
  newStoryEl.hidden = true;
  loadStoryEl.hidden = false;
  loadMsg.textContent = "載入清單…";
  worldList.innerHTML = "";
  try {
    const res = await fetch("/api/worlds");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    const worlds = data.worlds || [];
    if (worlds.length === 0) {
      loadMsg.textContent = "尚無可玩存檔。";
      return;
    }
    loadMsg.textContent = "";
    for (const w of worlds) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "world-item";
      btn.innerHTML = `<span class="save-name"></span>`;
      btn.querySelector(".save-name").textContent = w.save_name;
      btn.addEventListener("click", async () => {
        loadMsg.textContent = "載入中…";
        const lr = await fetch("/api/worlds/load", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: w.id }),
        });
        const ld = await lr.json();
        if (!lr.ok) {
          loadMsg.textContent = ld.error || lr.statusText;
          return;
        }
        const s = await fetchState();
        await enterReady(s, { greet: true, opening: ld.opening });
      });
      worldList.appendChild(btn);
    }
  } catch (err) {
    loadMsg.textContent = String(err.message || err);
  }
});

setupDefaultBtn.addEventListener("click", async () => {
  const save_name = readSaveName();
  if (!save_name) {
    setupMsg.textContent = "請先填寫存檔顯示名。";
    return;
  }
  setSetupBusy(true);
  try {
    const res = await fetch("/api/setup/default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ save_name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    const s = await fetchState();
    await enterReady(s, { greet: true, opening: data.opening });
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
  const save_name = readSaveName();
  if (!save_name) {
    setupMsg.textContent = "請先填寫存檔顯示名。";
    return;
  }
  setSetupBusy(true);
  try {
    const res = await fetch("/api/setup/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        save_name,
        worldview: document.getElementById("worldview").value,
        protagonist: document.getElementById("protagonist").value,
        extras: document.getElementById("extras").value,
        starting_point: document.getElementById("starting_point").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    const s = await fetchState();
    await enterReady(s, { greet: true, opening: data.opening });
  } catch (err) {
    setupMsg.textContent = String(err.message || err);
  } finally {
    setSetupBusy(false);
  }
});

hydrate();
