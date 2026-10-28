"""Verify each proposal's quote appears on (or next to) its cited page.
Usage: python -I scripts/check_proposals.py data/proposals/ch03.json [more files...]

Matching ignores case, spaces, punctuation and hyphens, so a word split across a line
("finan-\ncial") matches "financial", and a quote that kept the split ("cre-ation") still matches."""
import json, re, sys

pages = json.load(open('reference/mandate/pages.json', encoding='utf-8'))
OFFSET = 33


def squash(s):
    return re.sub(r'[^a-z0-9]+', '', s.lower())


page_text = [squash(t) for t in pages]
bad = 0
for path in sys.argv[1:]:
    items = json.load(open(path, encoding='utf-8'))
    for it in items:
        q = squash(it['quote'])
        win = ''.join(page_text[p + OFFSET - 1] for p in (it['page'] - 1, it['page'], it['page'] + 1) if 23 <= p <= 882)
        if len(q) < 15 or q not in win:
            bad += 1
            print('QUOTE NOT FOUND near page', it['page'], it['id'], '|', it['quote'][:90])
    print(path, len(items), 'items')
sys.exit(1 if bad else 0)
