# Project 2025 in Practice

A plain-language, source-cited tracker comparing Project 2025 (Heritage Foundation, "Mandate for Leadership") with what the U.S. federal government has actually done. Audience: everyone, all ages. Simple first, "Go deeper" for detail.

## Rules for every entry (data/entries.json)
- One entry = one policy idea. Never merge two ideas to make a match look closer.
- `match` must be one of: direct, partial, broader, none. "none" entries are welcome; they show the project is not cherry-picking.
- Every factual claim about what happened needs at least one source with a working https URL. Prefer court orders, agency notices, CRS/GAO reports; use news/law-firm summaries only as a second layer and label their `type`.
- Percentages are computed only over researched items and always shown with their denominator (see site/app.js actedShare).
- Write at roughly an 8th-grade reading level. When new jargon appears, add it to data/glossary.json (term, aliases in "match", plain definition); the site underlines it automatically.
- Court status changes fast: always set `as_of`, and say what is NOT known in `uncertain`.
- Findings text stays factual and neutral in wording: describe actions and rulings, never motives. The site's editorial view (Project 2025 is harmful) is expressed only through color coding (red = in effect, blue = blocked) and the "Where we stand" note, never inside findings.

## Commands
- `npm run build`   validate data against data/schema.json and write site/data.js
- `npm run dev`     build, then serve ./site locally
- `npm run links`   check every outbound link (run before publishing)
- `npm run lint`    validate the HTML

## Data layout
- `data/proposals/chNN.json`: the full inventory (1,794 recommendations, all 30 chapters). Every quote is checked against its page by `python -I scripts/check_proposals.py data/proposals/*.json`.
- `data/findings/chNN.json`: "what happened" per recommendation. Research rules are in `docs/research-brief.md`; follow them exactly.
- `data/critique/chNN.json`: "The case against" per recommendation (editorial argument; every factual claim sourced). Rules in `docs/critique-brief.md`.
- `data/glossary.json`: plain-English terms; the site underlines them automatically.
- `data/entries.json`: 15 long-form "big stories" linked to inventory ids.
- `reference/mandate/`: the source PDF (archive.org copy, MD5 79a221b2208887ddfa05ac167bd896d0), per-page text, and per-chapter text files. Printed page = PDF page - 33.

## Research status (as of 2026-10-27, end of session 1)
- 1,393 of 1,794 recommendations researched: all 306 major, all but 4 moderate, 397 minor still open.
- 655 findings carry a `recheck` flag, mostly because the session's web-search limit ran out and agents worked from the Federal Register API and official pages only. Use the site's "Needs recheck" filter, or grep for "recheck" in data/findings/.
- "The case against" (data/critique/) exists for 239 of 306 major items; about 67 were skipped on purpose (no honest case) or for lack of a source.
- Unresearched items were left out on purpose rather than guessed (see rule 2 in docs/research-brief.md). Never fill them with unchecked "not-done" findings.
- Next steps, in order: (1) clear `recheck` flags, starting with major items; (2) research the remaining ~400 items; (3) "case against" for skipped majors that have a sourceable case (e.g. mandatory E-Verify, border adjustment tax, warhead and pit production, LNG climate review); (4) re-verify time-sensitive court statuses.
- Free sources that don't use web search: see "Researching when web search is scarce" in docs/research-brief.md, including the local copy of all 119th-Congress laws in reference/public-laws-119/.

## Agents
- Use the cheapest model that can do the job: `haiku` for mechanical work (digest review against `docs/update-brief.md`, data fixes, link repair), `sonnet` for research that needs judgment and sourcing. Prefer `npm run watch` (zero tokens) over any agent for finding new actions.
