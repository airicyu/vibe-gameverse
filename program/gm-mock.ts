import type { GmContext, GmOutput, World } from "./schema.ts";

function has(text: string, keys: string[]): boolean {
  const t = text.toLowerCase();
  return keys.some((k) => t.includes(k.toLowerCase()));
}

/**
 * Deterministic mock GM so the turn loop works without a model.
 * Minimal tavern plot: Mara (bartender), Ash (guest), wax-sealed north-road note.
 */
function mockCustomGm(ctx: GmContext): GmOutput {
  const npcId = ctx.scene.present.find((id) => id !== "player") ?? "keeper";
  const ent = ctx.memory_slice.entities.find((e) => e.id === npcId);
  const name = ent?.name ?? npcId;
  const remembered = ctx.memory_slice.episodes[ctx.memory_slice.episodes.length - 1];
  const memoryHint = remembered
    ? `櫃檯後的人看了你一眼，像是還記得：${remembered.summary}。`
    : "潮霧貼著窗。你剛踏進客棧門檻。";
  return {
    narration: `${memoryHint} 窗外潮聲一下一下。`,
    npc_lines: [
      {
        npc_id: npcId,
        name,
        text: remembered
          ? "又是你。潮還沒回頭——先說你要床還是要聽熄燈的事。"
          : "霧港的床位按潮汐算錢。你要聽潮，還是只要一碗湯？",
      },
    ],
    events: [
      {
        actors: ["player", npcId],
        action: "talk_idle",
        result: "keeper_acknowledged",
        summary: remembered
          ? `玩家在客棧繼續交談；對方仍記得先前：${remembered.summary}`
          : "玩家在霧港客棧與掌櫃搭話",
        entity_ids: [npcId, ctx.scene.scene_id, "player"],
      },
    ],
    gm_note: ctx.gm_note.slice(0, 800) || "本場進行中。玩家在霧港客棧。",
    scene: ctx.scene,
    ui: null,
    needs_image: false,
  };
}

export function mockGm(ctx: GmContext, world?: World | null): GmOutput {
  const custom =
    world?.source === "custom" || (world?.source !== "default" && ctx.scene.scene_id !== "tavern");
  if (custom) return mockCustomGm(ctx);

  const text = ctx.player_text;
  const episodes = ctx.memory_slice.episodes.map((e) => e.summary).join(" ");
  const alreadyHasNote = /蠟封|紙條|north road|燈手/.test(episodes);

  const askedStranger = has(text, ["怪人", "陌生人", "角落", "灰", "ash", "stranger", "mysterious"]);
  const approachCorner = has(text, ["角落", "走近", "那桌", "神秘", "灰"]);
  const askNote = has(text, ["信", "紙條", "蠟", "線索", "燈手", "北路", "letter", "note"]);
  const leave = has(text, ["離開", "出門", "再見", "走了", "leave"]);

  if (leave) {
    return {
      narration:
        "你推開酒館門。鏽燈在雨裡晃了一下。瑪拉頭也不抬；角落那人把斗篷又拉緊了些。你還可以再進來——這裡不會忘記你剛說過的話。",
      npc_lines: [
        { npc_id: "bartender", text: "門自己會關。記得把腳上的泥抖掉再進來。" },
      ],
      events: [
        {
          actors: ["player"],
          action: "leave_tavern",
          result: "exited_briefly",
          summary: "玩家暫時離開鏽燈酒館",
          entity_ids: ["tavern", "player"],
        },
      ],
      gm_note:
        "玩家剛離開門口。在場：瑪拉、灰仍在酒館。未決：紙條尚未交給玩家則鉤子仍在。本場目標：線索（蠟封北路紙條）。回來時記得先前對話。",
      scene: ctx.scene,
      ui: null,
      needs_image: false,
    };
  }

  if (askNote && !alreadyHasNote && (askedStranger || approachCorner || episodes.length > 0)) {
    return {
      narration:
        "角落的人把一封蠟封小紙推過桌沿，蠟印裂了一角。你瞥見字跡：北路的燈手三日未歸。瑪拉擦杯子的手停了一拍，又繼續擦。",
      npc_lines: [
        {
          npc_id: "ash",
          text: "別在吧台大聲念。燈手的事，老闆比誰都清楚——她只是不說。",
        },
        {
          npc_id: "bartender",
          text: "……杯子乾了。你要再來一杯，還是把那張紙收好？",
        },
      ],
      events: [
        {
          actors: ["player", "ash"],
          action: "receive_sealed_note",
          result: "obtained_clue",
          summary: "神秘客灰把蠟封紙條交給玩家：北路燈手失蹤",
          entity_ids: ["ash", "sealed_note", "player"],
        },
      ],
      gm_note:
        "小事件已觸發：玩家拿到蠟封紙條。瑪拉知情但防備。灰已露面。本場目標達成一條線索。鉤子：是否追問瑪拉燈手。",
      scene: ctx.scene,
      ui: null,
      needs_image: false,
    };
  }

  if (approachCorner) {
    return {
      narration:
        "你走向靠牆那桌。斗篷底下的人抬起眼，燈火只照到下顎。桌上壓著一小塊深色蠟封。",
      npc_lines: [
        {
          npc_id: "ash",
          text: "坐也行。問也行。把聽到的帶出這扇門——不行。",
        },
      ],
      events: [
        {
          actors: ["player", "ash"],
          action: "approach_corner",
          result: "ash_acknowledged",
          summary: "玩家走近角落，神秘客灰開口示意有話但不准外傳",
          entity_ids: ["ash", "tavern"],
        },
      ],
      gm_note:
        "玩家已正視神秘客灰。瑪拉在吧台留意。未決鉤子：蠟封紙條尚未交出。本場目標：線索。可追問紙條／怪人。",
      scene: ctx.scene,
      ui: null,
      needs_image: false,
    };
  }

  if (askedStranger) {
    return {
      narration:
        "酒館煙味很重。瑪拉擦著杯子，沒抬頭。角落那桌的人把帽沿壓低了一寸。",
      npc_lines: [
        { npc_id: "bartender", text: "怪人？這裡每天都是怪人。你問這個，是想喝還是想找麻煩？" },
      ],
      events: [
        {
          actors: ["player", "bartender"],
          action: "ask_about_strangers",
          result: "bartender_evasive",
          summary: "玩家向老闆打聽怪人，瑪拉含糊帶過",
          entity_ids: ["bartender", "tavern"],
        },
      ],
      gm_note:
        "玩家在打聽怪人；瑪拉防備中。神秘客尚未被玩家走到桌前。鉤子：追問／觀察角落。本場目標：線索。",
      scene: ctx.scene,
      ui: null,
      needs_image: false,
    };
  }

  const remembered = ctx.memory_slice.episodes[ctx.memory_slice.episodes.length - 1];
  const memoryHint = remembered
    ? `瑪拉看了你一眼，像是還記得：${remembered.summary}。`
    : "你剛踏進鏽燈酒館，門軸吱呀一聲。";

  return {
    narration: `${memoryHint} 吧台上的燈芯燒得發焦。瑪拉把抹布搭在肩上。`,
    npc_lines: [
      {
        npc_id: "bartender",
        text: remembered
          ? "又是你。先說你要喝什麼——再提剛才那些事。"
          : "坐。雨天的酒比晴天貴，別跟我討價。",
      },
    ],
    events: [
      {
        actors: ["player", "bartender"],
        action: "talk_idle",
        result: "bartender_acknowledged",
        summary: remembered
          ? `玩家在酒館繼續交談；瑪拉仍記得先前：${remembered.summary}`
          : "玩家在鏽燈酒館與老闆瑪拉搭話",
        entity_ids: ["bartender", "tavern", "player"],
      },
    ],
    gm_note: ctx.gm_note.slice(0, 800) || "玩家在酒館。目標：線索。鉤子：問怪人／角落。",
    scene: ctx.scene,
    ui: null,
    needs_image: false,
  };
}
