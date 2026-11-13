const fs = require('fs');
const p = 'docs/2024角色非战斗特性核对清单.md';
let s = fs.readFileSync(p, 'utf8');
const marker = '### 集成验证记录（2026-11-13）';
const i = s.indexOf(marker);
if (i >= 0) s = s.slice(0, i);
s = s.replace(/\s*$/, '');
const block = [
  '',
  marker,
  '',
  '- 全量测试：`node --test --test-isolation=none` → 295 tests / 295 pass；类型检查 `tsc --noEmit` 退出 0。',
  '- 界面与数据：开发服务器 http://127.0.0.1:5173 返回 200，Vite 能编译 `CharacterDetails.tsx` 与 7 个分组视图；`characterFeatures()` 对 12 个职业、48 个子职业、10 个物种均有输出。',
  '- 合并流程：7 个执行组（`.cache/state/groups/T1–T7.json`）共 478 条结论经 `.cache/checklist-updates/*.json` 合并，逐行 `from` 校验无冲突、无遗漏。',
  '- 可用脚本：`node scripts/audit-checklist.cjs`（状态审计）、`node scripts/parse-checklist.cjs`（解析）、`node scripts/merge-checklist-updates.cjs`（增量合并）。',
  '',
].join('\n');
fs.writeFileSync(p, s + '\n' + block);
console.log('evidence section written');
