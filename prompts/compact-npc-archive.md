# Compact NPC archive + distill

For one importance-2 NPC, output ONE JSON object:
- title: string
- summary: 1–800 UTF-16, this NPC's subjective take on the beat (not world chronicle)
- salient_quotes: 0–3 of { turn_id, speaker, text } — speaker is this npc_id or "player"; text 1–120
- distilled_body: their new current memory. UTF-16 length MUST be < 640.

Reply with that JSON object only. No markdown fences, no trailing commas, no extra prose.
