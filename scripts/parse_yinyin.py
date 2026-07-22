import json, re, sys

ROWS = json.load(open('data/raw/yinyin_raw.json', encoding='utf-8'))
TAG_RE = re.compile(r'（([^（）]+)）\s*$')
BRACKET_RE = re.compile(r'「([^」]+)」')

def parse_tag(q):
    m = TAG_RE.search(q)
    return m.group(1) if m else None

def strip_tag(q):
    return TAG_RE.sub('', q).strip()

groups = []
cur_tag = None
cur_rows = []
for idx, r in enumerate(ROWS):
    tag = parse_tag(r['q'])
    q_body = strip_tag(r['q'])
    brackets = BRACKET_RE.findall(r['q'])
    a_clean = r['a'].strip().rstrip('。.').strip()
    row = {'idx': idx, 'q': q_body, 'a': a_clean, 'brackets': brackets, 'tag': tag}
    if tag == cur_tag and cur_rows:
        cur_rows.append(row)
    else:
        if cur_rows:
            groups.append({'tag': cur_tag, 'rows': cur_rows})
        cur_tag = tag
        cur_rows = [row]
if cur_rows:
    groups.append({'tag': cur_tag, 'rows': cur_rows})

print(f'total raw rows: {len(ROWS)}, grouped into {len(groups)} tag-groups', file=sys.stderr)

out_groups = []
review = []

for g in groups:
    tag = g['tag']
    rows = g['rows']
    ok = True
    parts = []
    for r in rows:
        br = r['brackets']
        a = r['a'].strip()
        n = len(br)
        if n == 0:
            ok = False
            break
        sep = None
        for cand in ('／', '/', '╱'):
            if cand in a:
                sep = cand
                break
        if n == 1:
            zy = a
            if not zy or sep:
                ok = False
                break
            parts.append({'sentence': r['q'], 'target': br[0], 'correctZhuyin': zy})
            continue
        tokens = [t.strip() for t in a.split(sep)] if sep else [a]
        if len(tokens) == 1:
            tokens = tokens * n
        if len(tokens) != n:
            ok = False
            break
        for b, zy in zip(br, tokens):
            parts.append({'sentence': r['q'], 'target': b, 'correctZhuyin': zy})
    if ok:
        out_groups.append({'tag': tag, 'groupMode': 'single' if len(rows) == 1 else 'multiSentence', 'parts': parts, 'sourceRows': [r['idx'] for r in rows]})
    else:
        review.append({'tag': tag, 'rows': rows})

print(f'clean groups: {len(out_groups)}, needs review: {len(review)}', file=sys.stderr)
total_parts = sum(len(g['parts']) for g in out_groups)
print(f'total parts: {total_parts}', file=sys.stderr)

json.dump(out_groups, open('data/raw/yinyin_clean_groups.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
json.dump(review, open('data/raw/yinyin_needs_review.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
