// Audit docs/2024角色非战斗特性核对清单.md: status vocabulary, remaining 待核查, evidence hints.
// Usage: node scripts/audit-checklist.cjs [--verbose]
const fs = require('node:fs');
const file = 'docs/2024角色非战斗特性核对清单.md';
const verbose = process.argv.includes('--verbose');
const raw = fs.readFileSync(file, 'utf8');
const lines = raw.split(/\r?\n/);

const statuses = ['已接入', '部分', '不适用（战斗）', '待分类', '待核查'];
const counts = { 已接入: 0, 部分: 0, '不适用（战斗）': 0, 待分类: 0, 待核查: 0, other: 0 };
const uncheckedDone = [], invalid = [], missingEvidence = [], pending = [];

let section = '(前言)';
let sectionKind = 'other';
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const h2 = line.match(/^##\s+(.+)$/);
  if (h2) {
    section = h2[1].trim();
    sectionKind = /职业逐项/.test(section) ? '职业' : /子职业/.test(section) ? '子职业' : /物种/.test(section) ? '物种' : /背景|起源/.test(section) ? '背景' : 'other';
    continue;
  }
  const h3 = line.match(/^###\s+(.+)$/);
  if (h3) { section = h3[1].trim(); continue; }
  const h4 = line.match(/^####\s+(.+)$/);
  if (h4) { section = h4[1].trim(); continue; }
  const m = line.match(/^- \[( |x)\] (.*)$/);
  if (!m) continue;
  const checked = m[1] === 'x';
  const body = m[2];
  const dash = body.lastIndexOf('—');
  if (dash < 0) { invalid.push({ line: i + 1, reason: '缺状态分隔符 —', text: line }); counts.other++; continue; }
  const after = body.slice(dash + 1).trim();
  const status = statuses.find((s) => after.startsWith(s)) || 'other';
  counts[status] = (counts[status] || 0) + 1;
  if (status === 'other') invalid.push({ line: i + 1, reason: '状态词无法识别', text: line });
  if (status !== '待核查' && status !== '待分类' && !checked) uncheckedDone.push({ line: i + 1, status });
  if (status === '已接入' || status === '部分') {
    const detail = after.slice(status.length);
    const hasUi = /界面|显示|区域|选择|输入|记录|按钮|资源/.test(detail);
    const hasTest = /测试|tests\//.test(detail);
    const hasSource = /来源|PHB|SRD|页|规则|\.ts\b|tests\//.test(detail);
    if (!hasUi && !hasTest && !hasSource) missingEvidence.push({ line: i + 1, status, hasUi, hasTest, hasSource, text: line });
  }
  if (status === '待核查') pending.push({ line: i + 1, section, sectionKind, text: body.slice(0, 60) });
}

console.log('总数：', Object.values(counts).reduce((a, b) => a + b, 0));
console.log('按状态：', counts);
if (uncheckedDone.length) console.log('未勾选但已给最终状态：', uncheckedDone.length);
if (invalid.length) { console.log('状态词异常：'); for (const x of invalid) console.log(' ', x.line, x.reason, x.text.slice(0, 80)); }
const bySection = {};
for (const p of pending) bySection[`${p.sectionKind}·${p.section}`] = (bySection[`${p.sectionKind}·${p.section}`] || 0) + 1;
console.log('剩余待核查分布：', Object.keys(bySection).length, '节');
if (verbose) for (const [k, v] of Object.entries(bySection).sort((a, b) => b[1] - a[1])) console.log(' ', v, k);
if (missingEvidence.length) {
  console.log('证据不足（已接入/部分中缺界面、测试与来源线索）：', missingEvidence.length);
  for (const x of missingEvidence.slice(0, verbose ? 200 : 10)) console.log(' ', x.line, x.status, 'ui=' + x.hasUi, 'test=' + x.hasTest, 'src=' + x.hasSource, x.text.slice(0, 70));
}
