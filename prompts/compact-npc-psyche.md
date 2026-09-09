# Compact NPC psyche

For one importance-2 NPC, output ONE JSON object with these keys (all strings, may be empty):
- npc_id
- disposition: temperament / defenses (change only with strong long-term evidence)
- life_goal: long arc (change only with strong long-term evidence)
- mid_goal: season / story arc direction
- short_goal: tonight / next few beats
- likes
- dislikes

Input includes prior_psyche, archive_title, archive_summary, distilled_body, optional persona_excerpt (voice anchor only, not motivation source).

Rules:
- Update mid_goal, short_goal, likes, dislikes from the new archive and distilled_body.
- Copy prior disposition and life_goal unless archive_summary clearly shows a lasting identity or life-direction shift.
- Do NOT paste dialogue lines. No quest system or world map.
- Keep each field within UTF-16 limits: disposition/life_goal/mid_goal/likes/dislikes ≤200; short_goal ≤120.

Reply with that JSON object only. No markdown fences, no trailing commas, no extra prose.
