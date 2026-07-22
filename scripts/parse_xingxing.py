import json, re, sys

ROWS = json.load(open('data/raw/xingxing_raw.json', encoding='utf-8'))
TAG_RE = re.compile(r'（([^（）]+)）\s*$')
BRACKET_RE = re.compile(r'「([^」]+)」')
BOPOMOFO_RE = re.compile(r'^[ㄅ-ㄩˊˇˋ˙]+$')

def parse_tag(q):
    m = TAG_RE.search(q)
    return m.group(1) if m else None

def strip_tag(q):
    return TAG_RE.sub('', q).strip()

def is_bopomofo(s):
    return bool(BOPOMOFO_RE.match(s))

clean_groups = []  # list of dict: tag, rows:[{q, a, brackets}]
needs_review = []

# first pass: group consecutive rows by tag
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

items = []
review = []

def make_char_part(sentence, bracket_char, ans_token):
    ans_token = ans_token.strip()
    is_reading = is_bopomofo(bracket_char)
    if ans_token == 'X':
        correct = bracket_char if not is_reading else None
        is_correct_as_is = True
    else:
        correct = ans_token
        is_correct_as_is = False
    return {
        'sentence': sentence,
        'mode': 'reading' if is_reading else 'char',
        'target': bracket_char,
        'correct': correct,
        'isCorrectAsIs': is_correct_as_is,
    }

out_groups = []
for g in groups:
    tag = g['tag']
    rows = g['rows']
    # case: single row containing labeled (甲)(乙)(丙)(丁) sub-answers embedded
    if len(rows) == 1 and re.search(r'\(甲\)|（甲）', rows[0]['q']) and '\n' in rows[0]['a']:
        row = rows[0]
        q = row['q']
        a = row['a']
        # split answer lines like "(甲) X" / "(乙)搓"
        ans_lines = [l.strip() for l in a.split('\n') if l.strip()]
        label_ans = {}
        for l in ans_lines:
            m = re.match(r'\(([甲乙丙丁])\)\s*(.*)', l)
            if m:
                label_ans[m.group(1)] = m.group(2).strip()
        # split question by label markers, each segment has exactly one bracket
        segs = re.split(r'\(([甲乙丙丁])\)', q)
        # segs alternates: [prefix, label, text, label, text, ...]
        parts = []
        ok = True
        for i in range(1, len(segs), 2):
            label = segs[i]
            text = segs[i+1] if i+1 < len(segs) else ''
            br = BRACKET_RE.findall(text)
            if len(br) != 1 or label not in label_ans:
                ok = False
                break
            parts.append(make_char_part(q, br[0], label_ans[label]))
        if ok and len(parts) == len(label_ans):
            out_groups.append({'tag': tag, 'level_hint': None, 'groupMode': 'labeled', 'parts': parts, 'sourceRows': [row['idx']]})
            continue
        else:
            review.append({'tag': tag, 'rows': rows, 'reason': 'labeled-parse-failed'})
            continue

    # case: all rows in group have 0 brackets -> judge-phrase group (idiom/sentence options)
    if all(len(r['brackets']) == 0 for r in rows):
        parts = []
        ok = True
        for r in rows:
            a = r['a'].strip()
            if a == 'X':
                parts.append({'sentence': r['q'], 'mode': 'judge', 'isCorrectAsIs': True, 'answers': []})
            else:
                tokens = re.split(r'[、，,]', a)
                tokens = [t.strip() for t in tokens if t.strip()]
                if not tokens:
                    ok = False
                    break
                parts.append({'sentence': r['q'], 'mode': 'judge', 'isCorrectAsIs': False, 'answers': tokens})
        if ok:
            n_correct = sum(1 for p in parts if p['isCorrectAsIs'])
            group_mode = 'pickCorrect' if (len(parts) > 1 and n_correct == 1) else 'perOption'
            out_groups.append({'tag': tag, 'groupMode': group_mode, 'parts': parts, 'sourceRows': [r['idx'] for r in rows]})
            continue
        else:
            review.append({'tag': tag, 'rows': rows, 'reason': 'judge-parse-failed'})
            continue

    # case: rows each with exactly 1 or 2 brackets, simple X / single-token / slash-pair answers
    ok = True
    parts = []
    for r in rows:
        br = r['brackets']
        a = r['a'].strip()
        if len(br) == 1:
            if a == 'X' or (len(a) <= 2 and '／' not in a and '/' not in a and '\n' not in a):
                parts.append(make_char_part(r['q'], br[0], a))
            else:
                ok = False
                break
        elif len(br) == 2:
            sep = '／' if '／' in a else ('/' if '/' in a else None)
            if a == 'X':
                parts.append(make_char_part(r['q'], br[0], 'X'))
                parts.append(make_char_part(r['q'], br[1], 'X'))
            elif sep:
                tokens = [t.strip() for t in a.split(sep)]
                if len(tokens) == 2 and all(len(t) <= 1 or t == 'X' for t in tokens):
                    parts.append(make_char_part(r['q'], br[0], tokens[0]))
                    parts.append(make_char_part(r['q'], br[1], tokens[1]))
                else:
                    ok = False
                    break
            else:
                ok = False
                break
        else:
            ok = False
            break
    if ok:
        out_groups.append({'tag': tag, 'groupMode': 'single' if len(rows) == 1 else 'multiSentence', 'parts': parts, 'sourceRows': [r['idx'] for r in rows]})
        continue

    # fallback: judge-mode per row, ignoring q's own brackets, extracting quoted
    # correction tokens (or comma-split bare tokens) straight from the answer text.
    # This never invents position info -- it only asks "is this sentence correct,
    # and if not, what are the correct characters (in order)?"
    parts = []
    for r in rows:
        a = r['a'].strip()
        sentence = BRACKET_RE.sub(lambda m: m.group(1), r['q'])  # drop stray 「」 used as dialogue quotes
        if a == 'X':
            parts.append({'sentence': sentence, 'mode': 'judge', 'isCorrectAsIs': True, 'answers': []})
            continue
        quoted = BRACKET_RE.findall(a)
        if quoted:
            tokens = quoted
        else:
            tokens = [t.strip() for t in re.split(r'[、，,]', a) if t.strip()]
        if not tokens:
            review.append({'tag': tag, 'rows': rows, 'reason': 'fallback-empty-tokens'})
            parts = None
            break
        parts.append({'sentence': sentence, 'mode': 'judge', 'isCorrectAsIs': False, 'answers': tokens})
    if parts is None:
        continue
    n_correct = sum(1 for p in parts if p['isCorrectAsIs'])
    group_mode = 'pickCorrect' if (len(parts) > 1 and n_correct == 1) else 'perOption'
    out_groups.append({'tag': tag, 'groupMode': group_mode, 'parts': parts, 'sourceRows': [r['idx'] for r in rows], 'fallback': True})

print(f'clean groups: {len(out_groups)}, needs review: {len(review)}', file=sys.stderr)
total_parts_clean = sum(len(g['parts']) for g in out_groups)
print(f'total parts in clean groups: {total_parts_clean}', file=sys.stderr)

json.dump(out_groups, open('data/raw/xingxing_clean_groups.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
json.dump(review, open('data/raw/xingxing_needs_review.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
