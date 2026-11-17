const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, setDamageDefenses } = require('../apps/web/src/combat.ts');
const { battleReport, defenseOf } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `report-defense-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '防御战报', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  battle = structuredClone(startCombat(battle, Object.fromEntries(battle.actors.map(actor => [actor.id, 10]))));
  return { battle, foe: battle.actors[0] };
}

test('没有防御时摘要为空且战报不含防御小节', () => {
  const { battle, foe } = setup();
  assert.equal(defenseOf(foe), '');
  assert.equal(battleReport(battle).includes('## 防御'), false);
});

test('抗性、免疫、易伤按顺序汇总成摘要', () => {
  const { battle, foe } = setup();
  let next = setDamageDefenses(battle, foe.id, 'resistances', ['火焰']);
  next = setDamageDefenses(next, foe.id, 'immunities', ['毒素']);
  next = setDamageDefenses(next, foe.id, 'vulnerabilities', ['寒冷']);
  assert.equal(defenseOf(next.actors[0]), '抗火焰、免毒素、弱寒冷');
});

test('战报新增防御小节并逐个单位列出', () => {
  const { battle, foe } = setup();
  const guarded = setDamageDefenses(battle, foe.id, 'resistances', ['火焰', '闪电']);
  const report = battleReport(guarded);
  assert.match(report, /## 防御/);
  assert.match(report, new RegExp(`- ${guarded.actors[0].name}：抗火焰、抗闪电`));
});

test('防御小节位于单位表之后、统计之前', () => {
  const { battle, foe } = setup();
  const guarded = setDamageDefenses(battle, foe.id, 'immunities', ['火焰']);
  const report = battleReport(guarded);
  assert.ok(report.indexOf('## 防御') > report.indexOf('| 单位 |'));
  assert.ok(report.indexOf('## 防御') < report.indexOf('## 统计'));
});

test('清除后再导出，战报里不再出现该防御', () => {
  const { battle, foe } = setup();
  const guarded = setDamageDefenses(battle, foe.id, 'resistances', ['火焰']);
  const cleared = setDamageDefenses(guarded, foe.id, 'resistances', []);
  assert.equal(defenseOf(cleared.actors[0]), '');
  assert.equal(battleReport(cleared).includes('## 防御'), false);
});
