import { readFileSync } from 'node:fs';

const items = JSON.parse(readFileSync('data/items.json', 'utf-8'));
const xingxingRaw = JSON.parse(readFileSync('data/raw/xingxing_raw.json', 'utf-8'));
const yinyinRaw = JSON.parse(readFileSync('data/raw/yinyin_raw.json', 'utf-8'));

let errors = [];
let warnings = [];

function fail(msg) { errors.push(msg); }

// 1. basic shape + id uniqueness
const seenIds = new Set();
for (const it of items) {
  if (seenIds.has(it.id)) fail(`duplicate id ${it.id}`);
  seenIds.add(it.id);
  if (!it.examTag || !it.level || !Array.isArray(it.parts) || !it.parts.length) {
    fail(`item ${it.id} missing required fields`);
  }
  if (!['基測', '會考'].includes(it.level)) fail(`item ${it.id} bad level ${it.level}`);
}

// 2. total row/part counts sanity: every raw row must be traceable into merged data
const totalRawRows = xingxingRaw.length + yinyinRaw.length;
let totalSourceRows = 0;
for (const it of items) totalSourceRows += (it.groupMode === 'pickCorrect' ? it.parts.length : 1) * 0; // placeholder, real check below

// count distinct source rows actually referenced (sourceRows arrays were dropped at merge;
// instead verify total parts >= totalRawRows since some rows expand into >=1 part and
// pickCorrect groups collapse N rows into 1 quiz unit but keep all N parts stored)
const totalParts = items.reduce((s, it) => s + it.parts.length, 0);
console.log(`raw rows: ${totalRawRows}, items: ${items.length}, total parts: ${totalParts}`);
if (totalParts < totalRawRows * 0.9) {
  fail(`total parts (${totalParts}) suspiciously lower than raw rows (${totalRawRows}) -- possible data loss`);
}

// 3. distractor integrity
for (const it of items) {
  for (const [pi, p] of it.parts.entries()) {
    if (it.type === 'xingxing') {
      if (p.mode === 'char' || p.mode === 'reading') {
        const correct = p.correct || p.target;
        const d = p.distractors || [];
        if (d.length !== 3) fail(`${it.id}#${pi} expected 3 distractors, got ${d.length}`);
        if (d.includes(correct)) fail(`${it.id}#${pi} distractor equals correct answer`);
        if (new Set(d).size !== d.length) fail(`${it.id}#${pi} duplicate distractors`);
      }
      if (p.mode === 'judge' && !p.isCorrectAsIs && (!p.answers || !p.answers.length)) {
        fail(`${it.id}#${pi} judge-mode wrong sentence has no answers`);
      }
    } else {
      const d = p.zhuyinDistractors || [];
      if (d.length !== 3) fail(`${it.id}#${pi} expected 3 zhuyin distractors, got ${d.length}`);
      if (d.includes(p.correctZhuyin)) fail(`${it.id}#${pi} zhuyin distractor equals correct`);
      if (new Set(d).size !== d.length) fail(`${it.id}#${pi} duplicate zhuyin distractors`);
    }
  }
}

// 4. simplified-Chinese leak check (spot common simplified-only chars)
const simplifiedBlacklist = /[国学习为们从这来时会说对开关于爱]/;
for (const it of items) {
  for (const p of it.parts) {
    const text = p.sentence || '';
    if (simplifiedBlacklist.test(text)) warnings.push(`${it.id} sentence may contain simplified char: ${text}`);
  }
}

// 5. examTag parseability re-check
const tagRe = /^(\d+)(補)?-(\d+)(?:-(\d+))?$|^(\d+)-北北基-(\d+)$/;
for (const it of items) {
  if (!tagRe.test(it.examTag)) fail(`item ${it.id} unparseable examTag ${it.examTag}`);
}

console.log(`\n${errors.length} errors, ${warnings.length} warnings`);
if (warnings.length) warnings.slice(0, 10).forEach((w) => console.log('WARN:', w));
if (errors.length) {
  errors.forEach((e) => console.log('ERROR:', e));
  process.exit(1);
}
console.log('ALL CLEAN');
