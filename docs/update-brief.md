# Brief: review the daily digest

Use this for routine updates. It is built to be cheap: you only look at what the watcher flagged.

1. Open the newest file in `docs/updates/`. Each entry is a recommendation plus up to three Federal Register documents that *might* be about it. They are keyword matches, not findings.
2. For each entry, open only the linked document(s), using WebFetch or the Federal Register API (`https://www.federalregister.gov/api/v1/documents/<document_number>.json`). Do not run web searches unless the document points to something you must confirm.
3. Decide:
   - **Not related:** skip it and write nothing.
   - **Related:** update that recommendation's finding in `data/findings/chNN.json` (status, `happened`, `key_dates`, sources, `as_of`), following `docs/research-brief.md`. If the recommendation has no finding yet, write one.
4. A bill that moved (the "Bills that moved" list) only needs its finding's status and `key_dates` updated.
5. Run `npm run build`. Then report one line per change: id, old status -> new status, why.

Never change a finding because of a keyword match alone.
