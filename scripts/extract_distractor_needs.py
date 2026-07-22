import json

items = json.load(open('data/items.json', encoding='utf-8'))

char_needs = []  # mode char/reading -> need 3 distractor chars
zhuyin_needs = []  # yinyin -> need 3 distractor zhuyin strings

for it in items:
    for pi, p in enumerate(it['parts']):
        key = f"{it['id']}#{pi}"
        if it['type'] == 'xingxing':
            if p['mode'] in ('char', 'reading'):
                correct = p['correct'] if p['correct'] else p['target']
                char_needs.append({'key': key, 'sentence': p['sentence'], 'target': p['target'], 'correct': correct, 'mode': p['mode']})
        else:
            zhuyin_needs.append({'key': key, 'sentence': p['sentence'], 'char': p['target'], 'correctZhuyin': p['correctZhuyin']})

print('char_needs:', len(char_needs))
print('zhuyin_needs:', len(zhuyin_needs))

def chunk(lst, n):
    size = (len(lst) + n - 1) // n
    return [lst[i:i+size] for i in range(0, len(lst), size)]

for i, batch in enumerate(chunk(char_needs, 3)):
    json.dump(batch, open(f'data/raw/need_char_batch_{i}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

for i, batch in enumerate(chunk(zhuyin_needs, 4)):
    json.dump(batch, open(f'data/raw/need_zhuyin_batch_{i}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
