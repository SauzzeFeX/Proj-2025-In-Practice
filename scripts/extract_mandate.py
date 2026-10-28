"""Extract per-page text from the Mandate PDF into reference/mandate/pages.json.
Usage: python -I scripts/extract_mandate.py reference/mandate/mandate.pdf"""
import json, sys
from pypdf import PdfReader
src = sys.argv[1]
r = PdfReader(src)
pages = [(p.extract_text() or '') for p in r.pages]
out = src.rsplit('/', 1)[0] + '/pages.json'
json.dump(pages, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
print(len(pages), 'pages ->', out)
