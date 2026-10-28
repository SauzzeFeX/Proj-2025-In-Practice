(function () {
  'use strict';
  var D = window.P25 || { chapters: [], items: [], stories: [] };
  var ARCHIVE = 'https://archive.org/details/2025-mandate-for-leadership-full_20240706/page/n';
  var PDF_OFFSET = 32; // archive "n" leaf index = printed page + 32

  var STATUS = {
    'in-effect':            { label: 'Done, in effect', icon: '●', cls: 's-done', group: 'done', def: 'Carried out, with no court block found.' },
    'in-effect-challenged': { label: 'Done, challenged in court', icon: '⚖', cls: 's-challenged', group: 'done', def: 'Carried out, but a lawsuit is pending.' },
    'partly-done':          { label: 'Partly done', icon: '◑', cls: 's-partly', group: 'partly', def: 'Some of it has happened, or a smaller version.' },
    'partly-blocked':       { label: 'Partly blocked by courts', icon: '◐', cls: 's-challenged', group: 'partly', def: 'Courts stopped some of it; other parts continue.' },
    'blocked':              { label: 'Blocked by a court', icon: '■', cls: 's-blocked', group: 'blocked', def: 'Attempted, but a court has stopped it.' },
    'under-review':         { label: 'In progress', icon: '…', cls: 's-review', group: 'progress', def: 'An agency or court has started but not finished.' },
    'ended':                { label: 'Happened, then expired or reversed', icon: '○', cls: 's-ended', group: 'ended', def: 'It took effect for a while, then lapsed or was undone.' },
    'not-done':             { label: 'No action found', icon: '–', cls: 's-notdone', group: 'notdone', def: 'We looked and found no matching action.' },
    'unchecked':            { label: 'Not researched yet', icon: ' ', cls: 's-unchecked', group: 'unchecked', def: 'Not checked yet. This does not mean nothing happened.' }
  };
  // Stack order is fixed (validated for color-blind separation in this order): never reorder casually.
  var GROUPS = [
    ['done', 'Done', 'g-done'], ['partly', 'Partly done', 'g-partly'], ['progress', 'In progress', 'g-progress'],
    ['ended', 'Happened, then expired or reversed', 'g-ended'], ['blocked', 'Blocked by courts', 'g-blocked'],
    ['notdone', 'No action found', 'g-notdone'], ['unchecked', 'Not researched yet', 'g-unchecked']
  ];
  var ACTED = ['done', 'partly']; // "carried out in full or in part"
  var MATCH = { direct: ['Direct match', 4], partial: ['Partial match', 3], broader: ['Broad overlap', 2], none: ['No match found', 0] };
  var SRC = { government: 'government', court: 'court', news: 'news', 'law-firm': 'law firm', advocacy: 'advocacy', academic: 'academic' };
  var SIG = { major: 'Major', moderate: 'Moderate', minor: 'Minor' };
  var NEEDS = { executive: 'President or agency can act', congress: 'Needs Congress', either: 'President or Congress', unclear: 'Unclear who acts' };

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function add(parent) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]); return parent; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function statusOf(it) { return it.finding ? it.finding.status : 'unchecked'; }
  function chapterTitle(n) { var c = D.chapters.find(function (c) { return c.chapter === n; }); return c ? c.title : ''; }
  function link(text, href) { var a = el('a', null, text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }

  /* ---------------- glossary: plain-English pop-ups for jargon ---------------- */
  var GLOSS = {};
  (D.glossary || []).forEach(function (g) { GLOSS[g.id] = g; });
  var aliasList = [];
  (D.glossary || []).forEach(function (g) { g.match.forEach(function (a) { aliasList.push({ a: a, id: g.id }); }); });
  aliasList.sort(function (x, y) { return y.a.length - x.a.length; });
  var aliasExact = {}, aliasLower = {};
  // All-caps aliases (EPA, ICE, SEC) only match in exact case, so "ice" or "sec" in ordinary words never trigger.
  function isAcronym(a) { return /^[A-Z0-9&().\-/]+s?$/.test(a) && /[A-Z]/.test(a); }
  aliasList.forEach(function (x) { if (isAcronym(x.a)) aliasExact[x.a] = x.id; else aliasLower[x.a.toLowerCase()] = x.id; });
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
  var termRe = aliasList.length ? new RegExp('(?<![A-Za-z0-9])(' + aliasList.map(function (x) { return esc(x.a); }).join('|') + ')(?![A-Za-z0-9])', 'gi') : null;

  // Returns a fragment with the first mention of each glossary term (per item, via `seen`) turned into a button.
  function gloss(text, seen) {
    var frag = document.createDocumentFragment();
    if (!termRe || !text) { frag.appendChild(document.createTextNode(text || '')); return frag; }
    var last = 0, m;
    termRe.lastIndex = 0;
    while ((m = termRe.exec(text))) {
      var hit = m[1], id = aliasExact[hit] || aliasLower[hit.toLowerCase()];
      if (!id || seen[id]) continue;
      seen[id] = true;
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var b = el('button', 'term', hit); b.type = 'button'; b.dataset.term = id; b.setAttribute('aria-expanded', 'false');
      frag.appendChild(b);
      last = m.index + hit.length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }
  function gp(tag, cls, text, seen) { var n = el(tag, cls); n.appendChild(gloss(text, seen)); return n; }

  var gpop = null, gOpenBtn = null;
  function closeGloss() { if (gpop) gpop.hidden = true; if (gOpenBtn) gOpenBtn.setAttribute('aria-expanded', 'false'); gOpenBtn = null; }
  function openGloss(btn) {
    var g = GLOSS[btn.dataset.term]; if (!g) return;
    if (!gpop) { gpop = el('div', 'gpop'); gpop.setAttribute('role', 'dialog'); gpop.hidden = true; document.body.appendChild(gpop); }
    if (gOpenBtn === btn) { closeGloss(); return; }
    closeGloss();
    gpop.textContent = '';
    add(gpop, el('h4', null, g.term), el('p', 'gk', g.kind), el('p', null, g.def));
    var more = el('a', null, 'See all terms in the glossary'); more.href = '#glossary'; gpop.appendChild(more);
    gpop.hidden = false;
    var r = btn.getBoundingClientRect(), pw = gpop.offsetWidth, ph = gpop.offsetHeight;
    var x = Math.min(Math.max(16, r.left), window.innerWidth - pw - 16);
    var y = r.bottom + 8; if (y + ph > window.innerHeight - 8) y = Math.max(8, r.top - ph - 8);
    gpop.style.left = x + 'px'; gpop.style.top = y + 'px';
    btn.setAttribute('aria-expanded', 'true'); gOpenBtn = btn;
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('.term') : null;
    if (t) { e.preventDefault(); e.stopPropagation(); openGloss(t); return; }
    if (gpop && !gpop.contains(e.target)) closeGloss();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeGloss(); });
  window.addEventListener('scroll', closeGloss, { passive: true });

  /* ---------------- "follow this topic": searches of official sources ---------------- */
  var STOP = 'a an the and or of to for in on at by with from into its it is be as that this than their them they should would could will can must may also all any each other such not no more most new use using make allow require end stop let set put give take keep move bring pass'.split(' ');
  function keywords(it) {
    var words = it.title.replace(/[()"“”',:;.!?]/g, ' ').split(/\s+/).filter(function (w) { return w && STOP.indexOf(w.toLowerCase()) < 0; });
    return words.slice(0, 6).join(' ');
  }
  function followBox(it) {
    var q = keywords(it), qe = encodeURIComponent(q);
    var box = el('div', 'follow');
    add(box, el('h4', null, 'Follow this topic'),
      el('p', null, 'Things change after we check them. These searches look for anything newer: "' + q + '". Search results are not sources we have checked.'));
    var ul = el('ul');
    [
      ['Rules and executive orders', 'https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=' + qe + '&order=newest'],
      ['Bills in Congress', 'https://www.congress.gov/search?q=' + encodeURIComponent(JSON.stringify({ source: 'legislation', search: q }))],
      ['Court cases', 'https://www.courtlistener.com/?q=' + qe + '&order_by=dateFiled+desc'],
      ['News', 'https://news.google.com/search?q=' + qe]
    ].forEach(function (l) { var li = el('li'); li.appendChild(link(l[0], l[1])); ul.appendChild(li); });
    box.appendChild(ul);
    return box;
  }

  /* ---------------- "the case against": our argument, with sourced evidence ---------------- */
  function critiqueBox(c, seen) {
    var box = el('section', 'against');
    var head = el('div', 'against-head');
    add(head, el('h4', null, 'The case against'), el('span', 'against-tag', 'Our view, backed by sources'));
    box.appendChild(head);
    box.appendChild(gp('p', 'against-lede', c.case_against, seen));
    if (c.harms && c.harms.length) {
      var ul = el('ul', 'harms');
      c.harms.forEach(function (h) { var li = el('li'); add(li, el('strong', null, h.who + ': ')); li.appendChild(gloss(h.what, seen)); ul.appendChild(li); });
      box.appendChild(block('Who it hurts', ul));
    }
    if (c.history && c.history.length) {
      var hl = el('ul', 'history');
      c.history.forEach(function (h) {
        var li = el('li'); add(li, el('b', null, h.when));
        li.appendChild(gloss(h.what, seen));
        var les = el('p', 'lesson'); add(les, el('strong', null, 'The lesson: ')); les.appendChild(gloss(h.lesson, seen)); li.appendChild(les);
        hl.appendChild(li);
      });
      box.appendChild(block('History shows', hl));
    }
    box.appendChild(block('Evidence', sourcesList(c.sources)));
    if (c.recheck) box.appendChild(el('p', 'recheck', 'Needs recheck: ' + c.recheck));
    return box;
  }

  /* ---------------- glossary view ---------------- */
  function renderGlossary() {
    var host = $('gl-list'), q = norm($('gl-q').value).trim();
    host.textContent = '';
    var kinds = [];
    (D.glossary || []).forEach(function (g) { if (kinds.indexOf(g.kind) < 0) kinds.push(g.kind); });
    kinds.sort(function (a, b) { return a === 'Agency' ? 1 : b === 'Agency' ? -1 : a.localeCompare(b); });
    var shownN = 0;
    kinds.forEach(function (k) {
      var list = D.glossary.filter(function (g) { return g.kind === k && (!q || norm(g.term + ' ' + g.def + ' ' + g.match.join(' ')).indexOf(q) >= 0); });
      if (!list.length) return;
      list.sort(function (a, b) { return a.term.localeCompare(b.term); });
      var sec = el('section', 'gl-group'); sec.appendChild(el('h3', null, k === 'Agency' ? 'Agencies and offices' : k));
      var dl = el('dl', 'gl-list');
      list.forEach(function (g) { var dt = el('dt', null, g.term); dt.id = 'term-' + g.id; add(dl, dt, el('dd', null, g.def)); shownN++; });
      sec.appendChild(dl); host.appendChild(sec);
    });
    $('gl-count').textContent = shownN + ' terms';
  }

  /* ---------------- progress by agency ---------------- */
  // Agency strings vary ("State", "State Department", "DHS / ICE"); fold them into readable groups.
  var AGENCY = {
    'Congress': 'Congress (needs a new law)', 'White House': 'White House', 'President': 'White House', 'Office of Presidential Personnel': 'White House',
    'EOP': 'White House', 'NSC': 'National Security Council', 'National Security Council': 'National Security Council', 'OMB': 'Office of Management and Budget',
    'OSTP': 'White House science office (OSTP)', 'ONDCP': 'White House drug policy office (ONDCP)', 'CEQ': 'White House environment council (CEQ)',
    'HHS': 'Health and Human Services', 'CMS': 'Health and Human Services', 'FDA': 'Health and Human Services', 'CDC': 'Health and Human Services', 'NIH': 'Health and Human Services',
    'DOD': 'Defense', 'DoD': 'Defense', 'Pentagon': 'Defense', 'Army': 'Defense', 'Navy': 'Defense', 'Air Force': 'Defense', 'Space Force': 'Defense',
    'EPA': 'Environmental Protection Agency', 'DHS': 'Homeland Security', 'ICE': 'Homeland Security', 'CBP': 'Homeland Security', 'USCIS': 'Homeland Security', 'FEMA': 'Homeland Security', 'TSA': 'Homeland Security',
    'Commerce': 'Commerce', 'USAID': 'Foreign aid (USAID)', 'ED': 'Education', 'Education': 'Education', 'DOE': 'Energy', 'NNSA': 'Energy', 'FERC': 'Energy regulators (FERC, NRC)', 'NRC': 'Energy regulators (FERC, NRC)',
    'State Department': 'State', 'State': 'State', 'Treasury': 'Treasury', 'IRS': 'Treasury', 'DOJ': 'Justice', 'FBI': 'Justice', 'Interior': 'Interior', 'BLM': 'Interior',
    'DOL': 'Labor', 'Labor': 'Labor', 'NLRB': 'Labor', 'EEOC': 'Labor', 'VA': 'Veterans Affairs', 'DOT': 'Transportation', 'FAA': 'Transportation',
    'ODNI': 'Intelligence agencies', 'CIA': 'Intelligence agencies', 'NSA': 'Intelligence agencies', 'SEC': 'Financial regulators (SEC, CFTC, CFPB)', 'CFTC': 'Financial regulators (SEC, CFTC, CFPB)', 'CFPB': 'Financial regulators (SEC, CFTC, CFPB)',
    'USDA': 'Agriculture', 'Small Business Administration': 'Small Business Administration', 'SBA': 'Small Business Administration', 'HUD': 'Housing and Urban Development',
    'FCC': 'Federal Communications Commission', 'OPM': 'Federal workforce (OPM)', 'USAGM': 'Global media (VOA) and public broadcasting', 'CPB': 'Global media (VOA) and public broadcasting',
    'Federal Reserve': 'Federal Reserve', 'USTR': 'Trade Representative', 'FTC': 'Federal Trade Commission', 'FEC': 'Federal Election Commission', 'Export-Import Bank': 'Export-Import Bank'
  };
  function agencyOf(it) {
    var head = it.agency.split(/[\/,;(]| and /)[0].trim();
    return AGENCY[head] || 'Other offices';
  }
  var agencyRendered = false;
  function renderAgencies() {
    if (agencyRendered) return; agencyRendered = true;
    var groups = {};
    D.items.forEach(function (it) { var a = agencyOf(it); (groups[a] = groups[a] || []).push(it); });
    var names = Object.keys(groups).sort(function (a, b) {
      if (a === 'Other offices') return 1; if (b === 'Other offices') return -1;
      return groups[b].length - groups[a].length;
    });
    var host = $('agmap'), list = el('div', 'chrows');
    names.forEach(function (n) {
      var its = groups[n], t = tally(its), s = actedShare(t), left = its.length - s.checked;
      var a = el('div', 'chrow agrow');
      var name = el('span', 'cr-name'); name.appendChild(el('strong', null, n));
      var meta = el('span', 'cr-meta muted small', its.length + ' recs · ' + s.checked + ' checked' + (left ? ' · ' + left + ' not yet' : ''));
      var val = el('span', 'cr-val');
      if (s.checked >= 5) add(val, el('b', null, s.pct + '%'), el('span', 'small muted', ' carried out'));
      else if (s.checked) add(val, el('b', null, s.acted + ' of ' + s.checked), el('span', 'small muted', ' carried out'));
      else val.appendChild(el('span', 'small muted', 'not checked yet'));
      add(a, name, meta, stackBar(t, its.length, n), val);
      list.appendChild(a);
    });
    host.appendChild(list);
  }
  function setGrouping(byAgency) {
    $('map').hidden = byAgency; $('agmap').hidden = !byAgency;
    $('by-chapter').setAttribute('aria-pressed', String(!byAgency)); $('by-agency').setAttribute('aria-pressed', String(byAgency));
    $('ch-h').textContent = byAgency ? 'Progress by agency' : 'Progress by chapter';
    if (byAgency) renderAgencies();
  }

  /* ---------------- countdowns ---------------- */
  // Times are U.S. Eastern: Election Day counts down to midnight; swearing-in dates to noon.
  var DATES = [
    { name: 'Midterm elections', when: '2026-11-03T05:00:00Z', sub: 'Tuesday, November 3, 2026', note: 'Every House seat and about a third of the Senate are on the ballot.',
      acts: [['Check your registration and polling place', 'https://vote.gov/'], ['Find your representative', 'https://www.house.gov/representatives/find-your-representative']] },
    { name: 'New Congress takes office', when: '2027-01-03T17:00:00Z', sub: 'Sunday, January 3, 2027, noon', note: 'The Congress elected in November starts work, including on funding and oversight.',
      acts: [['Contact your senators', 'https://www.senate.gov/senators/senators-contact.htm'], ['Comment on proposed rules', 'https://www.regulations.gov/']] },
    { name: '2028 presidential election', when: '2028-11-07T05:00:00Z', sub: 'Tuesday, November 7, 2028', note: 'The presidency, every House seat and about a third of the Senate.',
      acts: [['Register or check your registration', 'https://vote.gov/']] },
    { name: 'End of the current term', when: '2029-01-20T17:00:00Z', sub: 'Saturday, January 20, 2029, noon', note: 'The constitutional end of this presidential term.',
      acts: [['Find your representative', 'https://www.house.gov/representatives/find-your-representative']] }
  ];
  // A live clock: four boxes (days, hours, minutes, seconds) that tick every second.
  var CLOCK_UNITS = [['d', 'days'], ['h', 'hours'], ['m', 'min'], ['s', 'sec']];
  function makeClock(host) {
    host.textContent = '';
    var parts = {};
    CLOCK_UNITS.forEach(function (u) {
      var box = el('div', 'clock-box'); var n = el('span', 'clock-n', '0'); add(box, n, el('span', 'clock-u', u[1]));
      host.appendChild(box); parts[u[0]] = n;
    });
    return parts;
  }
  function setClock(parts, ms) {
    if (ms < 0) ms = 0;
    var v = { d: Math.floor(ms / 86400000), h: Math.floor(ms % 86400000 / 3600000), m: Math.floor(ms % 3600000 / 60000), s: Math.floor(ms % 60000 / 1000) };
    CLOCK_UNITS.forEach(function (u) {
      var t = u[0] === 'd' ? v.d.toLocaleString() : String(v[u[0]]).padStart(2, '0');
      if (parts[u[0]].textContent !== t) parts[u[0]].textContent = t;
    });
  }
  var cdEls = [], topClock = null, topFor = null;
  function renderCountdowns() {
    var host = $('countdowns');
    DATES.forEach(function (d) {
      var c = el('article', 'cd');
      var clock = el('div', 'clock small-clock'); clock.setAttribute('role', 'timer');
      var past = el('p', 'cd-past', ''); past.hidden = true;
      add(c, el('h3', null, d.name), el('p', 'cd-when', d.sub), clock, past, el('p', 'cd-note small muted', d.note));
      var ul = el('ul', 'cd-acts');
      d.acts.forEach(function (a) { var li = el('li'); li.appendChild(link(a[0], a[1])); ul.appendChild(li); });
      c.appendChild(ul);
      host.appendChild(c);
      cdEls.push({ d: d, parts: makeClock(clock), clock: clock, past: past, card: c });
    });
    topClock = makeClock($('top-clock'));
    tickCountdowns();
    setInterval(tickCountdowns, 1000);
  }
  function tickCountdowns() {
    var now = Date.now(), next = null;
    cdEls.forEach(function (x) {
      var ms = new Date(x.d.when).getTime() - now;
      if (ms <= 0) {
        x.clock.hidden = true; x.past.hidden = false; x.card.classList.add('past');
        x.past.textContent = ms > -86400000 ? 'Happening today' : 'This date has passed';
        return;
      }
      if (!next) next = x;
      setClock(x.parts, ms);
      x.card.classList.toggle('soon', ms < 30 * 86400000);
    });
    if (next && topClock) {
      if (topFor !== next) {
        topFor = next;
        $('top-cd-name').textContent = next.d.name;
        $('top-cd-when').textContent = next.d.sub;
        $('top-cd-link').textContent = next.d.acts[0][0];
        $('top-cd-link').href = next.d.acts[0][1];
      }
      setClock(topClock, new Date(next.d.when).getTime() - now);
    }
  }

  /* ---------------- timeline ---------------- */
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var MLONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // Turn the many date spellings in the data ("2025-07-14", "Feb 20, 2026", "Early Feb 2026", "2025-03") into {y, m, d}.
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s);
    if (m) return { y: +m[1], m: +m[2] - 1, d: m[3] ? +m[3] : 15, exact: !!m[3] };
    m = /\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})?(?:[-–]\d{1,2})?,?\s*(\d{4})\b/.exec(s);
    if (m && MONTHS.indexOf(m[1].toLowerCase()) >= 0) return { y: +m[3], m: MONTHS.indexOf(m[1].toLowerCase()), d: m[2] ? +m[2] : 15, exact: !!m[2] };
    return null;
  }
  var COURT = /\b(court|judge|justices?|injunction|enjoin|vacat|ruled|ruling|lawsuit|sued|sues|appeal|circuit|stay(ed)?|certiorari|plaintiffs?)\b/i;
  var CONGRESS = /\b(congress|(?<!white )house|senate|bill|signed into law|law (was )?signed|act\b.*(passed|signed)|reconciliation|appropriations|p\.l\.|rescission)/i;
  var TL_TYPES = [
    ['action', 'Executive actions', 'g-done'],
    ['congress', 'Congress', 'g-partly'],
    ['court', 'Courts and lawsuits', 'g-blocked']
  ];
  var tl = null;
  function buildTimeline() {
    var start = { y: 2025, m: 0 }, now = new Date(), end = { y: now.getFullYear(), m: now.getMonth() };
    var nMonths = (end.y - start.y) * 12 + (end.m - start.m) + 1;
    var events = [];
    function addEv(k, it, title, status) {
      var p = parseDate(k.date); if (!p) return;
      var idx = (p.y - start.y) * 12 + (p.m - start.m);
      if (idx < 0 || idx >= nMonths) return;
      if (p.y === 2025 && p.m === 0 && p.d < 20) return; // before Inauguration Day
      var type = COURT.test(k.event) ? 'court' : CONGRESS.test(k.event) ? 'congress' : 'action';
      var shown = MLONG[p.m].slice(0, 3) + ' ' + (p.exact ? p.d + ', ' : '') + p.y;
      events.push({ idx: idx, day: p.d, date: shown, text: k.event, type: type, id: it ? it.id : null, story: it ? null : title, title: it ? it.title : title, status: status });
    }
    D.items.forEach(function (it) { if (it.finding) (it.finding.key_dates || []).forEach(function (k) { addEv(k, it, null, it.finding.status); }); });
    D.stories.forEach(function (s) { s.happened.key_dates.forEach(function (k) { addEv(k, null, s.title, s.status); }); });
    var counts = [];
    for (var i = 0; i < nMonths; i++) counts.push({ action: 0, congress: 0, court: 0 });
    events.forEach(function (e) { counts[e.idx][e.type]++; });
    var cum = [], run = { action: 0, congress: 0, court: 0 };
    counts.forEach(function (c) { TL_TYPES.forEach(function (t) { run[t[0]] += c[t[0]]; }); cum.push({ action: run.action, congress: run.congress, court: run.court }); });
    tl = { start: start, n: nMonths, events: events, counts: counts, cum: cum, sel: nMonths - 1 };
    var lg = $('tl-legend');
    TL_TYPES.forEach(function (t) { var li = el('li'); add(li, el('i', t[2])); li.appendChild(document.createTextNode(t[1] + ' (' + run[t[0]].toLocaleString() + ')')); lg.appendChild(li); });
    var sl = $('tl-slider'); sl.max = nMonths - 1; sl.value = nMonths - 1;
    sl.addEventListener('input', function () { tl.sel = +sl.value; drawTimeline(); });
    $('tl-play').addEventListener('click', togglePlay);
  }
  function monthLabel(idx, long) { var y = tl.start.y + Math.floor((tl.start.m + idx) / 12), m = (tl.start.m + idx) % 12; return (long ? MLONG[m] : MLONG[m].slice(0, 3)) + ' ' + y; }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs) { var n = document.createElementNS(SVGNS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
  function drawTimeline() {
    if (!tl) return;
    var host = $('tl-chart'), W = Math.max(300, host.clientWidth), H = Math.min(320, Math.max(200, W * 0.38));
    var pad = { l: 44, r: 12, t: 12, b: 28 }, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var total = tl.cum[tl.n - 1], ymax = total.action + total.congress + total.court || 1;
    var step = ymax > 1000 ? 250 : ymax > 400 ? 100 : 50, top = Math.ceil(ymax / step) * step;
    var x = function (i) { return pad.l + (tl.n === 1 ? 0 : i / (tl.n - 1) * iw); };
    var y = function (v) { return pad.t + ih - v / top * ih; };
    host.textContent = '';
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Cumulative actions, laws and court events by month' });
    for (var g = 0; g <= top; g += step) {
      svg.appendChild(sv('line', { x1: pad.l, x2: W - pad.r, y1: y(g), y2: y(g), class: 'tl-grid' }));
      var tx = sv('text', { x: pad.l - 6, y: y(g) + 4, class: 'tl-axis', 'text-anchor': 'end' }); tx.textContent = g.toLocaleString(); svg.appendChild(tx);
    }
    for (var i = 0; i < tl.n; i += 3) {
      var anchor = i === 0 ? 'start' : (x(i) > W - pad.r - 30 ? 'end' : 'middle');
      var t = sv('text', { x: x(i), y: H - 8, class: 'tl-axis', 'text-anchor': anchor }); t.textContent = monthLabel(i); svg.appendChild(t);
    }
    // Stacked cumulative areas, bottom to top: actions, Congress, courts.
    var base = []; for (var b = 0; b < tl.n; b++) base.push(0);
    TL_TYPES.forEach(function (tt) {
      var topPts = [], botPts = [];
      for (var i = 0; i < tl.n; i++) { var v0 = base[i], v1 = v0 + tl.cum[i][tt[0]]; topPts.push(x(i) + ',' + y(v1)); botPts.unshift(x(i) + ',' + y(v0)); base[i] = v1; }
      svg.appendChild(sv('polygon', { points: topPts.concat(botPts).join(' '), class: 'tl-area ' + tt[2] }));
      svg.appendChild(sv('polyline', { points: topPts.join(' '), class: 'tl-line ' + tt[2] + '-stroke' }));
    });
    // Everything after the selected month is dimmed, so the eye reads "up to here".
    var px = x(tl.sel);
    if (tl.sel < tl.n - 1) svg.appendChild(sv('rect', { x: px, y: pad.t, width: W - pad.r - px, height: ih, class: 'tl-future' }));
    svg.appendChild(sv('line', { x1: px, x2: px, y1: pad.t, y2: pad.t + ih, class: 'tl-head' }));
    svg.appendChild(sv('circle', { cx: px, cy: y(base[tl.sel]), r: 5, class: 'tl-dot' }));
    // Hover: nearest month shows its numbers; click jumps there.
    var hit = sv('rect', { x: pad.l, y: pad.t, width: iw, height: ih, fill: 'transparent' });
    function near(ev) { var r = svg.getBoundingClientRect(); var fx = (ev.clientX - r.left) / r.width * W; return Math.max(0, Math.min(tl.n - 1, Math.round((fx - pad.l) / iw * (tl.n - 1)))); }
    hit.addEventListener('mousemove', function (ev) {
      var i = near(ev), c = tl.counts[i], k = tl.cum[i];
      showTip(ev, monthLabel(i, true) + ': ' + c.action + ' actions, ' + c.congress + ' Congress, ' + c.court + ' court events. Running total ' + (k.action + k.congress + k.court).toLocaleString() + '.');
    });
    hit.addEventListener('mouseleave', hideTip);
    hit.addEventListener('click', function (ev) { tl.sel = near(ev); $('tl-slider').value = tl.sel; drawTimeline(); });
    svg.appendChild(hit);
    host.appendChild(svg);

    var k = tl.cum[tl.sel];
    $('tl-date').textContent = monthLabel(tl.sel, true);
    var tc = $('tl-counts'); tc.textContent = '';
    TL_TYPES.forEach(function (tt) { var d = el('div', 'tl-count'); add(d, el('b', null, k[tt[0]].toLocaleString()), el('span', null, tt[1].toLowerCase() + ' so far')); tc.appendChild(d); });
    renderMonthList();
  }
  function renderMonthList() {
    var list = $('tl-list'); list.textContent = '';
    var evs = tl.events.filter(function (e) { return e.idx === tl.sel; }).sort(function (a, b) { return a.day - b.day; });
    $('tl-month-h').textContent = 'What happened in ' + monthLabel(tl.sel, true) + ' (' + evs.length + ')';
    if (!evs.length) { list.appendChild(el('li', 'muted', 'No dated events recorded for this month.')); return; }
    evs.forEach(function (e) {
      var li = el('li', 'tl-ev');
      var tt = TL_TYPES.find(function (t) { return t[0] === e.type; });
      var dot = el('i', 'dot ' + tt[2]); dot.setAttribute('aria-hidden', 'true');
      var head = el('div', 'tl-ev-head'); add(head, dot, el('span', 'tl-ev-date', e.date), el('span', 'tl-ev-type', tt[1]));
      var title = el('a', 'tl-ev-title', e.title); title.href = e.id ? '#' + e.id : '#stories';
      add(li, head, title, el('p', null, e.text));
      if (e.status && STATUS[e.status]) li.appendChild(badge(e.status));
      list.appendChild(li);
    });
  }
  var playing = null;
  function togglePlay() {
    var btn = $('tl-play');
    if (playing) { clearInterval(playing); playing = null; btn.textContent = 'Play'; btn.setAttribute('aria-pressed', 'false'); return; }
    if (tl.sel >= tl.n - 1) tl.sel = 0;
    btn.textContent = 'Pause'; btn.setAttribute('aria-pressed', 'true');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    playing = setInterval(function () {
      tl.sel = Math.min(tl.n - 1, tl.sel + 1); $('tl-slider').value = tl.sel; drawTimeline();
      if (tl.sel >= tl.n - 1) togglePlay();
    }, reduce ? 1200 : 650);
    drawTimeline();
  }

  /* ---------------- views / routing ---------------- */
  var VIEWS = ['overview', 'all', 'timeline', 'stories', 'glossary', 'method'];
  function route() {
    var h = location.hash.slice(1);
    var view = VIEWS.indexOf(h) >= 0 ? h : 'overview';
    var focus = null;
    if (/^ch\d\d-\d{3}$/.test(h)) { view = 'all'; focus = h; }
    if (/^chapter-\d+$/.test(h)) { view = 'all'; state.chapter = h.split('-')[1]; $('f-chapter').value = state.chapter; renderRows(true); }
    if (D.stories.some(function (s) { return s.id === h; })) { view = 'stories'; focus = h; }
    VIEWS.forEach(function (v) { $('view-' + v).hidden = v !== view; });
    Array.prototype.forEach.call(document.querySelectorAll('.tabrow a'), function (a) {
      if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (focus) {
      if (view === 'all') ensureVisible(focus);
      var t = document.getElementById(focus);
      if (t) { var d = t.querySelector('details'); if (d) d.open = true; t.scrollIntoView(); }
    }
  }

  /* ---------------- overview ---------------- */
  function tally(list) {
    var t = {}; GROUPS.forEach(function (g) { t[g[0]] = 0; });
    list.forEach(function (it) { t[STATUS[statusOf(it)].group]++; });
    return t;
  }
  function pct(n, d) { return d ? Math.round(n / d * 100) : 0; }
  function actedShare(t) {
    var checked = 0, acted = 0;
    GROUPS.forEach(function (g) { if (g[0] !== 'unchecked') checked += t[g[0]]; });
    ACTED.forEach(function (k) { acted += t[k]; });
    return { checked: checked, acted: acted, pct: pct(acted, checked) };
  }

  var tip = null;
  function showTip(ev, text) {
    if (!tip) tip = $('tip');
    tip.textContent = text; tip.hidden = false;
    var r = tip.getBoundingClientRect(), x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - 14;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }

  function stackBar(t, total, label) {
    var bar = el('div', 'bar');
    GROUPS.forEach(function (g) {
      if (!t[g[0]]) return;
      var seg = el('i', g[2]); seg.style.flexGrow = t[g[0]];
      var text = (label ? label + ' — ' : '') + g[1] + ': ' + t[g[0]].toLocaleString() + ' (' + pct(t[g[0]], total) + '% of ' + total.toLocaleString() + ')';
      seg.addEventListener('mousemove', function (ev) { showTip(ev, text); });
      seg.addEventListener('mouseleave', hideTip);
      seg.addEventListener('click', function (ev) { ev.preventDefault(); showTip(ev, text); });
      bar.appendChild(seg);
    });
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', (label ? label + ': ' : '') + GROUPS.filter(function (g) { return t[g[0]]; }).map(function (g) { return g[1] + ' ' + t[g[0]]; }).join(', '));
    return bar;
  }

  function renderOverview() {
    var items = D.items;
    var all = tally(items);
    var majorList = items.filter(function (i) { return i.significance === 'major'; });
    var maj = tally(majorList);
    var share = actedShare(all);

    $('hero-pct').textContent = share.pct;
    $('hero-label').textContent = 'have been carried out in full or in part: ' + share.acted.toLocaleString() + ' of the ' + share.checked.toLocaleString() + ' recommendations researched so far.';
    var researched = share.checked;
    $('prog-pct').textContent = pct(researched, items.length) + '%';
    $('prog-fill').style.width = (researched / items.length * 100) + '%';
    $('prog-label').textContent = researched.toLocaleString() + ' of ' + items.length.toLocaleString() + ' recommendations researched';
    var majChecked = actedShare(maj).checked;
    $('maj-pct').textContent = pct(majChecked, majorList.length) + '%';
    $('maj-fill').style.width = (majChecked / majorList.length * 100) + '%';
    $('maj-label').textContent = majChecked + ' of ' + majorList.length + ' major recommendations researched';

    // Masthead scoreboard: the three numbers that matter most, in the site's colors.
    var ts = $('top-score');
    [[(all.done + all.partly).toLocaleString(), 'carried out in full or in part', 'g-done'],
     [all.blocked.toLocaleString(), 'blocked by courts', 'g-blocked'],
     [all.progress.toLocaleString(), 'still in progress', 'g-progress']].forEach(function (r) {
      var d = el('div', 'ts'); var sw = el('i', 'ts-bar ' + r[2]); sw.setAttribute('aria-hidden', 'true');
      add(d, sw, el('b', null, r[0]), el('span', null, r[1])); ts.appendChild(d);
    });

    var congress = items.filter(function (i) { return i.needs === 'congress'; }).length;
    var stats = [
      [items.length.toLocaleString(), 'recommendations in the plan'],
      [String(D.chapters.length), 'chapters, all covered'],
      [(all.done + all.partly).toLocaleString(), 'carried out in full or in part'],
      [all.blocked.toLocaleString(), 'blocked by courts'],
      [all.notdone.toLocaleString(), 'checked, no action found'],
      [pct(congress, items.length) + '%', 'would need Congress to act']
    ];
    var host = $('stats');
    stats.forEach(function (s) { var d = el('div', 'stat'); add(d, el('b', null, s[0]), el('span', null, s[1])); host.appendChild(d); });

    var lg = $('status-legend');
    GROUPS.forEach(function (g) { var li = el('li'); add(li, el('i', g[2])); li.appendChild(document.createTextNode(g[1] + ' (' + all[g[0]].toLocaleString() + ')')); lg.appendChild(li); });

    var bb = $('bigbars');
    [['All ' + items.length.toLocaleString() + ' recommendations', all, items.length], ['The ' + majorList.length + ' major recommendations', maj, majorList.length]].forEach(function (row) {
      var s = actedShare(row[1]);
      var r = el('div', 'bigbar');
      var head = el('div', 'bigbar-head');
      add(head, el('span', 'bb-name', row[0]), el('span', 'bb-val', s.checked ? s.pct + '% carried out, of ' + s.checked.toLocaleString() + ' checked' : 'Not researched yet'));
      add(r, head, stackBar(row[1], row[2], row[0]));
      bb.appendChild(r);
    });

    var map = $('map');
    var sections = [];
    D.chapters.forEach(function (c) { if (sections.indexOf(c.section) < 0) sections.push(c.section); });
    sections.forEach(function (sec) {
      var box = el('section', 'sec');
      box.appendChild(el('h3', null, sec));
      var list = el('div', 'chrows');
      D.chapters.filter(function (c) { return c.section === sec; }).forEach(function (c) {
        var its = items.filter(function (i) { return i.chapter === c.chapter; });
        var t = tally(its), s = actedShare(t);
        var a = el('a', 'chrow'); a.href = '#chapter-' + c.chapter;
        var name = el('span', 'cr-name');
        add(name, el('span', 'cr-num', String(c.chapter)), el('strong', null, c.title));
        var left = its.length - s.checked;
        var meta = el('span', 'cr-meta muted small', its.length + ' recs · ' + s.checked + ' checked' + (left ? ' · ' + left + ' not yet' : ''));
        var val = el('span', 'cr-val');
        // Below 5 checked items a percentage swings too much to mean anything; show the raw count instead.
        if (s.checked >= 5) { add(val, el('b', null, s.pct + '%'), el('span', 'small muted', ' carried out')); }
        else if (s.checked) { add(val, el('b', null, s.acted + ' of ' + s.checked), el('span', 'small muted', ' carried out')); }
        else val.appendChild(el('span', 'small muted', 'not checked yet'));
        add(a, name, meta, stackBar(t, its.length, 'Chapter ' + c.chapter), val);
        list.appendChild(a);
      });
      box.appendChild(list);
      map.appendChild(box);
    });

    var defs = $('status-defs');
    Object.keys(STATUS).forEach(function (k) { add(defs, el('dt', null, STATUS[k].label), el('dd', null, STATUS[k].def)); });
    $('built').textContent = D.built || '';
  }

  /* ---------------- browse ---------------- */
  var state = { q: '', chapter: '', topic: '', status: '', sig: '', needs: '' };
  var PAGE = 40, shown = PAGE;
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' '); }
  function stem(w) { return w.length > 4 ? w.replace(/(es|s)$/, '') : w; }
  var hay = {};
  D.items.forEach(function (it) {
    var f = it.finding || {};
    hay[it.id] = norm([it.title, it.proposal, it.quote, it.agency, it.topic, chapterTitle(it.chapter), f.happened || '', f.legal || '']
      .concat((f.sources || []).map(function (s) { return s.publisher + ' ' + s.label; })).join(' '));
  });
  function filtered() {
    var words = norm(state.q).split(/\s+/).filter(Boolean).map(stem);
    return D.items.filter(function (it) {
      if (state.chapter && it.chapter !== Number(state.chapter)) return false;
      if (state.topic && it.topic !== state.topic) return false;
      if (state.status === 'recheck') { if (!(it.finding && it.finding.recheck)) return false; }
      else if (state.status && STATUS[statusOf(it)].group !== state.status) return false;
      if (state.sig && it.significance !== state.sig) return false;
      if (state.needs && it.needs !== state.needs) return false;
      if (words.length) { var h = hay[it.id]; for (var i = 0; i < words.length; i++) if (h.indexOf(words[i]) < 0) return false; }
      return true;
    }).sort(byOutcome);
  }
  // Default order everywhere: what took effect first, then partly done, in progress, ended, blocked,
  // no action, not researched. Within a group: major before moderate before minor, then plan order.
  var GROUP_RANK = {}; GROUPS.forEach(function (g, i) { GROUP_RANK[g[0]] = i; });
  var SIG_RANK = { major: 0, moderate: 1, minor: 2 };
  function byOutcome(a, b) {
    return (GROUP_RANK[STATUS[statusOf(a)].group] - GROUP_RANK[STATUS[statusOf(b)].group]) ||
      (SIG_RANK[a.significance] - SIG_RANK[b.significance]) ||
      (a.chapter - b.chapter) || (a.page - b.page);
  }
  function sourcesList(sources) {
    var ul = el('ul', 'sources');
    sources.forEach(function (s) {
      var li = el('li');
      add(li, link(s.label, s.url));
      li.appendChild(document.createTextNode(' — ' + s.publisher));
      li.appendChild(el('span', 'tag' + (s.type === 'advocacy' ? ' advocacy' : ''), SRC[s.type]));
      ul.appendChild(li);
    });
    return ul;
  }
  function block(title, node) { var d = el('div', 'block'); add(d, el('h4', null, title), node); return d; }
  function badge(st) {
    var s = STATUS[st]; var g = GROUPS.find(function (x) { return x[0] === s.group; });
    var b = el('span', 'badge st-' + s.group); var dot = el('i', 'dot ' + g[2]); dot.setAttribute('aria-hidden', 'true');
    add(b, dot); b.appendChild(document.createTextNode((s.group === 'blocked' ? '✓ ' : '') + s.label)); return b;
  }
  function matchBadge(m) {
    var b = el('span', 'badge m'); var dots = el('span', 'dots'); dots.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 4; i++) dots.appendChild(el('b', i < MATCH[m][1] ? 'on' : ''));
    add(b, dots); b.appendChild(document.createTextNode(MATCH[m][0])); return b;
  }

  function row(it) {
    var li = el('li', 'item'); li.id = it.id;
    var d = el('details');
    var sum = el('summary');
    var head = el('div', 'ihead');
    add(head, el('span', 'ititle', it.title));
    var meta = el('span', 'imeta');
    add(meta, badge(statusOf(it)), el('span', 'sig sig-' + it.significance, SIG[it.significance]), el('span', 'muted small', 'Ch. ' + it.chapter + ', p. ' + it.page));
    if (it.finding && it.finding.recheck) meta.appendChild(el('span', 'sig recheck-tag', 'Needs recheck'));
    add(sum, head, meta);
    d.appendChild(sum);

    var body = el('div', 'ibody');
    var seen = {};
    var cmp = el('div', 'compare');
    var p1 = el('div', 'pane');
    add(p1, el('h4', null, 'What Project 2025 recommends'), gp('p', null, it.proposal, seen));
    var q = gp('blockquote', 'quote', '“' + it.quote + '”', seen);
    p1.appendChild(q);
    var cite = el('p', 'cite');
    cite.appendChild(document.createTextNode('Mandate for Leadership, Chapter ' + it.chapter + ' (' + chapterTitle(it.chapter) + '), '));
    cite.appendChild(link('page ' + it.page, ARCHIVE + (it.page + PDF_OFFSET) + '/mode/1up'));
    p1.appendChild(cite);
    if (it.contested) p1.appendChild(el('p', 'contested', 'Competing views in this chapter: ' + it.contested));
    p1.appendChild(el('p', 'muted small', it.agency + ' · ' + NEEDS[it.needs]));

    var p2 = el('div', 'pane');
    p2.appendChild(el('h4', null, 'What actually happened'));
    var f = it.finding;
    if (f) {
      add(p2, gp('p', null, f.happened, seen));
      var bs = el('div', 'badges'); add(bs, badge(f.status), matchBadge(f.match)); p2.appendChild(bs);
      if (f.recheck) p2.appendChild(el('p', 'recheck', 'Needs recheck: ' + f.recheck));
    } else {
      add(p2, el('p', 'muted', 'Not researched yet. This does not mean nothing happened; it means this item has not been checked.'));
    }
    add(cmp, p1, p2);
    body.appendChild(cmp);

    if (f) {
      if (f.key_dates && f.key_dates.length) {
        var tl = el('ul', 'timeline');
        f.key_dates.forEach(function (k) { var x = el('li'); add(x, el('b', null, k.date)); x.appendChild(document.createTextNode(k.event)); tl.appendChild(x); });
        body.appendChild(block('Key dates', tl));
      }
      if (f.legal) body.appendChild(block('Courts and limits', gp('p', null, f.legal, seen)));
      body.appendChild(block('How close is the match?', gp('p', null, f.closeness, seen)));
      body.appendChild(block('What is still uncertain', gp('p', null, f.uncertain, seen)));
      if (f.sources.length) body.appendChild(block('Sources', sourcesList(f.sources)));
      body.appendChild(el('p', 'asof', 'Checked: ' + f.as_of));
    }
    if (it.critique) body.appendChild(critiqueBox(it.critique, seen));
    body.appendChild(followBox(it));
    var share = el('a', 'permalink', 'Link to this item'); share.href = '#' + it.id;
    body.appendChild(share);
    d.appendChild(body);
    li.appendChild(d);
    return li;
  }

  var current = [];
  function renderRows(reset) {
    if (reset) shown = PAGE;
    current = filtered();
    var host = $('rows'); host.textContent = '';
    current.slice(0, shown).forEach(function (it) { host.appendChild(row(it)); });
    $('empty').hidden = current.length > 0;
    $('more').hidden = shown >= current.length;
    $('more').textContent = 'Show more (' + (current.length - Math.min(shown, current.length)) + ' left)';
    $('count').textContent = 'Showing ' + Math.min(shown, current.length) + ' of ' + current.length + (current.length !== D.items.length ? ' matching' : '') + ' recommendations';
  }
  function ensureVisible(id) {
    var idx = current.findIndex(function (it) { return it.id === id; });
    if (idx < 0) { state = { q: '', chapter: '', topic: '', status: '', sig: '', needs: '' }; syncInputs(); renderRows(true); idx = current.findIndex(function (it) { return it.id === id; }); }
    if (idx >= shown) { shown = idx + 1; renderRows(false); }
  }
  function syncInputs() {
    $('q').value = state.q; $('f-chapter').value = state.chapter; $('f-topic').value = state.topic;
    $('f-status').value = state.status; $('f-sig').value = state.sig; $('f-needs').value = state.needs;
  }
  function setupBrowse() {
    D.chapters.forEach(function (c) { var o = el('option', null, c.chapter + '. ' + c.title); o.value = c.chapter; $('f-chapter').appendChild(o); });
    var topics = []; D.items.forEach(function (i) { if (topics.indexOf(i.topic) < 0) topics.push(i.topic); }); topics.sort();
    topics.forEach(function (t) { var o = el('option', null, t); o.value = t; $('f-topic').appendChild(o); });
    GROUPS.forEach(function (g) { var o = el('option', null, g[1]); o.value = g[0]; $('f-status').appendChild(o); });
    var rc = el('option', null, 'Needs recheck'); rc.value = 'recheck'; $('f-status').appendChild(rc);
    var timer;
    $('q').addEventListener('input', function (e) { clearTimeout(timer); timer = setTimeout(function () { state.q = e.target.value; renderRows(true); }, 120); });
    [['f-chapter', 'chapter'], ['f-topic', 'topic'], ['f-status', 'status'], ['f-sig', 'sig'], ['f-needs', 'needs']].forEach(function (p) {
      $(p[0]).addEventListener('change', function (e) { state[p[1]] = e.target.value; renderRows(true); });
    });
    $('reset').addEventListener('click', function () { state = { q: '', chapter: '', topic: '', status: '', sig: '', needs: '' }; syncInputs(); renderRows(true); });
    $('more').addEventListener('click', function () { shown += PAGE; renderRows(false); });
    renderRows(true);
  }

  /* ---------------- stories ---------------- */
  var STORY_STATUS = { 'in-effect': 'in-effect', 'in-effect-challenged': 'in-effect-challenged', 'partly-blocked': 'partly-blocked', 'blocked': 'blocked', 'under-review': 'under-review', 'ended': 'ended' };
  function renderStories() {
    var host = $('stories');
    D.stories.forEach(function (e) {
      var c = el('article', 'card'); c.id = e.id;
      var seen = {};
      add(c, el('p', 'topic', e.topic), el('h3', null, e.title), gp('p', 'plain', e.plain, seen));
      var bs = el('div', 'badges'); add(bs, badge(STORY_STATUS[e.status]), matchBadge(e.match)); c.appendChild(bs);
      var d = el('details', 'deep');
      d.appendChild(el('summary', null, 'Go deeper: side by side, timeline, sources'));
      var cmp = el('div', 'compare');
      var p1 = el('div', 'pane'); add(p1, el('h4', null, 'Project 2025 suggested'), gp('p', null, e.proposal.summary, seen), el('small', null, e.proposal.chapter));
      var p2 = el('div', 'pane'); add(p2, el('h4', null, 'What actually happened'), gp('p', null, e.happened.summary, seen));
      add(cmp, p1, p2); d.appendChild(cmp);
      var tl = el('ul', 'timeline');
      e.happened.key_dates.forEach(function (k) { var x = el('li'); add(x, el('b', null, k.date)); x.appendChild(document.createTextNode(k.event)); tl.appendChild(x); });
      d.appendChild(block('Key dates', tl));
      if (e.legal) d.appendChild(block('Courts and limits', el('p', null, e.legal)));
      d.appendChild(block('How close is the match?', el('p', null, e.closeness)));
      d.appendChild(block('What is still uncertain', el('p', null, e.uncertain)));
      if (e.proposal_ids && e.proposal_ids.length) {
        var ul = el('ul', 'related');
        e.proposal_ids.forEach(function (id) {
          var it = D.items.find(function (i) { return i.id === id; });
          if (!it) return;
          var x = el('li'); var a = el('a', null, it.title + ' (p. ' + it.page + ')'); a.href = '#' + id; add(x, a); ul.appendChild(x);
        });
        d.appendChild(block('Related recommendations in the plan', ul));
      }
      d.appendChild(block('Sources', sourcesList(e.sources)));
      d.appendChild(el('p', 'asof', 'Checked: ' + e.as_of));
      c.appendChild(d);
      host.appendChild(c);
    });
  }

  /* ---------------- boot ---------------- */
  $('bigger').addEventListener('click', function () {
    var on = document.documentElement.classList.toggle('big');
    $('bigger').setAttribute('aria-pressed', String(on)); store('p25-big', on ? '1' : '0');
  });
  if (store('p25-big') === '1') { document.documentElement.classList.add('big'); $('bigger').setAttribute('aria-pressed', 'true'); }
  renderOverview();
  setupBrowse();
  renderStories();
  $('gl-q').addEventListener('input', renderGlossary);
  renderGlossary();
  renderCountdowns();
  $('by-chapter').addEventListener('click', function () { setGrouping(false); });
  $('by-agency').addEventListener('click', function () { setGrouping(true); });
  buildTimeline();
  var tlResize;
  window.addEventListener('resize', function () { clearTimeout(tlResize); tlResize = setTimeout(function () { if (!$('view-timeline').hidden) drawTimeline(); }, 150); });
  // Draw after routing has made the tab visible, so the chart can measure its width.
  window.addEventListener('hashchange', function () { if (location.hash === '#timeline') setTimeout(drawTimeline, 0); });
  if (location.hash === '#timeline') setTimeout(drawTimeline, 0);
  route();
  window.addEventListener('hashchange', route);
})();
