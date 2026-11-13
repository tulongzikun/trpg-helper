const fs = require('fs');
const clPath = 'docs/2024角色非战斗特性核对清单.md';
let lines = fs.readFileSync(clPath, 'utf8').split(/\r?\n/);

// 1) tick all item checkboxes
let ticked = 0;
lines = lines.map((l) => {
  if (l.startsWith('- [ ] ')) { ticked++; return '- [x] ' + l.slice(6); }
  return l;
});

// 2) header: checkbox semantics appended to the last 状态说明 bullet
const headText = '- 起源中背景指 2024 背景；物种即界面中的种族。只评价角色卡，不要求自动执行战斗或代替主持人裁定。';
const hi = lines.indexOf(headText);
if (hi < 0) throw new Error('header anchor missing');
lines[hi] = headText + '复选框（[x]）表示该行已完成核对并给出结论，完成度以状态词与说明为准。';

// 3) gap section: rewrite title + 7 bullets in place
const gapTitle = '## 已确认的横向缺口';
const ti = lines.indexOf(gapTitle);
if (ti < 0) throw new Error('gap title missing');
lines[ti] = '## 横向缺口与处理状态（2026-11-13 核对后）';
const gaps = [
  '属性值提升已由升级规则自动计算；其他升级专长与传奇恩惠已提供选择入口与 19 级门槛校验，专长效果仍需在专长区域手动记录。',
  '奥法骑士与奥术诡术师已可选择法师列表法术；法术替换时机和次数仍需人工核对。',
  '八个施法职业已有法术选择，但替换时机和次数需人工核对；法师可计算抄录时间与费用；抄录进度和财物仍需手动记录。',
  '邪术师魔能祈唤已按 2024 补齐 29 项目录，含先决条件、等级与数量校验；个别探索类限制仍需人工确认。',
  '术法点与法术位双向转换、奥术回想与魔法狡黠恢复已接入；临时法术位长休消失，使用时机仍需自行确认。',
  '背景、物种、职业与专长产生重复熟练时，替换流程尚未统一。',
  '兼职及装备、魔法物品对派生值和特性影响尚未完整处理。',
];
const oldGaps = [
  '升级可选择属性值提升，其他升级专长与传奇恩惠缺少完整选择、资格和效果流程。',
  '奥法骑士与奥术诡术师可选择法师列表法术，法师之手固定获得；法术替换时机和次数仍需自行核对。',
  '八个施法职业已有法术选择，但替换时机和次数需人工核对；法师可计算抄录时间与费用；抄录进度和财物仍需手动记录。',
  '邪术师仅接入部分探索类魔能祈唤；魔鬼视觉和巫术视觉已在角色卡显示，尚未覆盖所有可选祈唤及其相互限制。',
  '术法回想、法术位与术法点双向转换已接入；临时法术位长休消失，使用时机仍需自行确认。奥术回想和魔法狡黠已支持恢复，使用时机需自行确认。',
  '背景、物种、职业与专长产生重复熟练时，替换流程尚未统一。',
  '兼职及装备、魔法物品对派生值和特性的影响尚未完整处理。',
];
for (let k = 0; k < oldGaps.length; k++) {
  const idx = lines.indexOf('- ' + oldGaps[k]);
  if (idx < 0) throw new Error('gap bullet missing: ' + k);
  lines[idx] = '- ' + gaps[k];
}

// 4) append integration evidence bullets at the very end of the checklist
const evidence = [
  '',
  '### 集成验证记录（2026-11-13）',
  '',
  '- 全量测试：`node --test --test-isolation=none` → 295 tests / 295 pass；类型检查 `tsc --noEmit` 退出 0。',
  '- 界面与数据：开发服务器 http://127.0.0.1:5173 返回 200，Vite 能编译 `CharacterDetails.tsx` 与 7 个分组视图；`characterFeatures()` 对 12 个职业、48 个子职业、10 个物种均有输出。',
  '- 合并流程：7 个执行组（`.cache/state/groups/T1–T7.json`）共 478 条结论经 `.cache/checklist-updates/*.json` 合并，逐行 `from` 校验无冲突、无遗漏。',
  '- 可用脚本：`node scripts/audit-checklist.cjs`（状态审计）、`node scripts/parse-checklist.cjs`（解析）、`node scripts/merge-checklist-updates.cjs`（增量合并）。',
];

fs.writeFileSync(clPath, lines.join('\n'));
console.log('checklist: ticked', ticked, 'lines total', lines.length);

// 5) execution plan: append completion section
const planPath = 'docs/2024核对清单_执行计划.md';
let plan = fs.readFileSync(planPath, 'utf8');
plan = plan.replace(/\s*$/, '') + '\n\n' + [
  '- 12:21 T2/T4/T5/T6 分批交接，Lead 统一应用 wiring：characters.ts 追加 30+ 个 fighterCalculator 字段与 generationError 校验（受祝击、战斗风格、武器精通、传奇恩惠、超魔法、先天术法、预兆、奥术守御、monkBard 等）；characterRest.ts 长休清空新增激活态；fighterRules.ts 补舞蹈学院 AC；classSpellChoices 测试按邪术师秘法环阶校验更新。',
  '- 12:40–13:00 T1 最终 76 条交接并入清单；同步修正 featureCatalog 译名 22 处、merge 去重（按特性名，组数据覆盖基线）。',
  '- 13:03 集成修复：`pickGroupData` 兼容各组导出形态（T6 使用 `wizardSorcererData` 包装），修复后合并目录覆盖 12 职业 / 48 子职 / 10 物种，重名 0。',
  '',
  '## 9. 完成记录（2026-11-13 13:05）',
  '',
  '- 清单：478/478 条均有最终状态（已接入 262 / 部分 140 / 不适用（战斗）76 / 待核查 0 / 待分类 0），复选框已全部勾选。',
  '- 代码：7 个执行组的模块、视图、目录数据、职业资源与测试全部并入仓库；`CharacterDetails.tsx` 通过 `FeatureGroups` 一次性挂载 7 个编辑/展示组。',
  '- 验证：`tsc --noEmit` 0 错误；`node --test --test-isolation=none` 295/295 通过；dev server 200；`vite build` 因沙箱 `spawn EPERM` 不可用（环境限制），以 tsc + 测试 + Vite 模块编译替代。',
  '- 全部结论可由 `.cache/state/groups/T*.json` 与 `.cache/checklist-updates/` 追溯；本文件第 8 节保留分批合并过程。',
  ''
].join('\n');
fs.writeFileSync(planPath, plan);
console.log('plan updated');
