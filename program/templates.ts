export const TEMPLATE_IDS = [
  "rust-lamp",
  "cyberpunk",
  "sword-dungeon",
  "esper-city",
  "mist-rite",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type TemplateCatalogEntry = {
  id: TemplateId;
  display_name: string;
  blurb: string;
};

export const TEMPLATE_CATALOG: readonly TemplateCatalogEntry[] = [
  {
    id: "rust-lamp",
    display_name: "鏽燈酒館",
    blurb: "邊鎮酒館裡，一張蠟封紙條還沒拆開。",
  },
  {
    id: "cyberpunk",
    display_name: "霓虹診所",
    blurb: "雨夜診所裡，一筆不該接的活還亮著。",
  },
  {
    id: "sword-dungeon",
    display_name: "封門前廳",
    blurb: "地城門還鎖著，通緝令在火邊發脆。",
  },
  {
    id: "esper-city",
    display_name: "仲介夜室",
    blurb: "「市區禁止釋放」的告示還新，傳聞已經舊了。",
  },
  {
    id: "mist-rite",
    display_name: "霧隱集會所",
    blurb: "祭日前夜，同一句話對不上三個人的嘴。",
  },
];

export const TEMPLATE_GM_NOTES: Record<TemplateId, string> = {
  "rust-lamp":
    "幕：鏽燈酒館。玩家剛進門。瑪拉在吧台。灰在角落，桌上有蠟封紙條。本場目標：讓玩家碰到那條線索。鉤子：問怪人／走向角落。",
  cyberpunk:
    "幕：霓虹診所。雨夜。醫師與掮客在場。一筆不該接的活還亮著。本場目標：碰到那筆委託。鉤子：問植入物／被抹的記憶。",
  "sword-dungeon":
    "幕：封門前廳。地城門還鎖著。通緝令在火邊發脆。本場目標：碰到封門或通緝。鉤子：問遺物／門為何封。",
  "esper-city":
    "幕：仲介夜室。「市區禁止釋放」告示還新。本場目標：碰到禁令或失控傳聞。鉤子：問告示／目擊者。",
  "mist-rite":
    "幕：霧隱集會所。祭日前夜。同一句話對不上三個人的嘴。本場目標：碰到「今晚不要出門」。鉤子：問口徑／祭典。",
};

export const TEMPLATE_VISIBLE: Record<TemplateId, string[]> = {
  "rust-lamp": ["bar", "corner_table", "rusty_lantern"],
  cyberpunk: ["exam_bed", "rain_window", "job_light"],
  "sword-dungeon": ["campfire", "sealed_door", "wanted_post"],
  "esper-city": ["night_desk", "ban_notice", "waiting_bench"],
  "mist-rite": ["assembly_hearth", "rite_board", "shuttered_window"],
};

export const MIST_RITE_BAN = [
  "雛見澤",
  "寒蟬",
  "ひぐらし",
  "Higurashi",
  "Rika",
  "Satoko",
  "Keiichi",
  "Rena",
  "Mion",
  "Shion",
  "Hanyuu",
  "Oyashiro",
] as const;

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && (TEMPLATE_IDS as readonly string[]).includes(value);
}

export function templatesPayload(): { templates: TemplateCatalogEntry[] } {
  return { templates: [...TEMPLATE_CATALOG] };
}
