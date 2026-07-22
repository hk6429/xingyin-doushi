import json, glob

items = json.load(open('data/items.json', encoding='utf-8'))

char_dist = {}
for fn in sorted(glob.glob('data/raw/distractors_char_batch_*.json')):
    for e in json.load(open(fn, encoding='utf-8')):
        char_dist[e['key']] = e['distractors']

zhuyin_dist = {}
for fn in sorted(glob.glob('data/raw/distractors_zhuyin_batch_*.json')):
    for e in json.load(open(fn, encoding='utf-8')):
        zhuyin_dist[e['key']] = e['distractors']

missing = []
for it in items:
    for pi, p in enumerate(it['parts']):
        key = f"{it['id']}#{pi}"
        if it['type'] == 'xingxing' and p['mode'] in ('char', 'reading'):
            d = char_dist.get(key)
            if not d:
                missing.append(key)
                continue
            p['distractors'] = d
        elif it['type'] == 'yinyin':
            d = zhuyin_dist.get(key)
            if not d:
                missing.append(key)
                continue
            p['zhuyinDistractors'] = d

print('missing:', len(missing))
if missing:
    print(missing[:20])

json.dump(items, open('data/items.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('done, wrote data/items.json')
