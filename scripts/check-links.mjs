// Fetch source URLs and report status. Many news sites block automated requests (401/403/429);
// those are flagged "blocked", not "broken".
//   node scripts/check-links.mjs                      every link (stories, findings, methodology)
//   node scripts/check-links.mjs data/findings/ch05.json   just one findings file
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const urls = new Map();
const addSources = (list, label) => { for (const x of list) for (const s of x.sources || []) urls.set(s.url, `${label}:${x.id}`); };
const only = process.argv[2];
if (only) {
  addSources(JSON.parse(readFileSync(only, 'utf8')), only.split('/').pop());
} else {
  addSources(JSON.parse(readFileSync('data/entries.json', 'utf8')), 'story');
  if (existsSync('data/critique')) for (const f of readdirSync('data/critique').filter(f => f.endsWith('.json'))) addSources(JSON.parse(readFileSync(`data/critique/${f}`, 'utf8')), 'critique/' + f);
  if (existsSync('data/findings')) for (const f of readdirSync('data/findings').filter(f => f.endsWith('.json'))) addSources(JSON.parse(readFileSync(`data/findings/${f}`, 'utf8')), f);
  for (const m of readFileSync('site/index.html', 'utf8').matchAll(/href="(https:[^"]+)"/g)) if (!m[1].includes('fonts.')) urls.set(m[1], 'methodology');
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
async function check(url) {
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
    return r.status;
  } catch (err) { return 'ERR ' + (err.cause?.code || err.name); }
}
const list = [...urls];
const results = [];
for (let i = 0; i < list.length; i += 8) {
  results.push(...await Promise.all(list.slice(i, i + 8).map(async ([u, id]) => [await check(u), id, u])));
}
let bad = 0;
for (const [st, id, u] of results.sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
  const label = st === 200 ? 'ok' : [401, 403, 429].includes(st) ? 'blocked' : 'BROKEN';
  if (label === 'BROKEN') bad++;
  if (label !== 'ok') console.log(label.padEnd(8), String(st).padEnd(10), id.padEnd(28), u);
}
console.log(`\n${results.length} links checked, ${results.filter(r => r[0] === 200).length} ok, ${bad} broken`);
process.exit(bad ? 1 : 0);
