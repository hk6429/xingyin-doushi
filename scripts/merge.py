import json, re

def parse_year_session(tag):
    # e.g. "90-1-13" -> year=90, session="1", qno=13
    # "112補-4" -> year=112, session="補", qno=4
    # "113-8" -> year=113, session=None, qno=8
    m = re.match(r'^(\d+)-(北北基)-(\d+)$', tag)
    if m:
        return {'year': int(m.group(1)), 'isBu': False, 'session': m.group(2), 'qno': int(m.group(3))}
    m = re.match(r'^(\d+)(補)?-(\d+)(?:-(\d+))?$', tag)
    if not m:
        return None
    year = int(m.group(1))
    is_bu = bool(m.group(2))
    if m.group(4) is not None:
        session = m.group(3)
        qno = int(m.group(4))
    else:
        session = None
        qno = int(m.group(3))
    return {'year': year, 'isBu': is_bu, 'session': session, 'qno': qno}

def level_for_year(year):
    return '基測' if year <= 102 else '會考'

def build_items(groups, type_, prefix):
    items = []
    n = 0
    for g in groups:
        tag = g['tag']
        ys = parse_year_session(tag)
        if ys is None:
            raise ValueError(f'unparseable tag: {tag}')
        n += 1
        item_id = f'{prefix}{n:04d}'
        items.append({
            'id': item_id,
            'type': type_,
            'examTag': tag,
            'year': ys['year'],
            'isBu': ys['isBu'],
            'session': ys['session'],
            'qno': ys['qno'],
            'level': level_for_year(ys['year']),
            'groupMode': g['groupMode'],
            'parts': g['parts'],
        })
    return items

xingxing_groups = json.load(open('data/raw/xingxing_clean_groups.json', encoding='utf-8'))
yinyin_groups = json.load(open('data/raw/yinyin_clean_groups.json', encoding='utf-8'))

xingxing_items = build_items(xingxing_groups, 'xingxing', 'xf')
yinyin_items = build_items(yinyin_groups, 'yinyin', 'xy')

all_items = xingxing_items + yinyin_items
json.dump(all_items, open('data/items.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

total_parts = sum(len(it['parts']) for it in all_items)
print(f'xingxing items: {len(xingxing_items)}, yinyin items: {len(yinyin_items)}')
print(f'total items: {len(all_items)}, total parts: {total_parts}')

# quick level breakdown
from collections import Counter
print(Counter((it['type'], it['level']) for it in all_items))
