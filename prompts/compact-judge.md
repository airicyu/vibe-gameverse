# Compact judge

Decide if the living play session should be archived now.

Output ONE JSON object only:
- should_compact: boolean
- reason: short sentence for logs, not for the player
- title: optional human title for this beat if compacting

Do not invent beat_kind. Do not copy the whole transcript.
