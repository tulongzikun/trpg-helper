const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, attack } = require('../apps/web/src/combat.ts');
const { battleReport, reportFileName } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `rep-${++counter}`;

function setup() {
  let store = emptyStore();
  store = addMonsters(store, card, { newBattleName: '地穴遭遇', side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  store = addMonsters(store, card, { battleId: store.battles[0].id, side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  return startCombat(base, Object.fromEntries(base.actors.map((actor, index) => [actor.id, 20 - index])));
}

test('报告包含标题、进度与单位表格', () => {
  const battle = setup();
  const text = battleReport(battle);
  assert.ok(text.startsWith('# 战斗记录：地穴遭遇'));
  assert.match(text, /- 进度：第 1 轮，当前行动者/);
  assert.match(text, /\| 单位 \| 阵营 \| 生命 \| 状态 \| 条件 \| 专注 \|/);
  assert.equal(text.split('\n').filter(line => line.startsWith('| ') && !line.includes('---') && !line.includes('单位 |')).length, battle.actors.length);
});

test('生命与状态写进表格，血量受损后同步', () => {
  let battle = setup();
  const hero = battle.actors[0];
  const foe = battle.actors[1];
  const hit = attack(battle, { attackerId: hero.id, targetId: foe.id, attackBonus: 20, damageExpression: '1d6+1', damageType: '挥砍' }, { random: () => 0.6, makeId: ids() });
  battle = hit.battle;
  const text = battleReport(battle);
  assert.match(text, new RegExp(`\\| ${foe.name} \\| 敌方 \\| ${battle.actors[1].currentHp}/${foe.maxHp} \\| 在场`));
});

test('战报段落按日志逐条列出', () => {
  const battle = setup();
  const text = battleReport(battle);
  assert.match(text, /## 战报/);
  assert.ok(text.split('\n').filter(line => line.startsWith('- ')).length >= battle.combat.log.length);
});

test('文件名替换非法字符', () => {
  const battle = setup();
  assert.equal(reportFileName({ ...battle, name: '营地/夜袭: 第一幕' }), '营地_夜袭_ 第一幕-战报.md');
  assert.equal(reportFileName({ ...battle, name: '   ' }), '战斗-战报.md');
});
