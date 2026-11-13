// Parse docs/2024角色非战斗特性核对清单.md into a machine-readable work index.
// Output: .cache/state/checklist.json + per-section item counts on stdout.
const fs = require('node:fs');

const md = fs.readFileSync('docs/2024角色非战斗特性核对清单.md', 'utf8');
const lines = md.split(/\r?\n/);

const sections = [];
let current = null;
let topKind = null;
let lastClass = null;
const subclassRe = /^####\s+(.+?)\s*\/\s*([A-Za-z][\w\s-]*)$/;
const classRe = /^###\s+(.+)$/;
const itemRe = /^\s*-\s*\[([ x])\]\s*(.*)$/;
const statusRe = /^(.*?)\s*[—–-]\s*(不适用（战斗）|待核查|已接入|部分|待分类|不适用)(?:[：:]\s*(.*))?$/;

function classifySection(title) {
  return title;
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const h2 = line.match(/^##\s+(.+)$/);
  if (h2) {
    const title = h2[1].trim();
    topKind = title.includes('子职业') ? 'subclass' : title.includes('职业逐项') ? 'class' : title.includes('物种') ? 'species' : title.includes('背景') ? 'background' : title.includes('起源专长') ? 'originFeat' : null;
    current = null;
    continue;
  }
  const sub = line.match(subclassRe);
  if (sub && topKind === 'subclass') {
    current = { kind: 'subclass', class: lastClass, name: sub[1].trim(), en: sub[2].trim(), url: '', items: [], headingLine: i + 1 };
    sections.push(current);
    continue;
  }
  const h3 = line.match(classRe);
  if (h3 && topKind === 'class') {
    lastClass = h3[1].trim();
    current = { kind: 'class', class: lastClass, name: lastClass, url: '', items: [], headingLine: i + 1 };
    sections.push(current);
    continue;
  }
  if (h3 && topKind === 'subclass') {
    lastClass = h3[1].trim();
    current = null;
    continue;
  }
  if (h3 && (topKind === 'species' || topKind === 'background' || topKind === 'originFeat')) {
    current = { kind: topKind, class: null, name: h3[1].trim(), url: '', items: [], headingLine: i + 1 };
    sections.push(current);
    continue;
  }
  const url = line.match(/^\[规则来源\]\((https?:[^)]+)\)/);
  if (url) { if (current) current.url = url[1]; continue; }
  const item = line.match(itemRe);
  if (item && current) {
    const checked = item[1] === 'x';
    const body = item[2].trim();
    const sm = body.match(statusRe);
    let level = null, name = body, status = '待核查', note = '';
    if (sm) {
      let head = sm[1].trim();
      status = sm[2];
      note = (sm[3] || '').trim();
      const lm = head.match(/^(\d{1,2})\s*级\s*·\s*(.+)$/);
      if (lm) { level = Number(lm[1]); name = lm[2].trim(); } else { name = head; }
      if (status === '待分类' && note) { /* keep note */ }
    }
    current.items.push({ line: i + 1, checked, level, name, status, note });
  }
}

const summary = { total: 0, checked: 0, byStatus: {}, byKind: {} };
for (const s of sections) {
  if (!s.items.length) continue;
  summary.byKind[s.kind] = summary.byKind[s.kind] || { sections: 0, items: 0 };
  summary.byKind[s.kind].sections++;
  summary.byKind[s.kind].items += s.items.length;
  for (const it of s.items) {
    summary.total++;
    if (it.checked) summary.checked++;
    summary.byStatus[it.status] = (summary.byStatus[it.status] || 0) + 1;
  }
}
fs.mkdirSync('.cache/state', { recursive: true });
fs.writeFileSync('.cache/state/checklist.json', JSON.stringify({ summary, sections }, null, 1) + '\n');
console.log(JSON.stringify(summary, null, 1));
console.log('\nsections:', sections.length);
for (const s of sections) {
  if (!s.items.length) { console.log(`(EMPTY) ${s.kind} ${s.name} @${s.headingLine}`); continue; }
  console.log(`${s.kind}\t${s.class || ''}\t${s.name}\t${s.items.length}\t${s.items.filter((x) => x.status === '待核查').length}待\t${s.url ? 'url' : 'NOURL'}`);
}
