// Validate every data file and write site/data.js.
//   data/chapters.json          the 30 chapters (from scripts/split_chapters.py)
//   data/proposals/chNN.json    every recommendation, page-cited (the inventory)
//   data/findings/chNN.json     what actually happened, per recommendation id
//   data/entries.json           long-form "big stories" that tie several items together
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import Ajv from 'ajv';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const ajv = new Ajv({ allErrors: true });
const errors = [];
function check(schemaPath, data, label) {
  const v = ajv.compile(read(schemaPath));
  if (!v(data)) for (const e of v.errors) errors.push(`${label}${e.instancePath} ${e.message}`);
}
const jsonFiles = dir => existsSync(dir) ? readdirSync(dir).filter(f => /^ch\d\d\.json$/.test(f)).sort() : [];

const chapters = read('data/chapters.json');

// Inventory
const items = [];
const byId = new Map();
for (const f of jsonFiles('data/proposals')) {
  const list = read(`data/proposals/${f}`);
  check('data/proposal-schema.json', list, `proposals/${f}`);
  const n = Number(f.slice(2, 4));
  const ch = chapters.find(c => c.chapter === n);
  for (const p of list) {
    if (p.chapter !== n) errors.push(`proposals/${f}: ${p.id} says chapter ${p.chapter}`);
    if (!p.id.startsWith(`ch${f.slice(2, 4)}-`)) errors.push(`proposals/${f}: id ${p.id} has wrong prefix`);
    if (ch && (p.page < ch.pages[0] || p.page > ch.pages[1])) errors.push(`proposals/${f}: ${p.id} page ${p.page} outside chapter ${ch.pages.join('-')}`);
    if (byId.has(p.id)) errors.push(`duplicate id ${p.id}`);
    const item = { ...p, finding: null, critique: null };
    byId.set(p.id, item);
    items.push(item);
  }
}

// Findings
for (const f of jsonFiles('data/findings')) {
  const list = read(`data/findings/${f}`);
  check('data/finding-schema.json', list, `findings/${f}`);
  for (const r of list) {
    const item = byId.get(r.id);
    if (!item) { errors.push(`findings/${f}: ${r.id} has no matching proposal`); continue; }
    if (item.finding) errors.push(`findings/${f}: ${r.id} researched twice`);
    item.finding = r;
  }
}

// The case against (editorial, but every factual claim sourced)
for (const f of jsonFiles('data/critique')) {
  const list = read(`data/critique/${f}`);
  check('data/critique-schema.json', list, `critique/${f}`);
  for (const r of list) {
    const item = byId.get(r.id);
    if (!item) { errors.push(`critique/${f}: ${r.id} has no matching proposal`); continue; }
    if (item.critique) errors.push(`critique/${f}: ${r.id} written twice`);
    item.critique = r;
  }
}

// Big stories
const stories = read('data/entries.json');
check('data/schema.json', stories, 'entries.json');
for (const s of stories) for (const id of s.proposal_ids || []) if (!byId.has(id)) errors.push(`entries.json: ${s.id} links unknown proposal ${id}`);

if (errors.length) {
  console.error(`${errors.length} problem(s):`);
  for (const e of errors.slice(0, 60)) console.error('  ' + e);
  process.exit(1);
}

const glossary = read('data/glossary.json');
const gIds = new Set();
for (const g of glossary) {
  if (!g.id || !g.term || !g.def || !Array.isArray(g.match) || !g.match.length) errors.push(`glossary: bad entry ${g.id || g.term}`);
  if (gIds.has(g.id)) errors.push(`glossary: duplicate id ${g.id}`);
  gIds.add(g.id);
}
if (errors.length) { for (const e of errors) console.error('  ' + e); process.exit(1); }

const out = { built: new Date().toISOString().slice(0, 10), chapters, items, stories, glossary };
writeFileSync('site/data.js', 'window.P25 = ' + JSON.stringify(out) + ';\n');
const done = items.filter(i => i.finding).length;
console.log(`OK: ${chapters.length} chapters, ${items.length} recommendations (${done} researched), ${stories.length} stories -> site/data.js`);
