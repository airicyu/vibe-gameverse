const log = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const goHomeBtn = document.getElementById("go-home");
const deleteWorldBtn = document.getElementById("delete-world");
const turnBusyEl = document.getElementById("turn-busy");
const turnBusyLabel = document.getElementById("turn-busy-label");
const turnSpinner = document.getElementById("turn-spinner");
const gmChatToggle = document.getElementById("gm-chat-toggle");
const sideDock = document.getElementById("side-dock");
const sideDockCollapse = document.getElementById("side-dock-collapse");
const gmChatPanel = document.getElementById("gm-chat-panel");
const gmChatLog = document.getElementById("gm-chat-log");
const gmChatForm = document.getElementById("gm-chat-form");
const gmChatInput = document.getElementById("gm-chat-input");
const gmChatSend = document.getElementById("gm-chat-send");
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
const templateList = document.getElementById("template-list");
const setupCustomToggle = document.getElementById("setup-custom-toggle");
const setupCustomSubmit = document.getElementById("setup-custom-submit");
const debugPanel = document.getElementById("debug-panel");
const debugToggle = document.getElementById("debug-toggle");
const debugCompactBtn = document.getElementById("debug-compact");
const debugMsg = document.getElementById("debug-msg");
const deleteDialog = document.getElementById("delete-dialog");
const deleteConfirmInput = document.getElementById("delete-confirm");
const deleteMsg = document.getElementById("delete-msg");

let sceneId = null;
let worldTitle = null;
let adjudicationPending = false;
let gmChatOpen = false;
/** @type {null | "gm" | "debug"} */
let sideDockTab = null;
/** @type {string | null} */
let selectedTemplateId = null;

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
  input.placeholder = "輸入回應... (Enter 送出，Shift+Enter 換行)";
}

function setWorldChrome(title) {
  worldTitle = title;
  document.title = title;
  heading.textContent = title;
  input.placeholder = "輸入回應... (Enter 送出，Shift+Enter 換行)";
}

function showHome() {
  document.body.classList.remove("playing");
  homeEl.hidden = false;
  playEl.hidden = true;
  sideDock.hidden = true;
  input.disabled = true;
  adjudicationPending = false;
  debugToggle.hidden = true;
  setSideDock(null);
  renderGmChat([]);
  setNeutralChrome();
}

function showPlay(title) {
  document.body.classList.add("playing");
  homeEl.hidden = true;
  playEl.hidden = false;
  sideDock.hidden = false;
  input.disabled = false;
  sendBtn.disabled = false;
  goHomeBtn.disabled = false;
  deleteWorldBtn.disabled = false;
  setWorldChrome(title);
}

/** 側欄可讀：保留原文換行，並把黏在同一段的 (1)(2)(3) 拆開。不解析 markdown。 */
function formatGmChatText(text, role) {
  const raw = String(text || "").replace(/\r\n/g, "\n");
  if (role === "player") return raw;
  return raw.replace(/([^\n])[ \t]*((?:[（(][123][）)]|[123][.．、]))/g, "$1\n\n$2");
}

function appendGmChatBubble(role, text) {
  const div = document.createElement("div");
  div.className = `bubble ${role === "player" ? "you" : "npc"}`;
  div.innerHTML = `<div class="who"></div><div class="text"></div>`;
  div.querySelector(".who").textContent = role === "player" ? "你" : "GM";
  div.querySelector(".text").textContent = formatGmChatText(text, role);
  gmChatLog.appendChild(div);
  div.scrollIntoView({ block: "end" });
}

function renderGmChat(messages) {
  gmChatLog.innerHTML = "";
  for (const m of messages || []) {
    appendGmChatBubble(m.role, m.text);
  }
}

function debugTabAvailable() {
  return !debugToggle.hidden;
}

function setSideDock(tab) {
  sideDockTab = tab;
  const open = tab != null;
  gmChatOpen = tab === "gm";
  sideDock.classList.toggle("open", open);

  const gmOn = tab === "gm";
  gmChatToggle.setAttribute("aria-expanded", gmOn ? "true" : "false");
  gmChatToggle.classList.toggle("active", gmOn);
  gmChatPanel.hidden = !gmOn;
  gmChatPanel.setAttribute("aria-hidden", gmOn ? "false" : "true");
  gmChatPanel.inert = !gmOn;

  const debugOn = tab === "debug";
  debugToggle.setAttribute("aria-expanded", debugOn ? "true" : "false");
  debugToggle.classList.toggle("active", debugOn);
  debugPanel.hidden = !debugOn;
  debugPanel.setAttribute("aria-hidden", debugOn ? "false" : "true");
  debugPanel.inert = !debugOn;

  sideDockCollapse.disabled = !open;
  sideDockCollapse.setAttribute("aria-hidden", open ? "false" : "true");
  sideDockCollapse.tabIndex = open ? 0 : -1;
}

function setGmChatOpen(open) {
  if (open) setSideDock("gm");
  else if (sideDockTab === "gm") setSideDock(null);
}

function applyAdjudicationChrome() {
  const pending = adjudicationPending;
  gmChatInput.disabled = !pending;
  gmChatSend.disabled = !pending;
  gmChatInput.placeholder = "輸入回應... (Enter 送出，Shift+Enter 換行)";
  if (!pending) return;
  turnBusyEl.hidden = true;
  form.removeAttribute("aria-busy");
  input.disabled = false;
  sendBtn.disabled = false;
  goHomeBtn.disabled = false;
  deleteWorldBtn.disabled = false;
  setGmChatOpen(true);
}

function showStoryGm(gm, playerText) {
  if (playerText) add("你", playerText, "you");
  if (!gm) return;
  if (gm.narration) add("敘事", gm.narration, "narration");
  for (const line of gm.npc_lines || []) {
    add(line.name || line.npc_id, line.text, "npc");
  }
}

/** 對局 turn 等待中 UI（勿與 setSetupBusy 混用；勿用於 gm-chat）。 */
function setTurnBusy(busy) {
  if (busy) {
    adjudicationPending = false;
    turnBusyEl.hidden = false;
    form.setAttribute("aria-busy", "true");
    turnBusyLabel.textContent = "處理中";
    turnSpinner.hidden = false;
    input.disabled = true;
    sendBtn.disabled = true;
    goHomeBtn.disabled = true;
    deleteWorldBtn.disabled = true;
    if (debugTabAvailable()) debugCompactBtn.disabled = true;
    return;
  }
  if (!isPlayingVisible()) {
    turnBusyEl.hidden = true;
    form.removeAttribute("aria-busy");
    input.disabled = true;
    return;
  }
  if (adjudicationPending) {
    applyAdjudicationChrome();
    return;
  }
  turnBusyEl.hidden = true;
  form.removeAttribute("aria-busy");
  turnBusyLabel.textContent = "處理中";
  turnSpinner.hidden = false;
  input.disabled = false;
  sendBtn.disabled = false;
  goHomeBtn.disabled = false;
  deleteWorldBtn.disabled = false;
  if (debugTabAvailable()) debugCompactBtn.disabled = false;
  applyAdjudicationChrome();
  input.focus();
}

function applyMeta(s) {
  if (s.screen !== "playing") {
    debugToggle.hidden = true;
    setSideDock(null);
    return;
  }
  debugToggle.hidden = !s.debug;
  if (!s.debug && sideDockTab === "debug") setSideDock(null);
}

function setSetupBusy(busy) {
  setupDefaultBtn.disabled = busy || customForm.hidden === false || !selectedTemplateId;
  setupCustomToggle.disabled = busy;
  setupCustomSubmit.disabled = busy;
  saveNameInput.disabled = busy;
  for (const btn of templateList.querySelectorAll("button")) btn.disabled = busy;
  setupMsg.textContent = busy ? "生成中…" : "";
}

function isPlayingVisible() {
  return !playEl.hidden;
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
  adjudicationPending = s.adjudication?.status === "pending";
  renderGmChat(s.gm_chat?.messages || []);
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
  if (adjudicationPending) {
    applyAdjudicationChrome();
  } else {
    setGmChatOpen(false);
    applyAdjudicationChrome();
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
    if (data.hard_reject) {
      add("系統", data.notice || "此輸入無法進入本場。", "err");
      return;
    }
    if (data.adjudication?.status === "pending") {
      adjudicationPending = true;
      renderGmChat(data.gm_chat?.messages || []);
      return;
    }
    adjudicationPending = false;
    setGmChatOpen(false);
    if (data.gm) {
      showStoryGm(data.gm, player_text);
    }
    const s = await fetchState();
    sceneId = s.scene?.scene_id ?? sceneId;
    applyMeta(s);
  } catch (err) {
    if (!isPlayingVisible()) return;
    add("錯誤", String(err.message || err), "err");
    try {
      const s = await fetchState();
      adjudicationPending = s.adjudication?.status === "pending";
      if (adjudicationPending) renderGmChat(s.gm_chat?.messages || []);
    } catch {
      /* keep local flag */
    }
  } finally {
    setTurnBusy(false);
  }
});

/** 有內容時 Enter 送出；空白或 Shift+Enter 換行。 */
input.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  if (input.disabled || !input.value.trim()) return;
  e.preventDefault();
  form.requestSubmit();
});

/** 有內容時 Enter 送出；空白或 Shift+Enter 換行。 */
gmChatInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  if (gmChatInput.disabled || !adjudicationPending || !gmChatInput.value.trim()) return;
  e.preventDefault();
  gmChatForm.requestSubmit();
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

document.getElementById("home-new").addEventListener("click", async () => {
  loadStoryEl.hidden = true;
  newStoryEl.hidden = false;
  setupMsg.textContent = "";
  customForm.hidden = true;
  selectedTemplateId = null;
  await loadTemplateList();
});

async function loadTemplateList() {
  templateList.hidden = false;
  templateList.innerHTML = "";
  setupDefaultBtn.disabled = true;
  try {
    const res = await fetch("/api/templates");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    const templates = data.templates || [];
    for (const t of templates) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "template-item";
      btn.dataset.id = t.id;
      btn.innerHTML = `<span class="tpl-name"></span><span class="tpl-blurb"></span>`;
      btn.querySelector(".tpl-name").textContent = t.display_name;
      btn.querySelector(".tpl-blurb").textContent = t.blurb;
      btn.addEventListener("click", () => {
        selectedTemplateId = t.id;
        for (const other of templateList.querySelectorAll(".template-item")) {
          other.classList.toggle("selected", other === btn);
        }
        setupDefaultBtn.disabled = customForm.hidden === false;
      });
      templateList.appendChild(btn);
    }
  } catch (err) {
    setupMsg.textContent = String(err.message || err);
  }
}

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
  if (!selectedTemplateId) {
    setupMsg.textContent = "請先選一套起始劇本。";
    return;
  }
  setSetupBusy(true);
  try {
    const res = await fetch("/api/setup/default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ save_name, template_id: selectedTemplateId }),
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
  templateList.hidden = !customForm.hidden;
  setupDefaultBtn.disabled = customForm.hidden === false || !selectedTemplateId;
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

sideDockCollapse.addEventListener("click", () => {
  setSideDock(null);
});

document.addEventListener("pointerdown", (e) => {
  if (sideDock.hidden || !sideDock.classList.contains("open")) return;
  if (sideDock.contains(e.target)) return;
  setSideDock(null);
});

gmChatToggle.addEventListener("click", () => {
  setGmChatOpen(sideDockTab !== "gm");
});

debugToggle.addEventListener("click", () => {
  if (debugToggle.hidden) return;
  setSideDock(sideDockTab === "debug" ? null : "debug");
});

gmChatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!adjudicationPending) return;
  const text = gmChatInput.value.trim();
  if (!text) return;
  gmChatInput.value = "";
  appendGmChatBubble("player", text);
  gmChatInput.disabled = true;
  gmChatSend.disabled = true;
  try {
    const res = await fetch("/api/gm-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!isPlayingVisible()) return;
    if (!res.ok) {
      if (data.error === "not_playing" || data.needs_setup) {
        log.innerHTML = "";
        await hydrate({ greetIfReady: false });
        return;
      }
      if (data.error === "not_pending") {
        const s = await fetchState();
        adjudicationPending = s.adjudication?.status === "pending";
        renderGmChat(s.gm_chat?.messages || []);
        if (adjudicationPending) applyAdjudicationChrome();
        else setGmChatOpen(false);
        return;
      }
      throw new Error(data.error || res.statusText);
    }
    renderGmChat(data.gm_chat?.messages || []);
    if (data.hard_reject) {
      adjudicationPending = false;
      setGmChatOpen(false);
      add("系統", data.notice || "此輸入無法進入本場。", "err");
      setTurnBusy(false);
      return;
    }
    if (data.adjudication?.status === "pending") {
      adjudicationPending = true;
      applyAdjudicationChrome();
      return;
    }
    adjudicationPending = false;
    setGmChatOpen(false);
    if (data.gm) {
      const s = await fetchState();
      const last = (s.chat_tail || []).at(-1);
      showStoryGm(data.gm, last?.player_text);
      sceneId = s.scene?.scene_id ?? sceneId;
      applyMeta(s);
    }
    setTurnBusy(false);
  } catch (err) {
    if (!isPlayingVisible()) return;
    add("錯誤", String(err.message || err), "err");
    if (adjudicationPending) applyAdjudicationChrome();
  } finally {
    if (adjudicationPending) {
      gmChatInput.disabled = false;
      gmChatSend.disabled = false;
    }
  }
});

hydrate();
