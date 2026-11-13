// Merge teammate handoff JSONs into docs/2024角色非战斗特性核对清单.md.
// Usage: node scripts/merge-checklist-updates.cjs [--dry]
// Each handoff item: {line, from, to}. Lines are 1-based; `from` must equal the
// current line content (after trimming CR). Already-applied items are tracked in
// .cache/checklist-updates/.applied.json so repeated runs are idempotent.
const fs = require('node:fs');
const path = require('node:path');

const dry = process.argv.includes('--dry');
const dir = '.cache/checklist-updates';
const ledgerPath = path.join(dir, '.applied.json');
const checklistPath = 'docs/2024角色非战斗特性核对清单.md';

const raw = fs.readFileSync(checklistPath, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : { applied: [] };
const applied = new Set(ledger.applied);

const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '.applied.json') : [];
const report = { applied: 0, skipped: 0, conflicts: [], missing: [] };

for (const file of files) {
  const full = path.join(dir, file);
  let data;
  try { data = JSON.parse(fs.readFileSync(full, 'utf8')); } catch (e) { report.conflicts.push(`${file}: JSON 解析失败 ${e.message}`); continue; }
  const group = data.group || file.replace(/\.json$/, '');
  for (const item of data.items || []) {
    const key = `${group}#${item.line}#${item.from}`;
    if (applied.has(key)) { report.skipped++; continue; }
    const idx = Number(item.line) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= lines.length) { report.conflicts.push(`${group} 行 ${item.line}: 行号越界`); continue; }
    const current = lines[idx].replace(/\r$/, '');
    if (current.trim() !== String(item.from).trim()) {
      report.conflicts.push(`${group} 行 ${item.line}:\n  期望 ${JSON.stringify(item.from)}\n  实际 ${JSON.stringify(current)}`);
      continue;
    }
    lines[idx] = item.to;
    applied.add(key);
    report.applied++;
  }
  if (!data.items || !data.items.length) report.missing.push(`${file}: 无 items`);
}

if (!dry && report.applied) {
  fs.writeFileSync(checklistPath, lines.join(eol), 'utf8');
  fs.writeFileSync(ledgerPath, JSON.stringify({ applied: [...applied] }, null, 1) + '\n', 'utf8');
}
console.log(JSON.stringify(report, null, 1));
