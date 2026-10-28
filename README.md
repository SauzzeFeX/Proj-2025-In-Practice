# Project 2025 in Practice

A plain-language, source-cited guide that lines up Project 2025 proposals with what the U.S. federal government actually did, and what courts said. Built for everyone: short cards first, a **Go deeper** view for detail.

## Quick start

```
npm install        # one time
npm run dev        # validates data, serves http://localhost:4173
```

You can also just double-click `site/index.html` after running `npm run build`. It works offline.

## How it is organized

| Path | What it is |
|---|---|
| `data/proposals/` | Every recommendation in the plan, page-cited (the inventory). |
| `data/findings/` | What actually happened, per recommendation. |
| `data/entries.json` | Long-form "big stories" linked to inventory items. |
| `data/schema.json` | Rules every entry must follow (required fields, allowed statuses and match levels, https-only sources). |
| `scripts/build.mjs` | Validates entries and writes `site/data.js`. Fails loudly on mistakes. |
| `scripts/check-links.mjs` | Opens every source link and reports broken ones. |
| `site/` | The website (plain HTML/CSS/JS, no framework). |
| `CLAUDE.md` | Editorial rules for anyone (human or AI) editing entries. |
| `.claude/skills/add-entry/` | A Claude Code skill: "add an entry on X" follows the research + validation steps. |
| `reference/api.congress.gov/` | Library of Congress API docs, for pulling bill data later. |

## Commands

- `npm run build`: validate and rebuild the data file
- `npm run links`: check all source links. Sites that block bots show as "blocked" and are not counted as broken.
- `npm run lint`: validate the HTML

## Editorial method

- **Match levels:** direct, partial, broad overlap, no match found. "No match" entries are included on purpose.
- **Status levels:** done; done but challenged; partly done; partly blocked; blocked; in progress; done then ended; no action found; not researched yet.
- **Percentages are of researched items only,** always shown with their denominator; chapters with fewer than 5 checked items show a count instead. Items vary in size, so percentages are not a measure of importance.
- Every entry says what is still **uncertain** and when its status was last checked.

## Status

- **Inventory:** complete. 1,794 recommendations from all 30 chapters, each with a page number and a verified exact quote.
- **Research:** 293 of the 306 major recommendations are researched; 100 of those are flagged "needs recheck". Moderate and minor items are not researched yet.
- See `CLAUDE.md` (Research status) for the exact list of what is left, and `docs/research-brief.md` for the research rules.
