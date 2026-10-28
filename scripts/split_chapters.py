"""Split reference/mandate/pages.json into one text file per chapter with printed-page markers.
Printed page = PDF page - OFFSET (verified against chapter headings)."""
import json, os, re, sys
OFFSET = 33
CH = [(1,"White House Office","Taking the Reins of Government",23,42),(2,"Executive Office of the President","Taking the Reins of Government",43,68),
(3,"Central Personnel Agencies: Managing the Bureaucracy","Taking the Reins of Government",69,86),(4,"Department of Defense","The Common Defense",91,132),
(5,"Department of Homeland Security","The Common Defense",133,170),(6,"Department of State","The Common Defense",171,200),
(7,"Intelligence Community","The Common Defense",201,234),(8,"Media Agencies (USAGM and Corporation for Public Broadcasting)","The Common Defense",235,252),
(9,"Agency for International Development","The Common Defense",253,282),(10,"Department of Agriculture","The General Welfare",289,318),
(11,"Department of Education","The General Welfare",319,362),(12,"Department of Energy and Related Commissions","The General Welfare",363,416),
(13,"Environmental Protection Agency","The General Welfare",417,448),(14,"Department of Health and Human Services","The General Welfare",449,502),
(15,"Department of Housing and Urban Development","The General Welfare",503,516),(16,"Department of the Interior","The General Welfare",517,544),
(17,"Department of Justice","The General Welfare",545,580),(18,"Department of Labor and Related Agencies","The General Welfare",581,618),
(19,"Department of Transportation","The General Welfare",619,640),(20,"Department of Veterans Affairs","The General Welfare",641,656),
(21,"Department of Commerce","The Economy",663,690),(22,"Department of the Treasury","The Economy",691,716),
(23,"Export-Import Bank","The Economy",717,730),(24,"Federal Reserve","The Economy",731,744),(25,"Small Business Administration","The Economy",745,764),
(26,"Trade","The Economy",765,824),(27,"Financial Regulatory Agencies (SEC and CFPB)","Independent Regulatory Agencies",829,844),
(28,"Federal Communications Commission","Independent Regulatory Agencies",845,860),(29,"Federal Election Commission","Independent Regulatory Agencies",861,868),
(30,"Federal Trade Commission","Independent Regulatory Agencies",869,882)]
pages = json.load(open('reference/mandate/pages.json', encoding='utf-8'))
os.makedirs('reference/mandate/chapters', exist_ok=True)
meta = []
for n, title, section, a, b in CH:
    parts = [f"# Chapter {n}: {title}\n# Section: {section}\n# Printed pages {a}-{b}\n"]
    for printed in range(a, b + 1):
        txt = pages[printed + OFFSET - 1]
        txt = re.sub(r'[ \t]+', ' ', txt).replace('�', "'")
        parts.append(f"\n[[PAGE {printed}]]\n{txt.strip()}\n")
    open(f'reference/mandate/chapters/ch{n:02d}.txt', 'w', encoding='utf-8').write(''.join(parts))
    meta.append({"chapter": n, "title": title, "section": section, "pages": [a, b]})
json.dump(meta, open('data/chapters.json', 'w', encoding='utf-8'), indent=1)
print('wrote', len(CH), 'chapters')
