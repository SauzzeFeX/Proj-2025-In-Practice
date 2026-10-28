# Research brief: "what actually happened"

You are researching recommendations from Project 2025's *Mandate for Leadership* to record what the U.S. federal government actually did. This is a neutral, plain-language public tracker for readers of all ages. **Accuracy and honesty about uncertainty matter more than coverage.** Today's date is in the task prompt.

## Input
- `data/proposals/chNN.json`: the recommendations (id, page, title, proposal, quote, agency, needs...). Research only the ids you are assigned.
- `data/entries.json`: existing long-form "big stories" with researched facts and sources. Reuse them when relevant, but re-check anything time-sensitive.

## Output
Write `data/findings/chNN.json` (one file per chapter, an array). Match `data/finding-schema.json` exactly. If the file already exists, **add** to it and keep entries that are already there; never duplicate an id. Fields:

- `id`: the proposal id.
- `status`: one of
  - `in-effect`: carried out, with no court block found
  - `in-effect-challenged`: carried out, but a lawsuit is pending
  - `partly-done`: some of it happened, or a smaller version
  - `partly-blocked`: courts stopped part of it
  - `blocked`: attempted, but stopped by a court
  - `under-review`: started but not finished (a proposed rule, a pending review, a bill moving)
  - `ended`: happened, then expired or was reversed
  - `not-done`: you searched and found no matching action
- `match`: `direct` (same idea, same mechanism), `partial` (same goal, different mechanism or scope), `broader` (only the general direction), `none` (nothing matching found; use this with `not-done`).
- `happened`: 1–3 plain sentences, about an 8th-grade reading level. Who did what, and when. No adjectives that judge.
- `key_dates`: 1–4 `{date, event}` items for the key steps (skip for `not-done`).
- `legal`: the court status, if any. Name the court and the ruling type (preliminary injunction, final ruling, Supreme Court).
- `closeness`: one or two sentences on how the action compares to the recommendation, including what is bigger, smaller, or different.
- `uncertain`: what is not known or could not be confirmed. For `not-done`, say what you searched for.
- `sources`: 1–4 sources. **Every URL must come from a search result or a page you actually fetched; never build or guess a URL.** Prefer primary sources (Federal Register, whitehouse.gov, agency press releases, court opinions, congress.gov, CRS, GAO), then major news outlets (AP, Reuters, NPR, PBS, the large newspapers), then law-firm or academic summaries. Label advocacy groups as `advocacy`. A `not-done` finding may have zero sources.
- `as_of`: today's date.
- `recheck` (optional): set this whenever the finding is weaker than the rules require. Examples: fewer than two searches before `not-done`, a key fact known only from a secondary summary, or a claim you couldn't verify. Write one short sentence saying what needs rechecking. The site shows it as a "Needs recheck" label. When you fix a flagged finding, remove the field.

## Rules
1. **Do not overclaim a match.** An administration action that resembles a recommendation is not proof it came from Project 2025. Rate how closely the *action* matches the *recommendation*, and nothing more.
2. **Do not assume inaction.** Use `not-done` only after at least two targeted searches. If you can't tell, say so in `uncertain` and pick the most cautious status.
   - **Never write a `not-done` finding for an item you could not actually check,** or one you suspect is wrong (for example, you remember reports of an action but couldn't source them). Leave that item out entirely: the site then shows it as "not researched yet," which is the honest state. A flagged `not-done` still tells readers "we looked and found nothing."
3. **Things Congress must do** (laws, funding): check whether a bill passed, including the July 2025 reconciliation law (the "One Big Beautiful Bill Act"), appropriations laws, and rescissions packages.
4. **Recent events:** courts and agencies have moved quickly through 2025–2026. Search for the latest status, and say in `uncertain` how recent your newest source is.
5. **Neutral language.** Describe actions and rulings, not motives or merit. Avoid loaded terms from either side.
6. If several recommendations are covered by one action, write a finding for each, cross-referencing in `closeness`, e.g. "Same executive order as ch05-012."

## Researching when web search is scarce
Web searches are capped per session and shared by every agent. These official sources need no web search:
- **Federal Register API** (rules, proposed rules, executive orders), via Bash + curl: `https://www.federalregister.gov/api/v1/documents.json?per_page=10&order=newest&conditions[term]=<terms>&conditions[publication_date][gte]=2025-01-20`. Add `conditions[agencies][]=<slug>` or `conditions[type][]=PRESDOCU`. Cite each result's `html_url`.
- **CRS report catalog:** `https://www.everycrsreport.com/reports.csv` lists every report. Find titles locally, then fetch the report page.
- **VA press releases:** `https://news.va.gov/wp-json/wp/v2/news-releases?search=<terms>`
- **Enacted laws:** govinfo.gov and congress.gov public-law pages, for the text of laws like P.L. 119-21 (the July 2025 reconciliation law).
- **Local copy of every law passed by the 119th Congress** (131 laws through October 2026): `reference/public-laws-119/`. Search it with grep to confirm whether something became law. It does not cover bills that were introduced but not passed.

## Check your work
From the project folder:
- `npm run build`: validates every file against the schemas. Fix all errors it reports in your file.
- `node scripts/check-links.mjs data/findings/chNN.json`: replace any link marked BROKEN (404 or an error). Links marked "blocked" are fine.

Edit only your own `data/findings/chNN.json` files. Keep scratch files in your own subfolder of the scratchpad (for example `scratchpad/<your chapters>/`); other agents share it.

## Final report (short)
Per chapter: counts by status, the number of `not-done` items, and anything you were unsure about.
