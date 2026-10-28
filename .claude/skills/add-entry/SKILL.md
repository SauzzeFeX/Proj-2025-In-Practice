---
name: add-entry
description: Add or update a Project 2025 comparison entry in data/entries.json with verified sources, match rating, and plain-language text. Use when asked to add a topic, refresh a status, or verify an entry.
---

1. Read CLAUDE.md and data/schema.json first.
2. Find the Project 2025 chapter for the idea (name chapter; add page only if you opened the PDF).
3. Search for the action AND the latest court/agency status. Prefer primary sources (court opinion, Federal Register, agency notice, CRS, GAO). Record each source's `type`.
4. Rate `match`: direct (same idea, same mechanism), partial (same goal, different mechanism or scope), broader (general direction only), none (no counterpart found).
5. Fill `uncertain` honestly. Set `as_of` to today.
6. Run `npm run build`. Fix any schema errors. Do not skip validation.
