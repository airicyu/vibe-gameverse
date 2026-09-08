import type { GeneratedWorld, Primer } from "./schema.ts";

/**
 * 霧港 fixture。summary／private_notes 不得全等或包含測試用 primer。
 * 對局 mock 另見 gm-mock.ts 的 custom 分支。
 */
export function mockGeneratedWorld(_primer: Primer): GeneratedWorld {
  return {
    title: "霧港",
    gm_note:
      "幕：霧港客棧。玩家剛上岸。潮掌櫃在櫃檯。窗外潮聲。本場目標：讓玩家聽見潮燈熄了一盞。鉤子：問熄燈／要床位。",
    gm_canon: [
      "Single opening scene: 霧港客棧 (harbor_inn).",
      "Opening cast: 潮掌櫃 npc_id keeper; player is a salt-stained newcomer id player.",
      "Hook: one tide-lamp on the pier went dark last night. The keeper will not volunteer why.",
      "Do not import characters or places from any other playthrough.",
      "Tone: wet wood, brine, low voices. Adult/NSFW allowed if the player steers there. Never involve minors.",
    ].join("\n"),
    entities: [
      {
        id: "player",
        name: "外鄉人",
        kind: "player",
        summary: "剛下船的旅客，衣襟帶鹽，還沒決定要不要在霧港過夜。",
      },
      {
        id: "keeper",
        name: "潮掌櫃",
        kind: "npc",
        summary: "霧港客棧櫃檯後的瘦高者，說話像報潮汐，不愛解釋熄燈。",
        private_notes: "曉得昨夜碼頭潮燈熄了一盞，疑是有人把油換走。被逼問只報潮時，不說人名。",
      },
      {
        id: "harbor_inn",
        name: "霧港客棧",
        kind: "place",
        summary: "碼頭盡頭唯一還亮燈的木樓。櫃檯、起霧的窗、潮聲。",
      },
    ],
    scene: {
      scene_id: "harbor_inn",
      present: ["player", "keeper"],
      visible: ["counter", "fogged_window", "tide_lamp"],
    },
    relations: [],
  };
}
