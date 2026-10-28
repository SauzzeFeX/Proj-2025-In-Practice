# Brief: "The case against"

This site's editorial view is that Project 2025's agenda is harmful. For each assigned recommendation you write **the case against it**: why it is a bad idea, who it hurts, and, where a genuine one exists, a historical parallel showing how something similar went wrong.

This section is openly an argument. **It must still be honest.** A persuasive case built on a made-up statistic or a misremembered history lesson discredits the whole site. So:

## Hard rules
1. **Every factual claim needs a source** you actually found or fetched: numbers, study findings, dates, what happened historically, who was affected. Never build or guess a URL. If you can't source a claim, leave it out.
2. **Historical parallels must be real and genuinely comparable.** Name the specific event, date and place, and say plainly how it resembles the recommendation and where it differs. Good examples: the spoils system and the 1881 assassination of President Garfield that led to the 1883 Pendleton Civil Service Act (for Schedule F); the 1930 Smoot-Hawley Tariff Act and the retaliation that followed (for broad tariffs). If no honest parallel exists, omit `history`. Don't force one.
3. **Prefer strong evidence:** CBO and GAO estimates, inspector general reports, peer-reviewed studies, official data, court findings, and the record of what happened when a policy was tried before (including at the state level). Expert warnings are fine when attributed ("economists at X warned...").
4. **Don't overstate.** Say "would likely," "researchers found," "critics including X argue." Don't claim certain outcomes or invent victims. No insults, no claims about anyone's motives.
5. **Plain language** at about an 8th-grade reading level. Readers of all ages use this site.
6. **Skip items with no real case.** Some recommendations are technical or minor, or even uncontroversial. Skip them rather than padding. Mention skipped ids in your final report.

## Output
Write `data/critique/chNN.json` (one file per chapter, an array) matching `data/critique-schema.json`. If the file exists, add to it; never duplicate an id.
- `id`: the proposal id (see `data/proposals/chNN.json`; read the recommendation, its quote, and the finding in `data/findings/chNN.json`).
- `case_against`: 2–4 sentences, the core argument.
- `harms`: 1–4 `{who, what}`, the specific groups affected and how (e.g. `{"who": "Veterans in rural areas", "what": "..."}`).
- `history` (optional): 0–2 `{when, what, lesson}`.
- `sources`: 1–5, labeled by `type` as in the research brief. Advocacy sources are allowed but label them `advocacy` and don't rely on them alone for numbers.
- `recheck` (optional): set it if a claim is weaker than these rules require.
- `as_of`: today's date.

## Research
Web searches are capped and shared, so use them for the evidence that matters most. Also use the free sources listed in `docs/research-brief.md` (Federal Register API, the CRS report catalog, govinfo), plus gao.gov, cbo.gov and agency inspector general sites. Many findings files already cite useful sources.

## Check
Run `npm run build` (it validates `data/critique/`) and `node scripts/check-links.mjs data/critique/chNN.json`. Edit only your own critique files.
