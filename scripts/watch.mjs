// Daily watcher: finds new federal actions that may affect tracked recommendations, with no AI and no web search.
//
//   node scripts/watch.mjs                 new Federal Register documents since the last run (default: last 7 days)
//   node scripts/watch.mjs --since 2025-01-20   backfill: everything since a date (use once, for unresearched/flagged items)
//   node scripts/watch.mjs --only open     limit matching to unresearched, flagged, or still-moving items (default)
//   node scripts/watch.mjs --only all      match against every recommendation
//   --min 30 (match strength needed) and --max 40 (most recommendations in one digest) tune the noise
//
// Optional: put CONGRESS_API_KEY=... in .env (free at https://api.congress.gov/sign-up/; 5,000 requests an hour) to also
// check the latest action on every bill number mentioned in the findings.
//
// Writes docs/updates/YYYY-MM-DD.md (the digest a person or an agent reviews) and data/watch/state.json (what was seen).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';

// Keys live in .env (git-ignored), one KEY=value per line; real environment variables win.
const ENV_LINE_BREAK = /\r?\n/;
if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split(ENV_LINE_BREAK)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const today = new Date().toISOString().slice(0, 10);
const STATE = 'data/watch/state.json';
mkdirSync('data/watch', { recursive: true });
mkdirSync('docs/updates', { recursive: true });
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { lastRun: null, seenDocs: {}, bills: {} };

const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const since = arg('--since', state.lastRun || daysAgo(7));
const only = arg('--only', 'open');

/* ---------- load the recommendations ---------- */
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const chFiles = dir => readdirSync(dir).filter(f => /^ch\d\d\.json$/.test(f));
const findings = {};
for (const f of chFiles('data/findings')) for (const x of read(`data/findings/${f}`)) findings[x.id] = x;
let items = [];
for (const f of chFiles('data/proposals')) for (const p of read(`data/proposals/${f}`)) items.push({ ...p, finding: findings[p.id] || null });
const FINAL = new Set(['in-effect', 'ended']);
if (only === 'open') items = items.filter(i => !i.finding || i.finding.recheck || !FINAL.has(i.finding.status));

/* ---------- keyword model: rare, specific words count most ---------- */
const STOP = new Set(('a an the and or of to for in on at by with from into its it is be as that this than their them they should would could will can must may also all any each other such not no more most new use using make allow require end stop let set put give take keep move bring pass federal government agency agencies department program programs policy policies office rule rules secretary act law laws national united states state states public within under over through including include based support ensure plan review provide create eliminate reform restore congress administration president executive order orders revise revised revision changes change these those are were has have been being chapter effect effects information issue issues company companies service services finalized final proposed regulatory regulation regulations current existing related certain additional general provisions').split(' '));
const words = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
const itemWords = items.map(i => new Set(words(i.title + ' ' + i.proposal + ' ' + i.agency)));
const df = {};
for (const ws of itemWords) for (const w of ws) df[w] = (df[w] || 0) + 1;
const idf = w => Math.log(1 + items.length / (df[w] || 1));

/* ---------- 1. Federal Register: pull everything since the last run, match locally ---------- */
async function fetchFR() {
  const docs = [];
  const base = 'https://www.federalregister.gov/api/v1/documents.json?per_page=1000&order=oldest'
    + '&conditions[publication_date][gte]=' + since
    + '&conditions[type][]=RULE&conditions[type][]=PRORULE&conditions[type][]=PRESDOCU'
    + '&fields[]=document_number&fields[]=title&fields[]=type&fields[]=abstract&fields[]=publication_date&fields[]=html_url&fields[]=agencies';
  // The API caps a query at 10,000 results, so a long backfill walks month by month.
  const windows = [];
  let cur = since;
  while (cur <= today) {
    const [y, m] = cur.split('-').map(Number);
    const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // last day of this month
    windows.push([cur, monthEnd < today ? monthEnd : today]);
    cur = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);            // first day of next month
  }
  for (const [start, end] of windows) {
    let url = base.replace('gte]=' + since, 'gte]=' + start) + '&conditions[publication_date][lte]=' + end;
    while (url) {
      const r = await fetch(url, { headers: { 'User-Agent': 'project2025-in-practice watcher' } });
      if (!r.ok) throw new Error('Federal Register API ' + r.status);
      const j = await r.json();
      docs.push(...(j.results || []));
      url = j.next_page_url || null;
    }
  }
  return docs;
}

// Routine paperwork that never carries policy news (thousands a year): skip before matching.
const ROUTINE = /airworthiness directive|safety zone|drawbridge|special local regulation|security zone|anchorage|fisheries of|fishery|quota|harvest|tolerance(s)? |pesticide tolerance|air plan approval|approval and promulgation|implementation plans?;|designation of areas for air quality|amendment of class [a-e] airspace|establishment of class|restricted area|standard instrument approach|ibr approval|technical amendment|correction|civil monetary penalty inflation|adjustment of civil penalt/i;
const MIN_SCORE = Number(arg('--min', 30));
const MAX_ITEMS = Number(arg('--max', 40));

function matchDocs(docs) {
  const hits = {};
  for (const doc of docs) {
    if (state.seenDocs[doc.document_number]) continue;
    if (ROUTINE.test(doc.title)) continue;
    const titleW = new Set(words(doc.title));
    const bodyW = new Set(words(doc.abstract));
    const agencyText = (doc.agencies || []).map(a => (a.name || '') + ' ' + (a.raw_name || '')).join(' ').toLowerCase();
    items.forEach((it, k) => {
      let score = 0, shared = [];
      for (const w of itemWords[k]) {
        const inT = titleW.has(w), inB = bodyW.has(w);
        if (inT || inB) { score += idf(w) * (inT ? 2 : 1); shared.push(w); }
      }
      // Need at least three shared words, and at least one specific word in the document's title.
      if (shared.length < 3 || ![...itemWords[k]].some(w => titleW.has(w) && idf(w) > 3)) return;
      const head = it.agency.split(/[\/,;(]| and /)[0].trim().toLowerCase();
      if (head.length > 2 && agencyText.includes(head)) score *= 1.5;
      if (score >= MIN_SCORE) (hits[it.id] = hits[it.id] || []).push({ score: Math.round(score), shared: shared.slice(0, 6), doc });
    });
  }
  for (const id in hits) hits[id] = hits[id].sort((a, b) => b.score - a.score).slice(0, 3);
  // Keep only the strongest recommendations, so the digest stays short enough to review.
  const top = Object.keys(hits).sort((a, b) => hits[b][0].score - hits[a][0].score).slice(0, MAX_ITEMS);
  return Object.fromEntries(top.map(id => [id, hits[id]]));
}

/* ---------- 2. Congress: latest action on every bill the findings mention (needs a free key) ---------- */
async function checkBills() {
  const key = process.env.CONGRESS_API_KEY;
  if (!key) return { skipped: true, changes: [] };
  const found = new Map();
  const re = /(?<![A-Za-z.])(H\.\s?R\.|S\.)\s?(\d{1,5})\b/g; // the lookbehind skips "U.S. 2026"
  for (const id in findings) {
    const f = findings[id];
    const text = [f.happened, f.legal, f.uncertain, f.closeness].join(' ');
    for (const m of text.matchAll(re)) {
      const type = m[1].startsWith('H') ? 'hr' : 's';
      const k = type + m[2];
      if (!found.has(k)) found.set(k, new Set());
      found.get(k).add(id);
    }
  }
  const changes = [];
  for (const [k, ids] of found) {
    const type = k.startsWith('hr') ? 'hr' : 's', num = k.replace(/^\D+/, '');
    // The key goes in a header (api.data.gov accepts X-Api-Key), so it never appears in a URL or a log line.
    const r = await fetch(`https://api.congress.gov/v3/bill/119/${type}/${num}?format=json`, { headers: { 'X-Api-Key': key } });
    if (r.status === 403) throw new Error('Congress.gov rejected the API key (403). Check CONGRESS_API_KEY in .env.');
    if (!r.ok) continue;
    const bill = (await r.json()).bill || {};
    const act = bill.latestAction ? bill.latestAction.actionDate + ': ' + bill.latestAction.text : '';
    if (act && state.bills[k] !== act) {
      changes.push({ bill: (type === 'hr' ? 'H.R. ' : 'S. ') + num, title: bill.title, action: act, was: state.bills[k] || '(first check)', ids: [...ids] });
      state.bills[k] = act;
    }
    await new Promise(r => setTimeout(r, 250)); // stay well under the API's rate limit
  }
  return { skipped: false, changes };
}

/* ---------- run ---------- */
console.log(`Watching ${items.length} recommendations (${only}); Federal Register since ${since}...`);
const docs = await fetchFR();
const hits = matchDocs(docs);
for (const d of docs) state.seenDocs[d.document_number] = d.publication_date;
const bills = await checkBills();

const byId = Object.fromEntries(items.map(i => [i.id, i]));
const lines = [`# Updates digest, ${today}`, '',
  `Federal Register documents checked: ${docs.length} (rules, proposed rules and presidential documents since ${since}).`,
  `Recommendations with possible new actions: ${Object.keys(hits).length}. Bills with a new latest action: ${bills.skipped ? 'not checked (set CONGRESS_API_KEY)' : bills.changes.length}.`, '',
  'These are candidates found by keyword matching, not confirmed findings. Review each before changing data/findings.', ''];
if (bills.changes.length) {
  lines.push('## Bills that moved', '');
  for (const b of bills.changes) lines.push(`- **${b.bill}** ${b.title || ''}: ${b.action} (was: ${b.was}). Affects: ${b.ids.join(', ')}`);
  lines.push('');
}
lines.push('## Possible new actions, by recommendation', '');
const order = Object.keys(hits).sort((a, b) => hits[b][0].score - hits[a][0].score);
for (const id of order) {
  const it = byId[id], st = it.finding ? it.finding.status + (it.finding.recheck ? ', flagged' : '') : 'not researched';
  lines.push(`### ${id}: ${it.title}`, `Current: ${st}. Chapter ${it.chapter}, p. ${it.page}.`);
  for (const h of hits[id]) lines.push(`- ${h.doc.publication_date} ${h.doc.type}: [${h.doc.title}](${h.doc.html_url}) (score ${h.score}; shared words: ${h.shared.join(', ')})`);
  lines.push('');
}
const out = arg('--out', `docs/updates/${today}.md`);
writeFileSync(out, lines.join('\n'));
state.lastRun = today;
writeFileSync(STATE, JSON.stringify(state));
console.log(`${docs.length} documents, ${order.length} recommendations with candidates. Digest: ${out}`);
