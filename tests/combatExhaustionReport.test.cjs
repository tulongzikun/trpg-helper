const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, setExhaustion } = require('../apps/web/src/combat.ts');
const { effectsOf, battleReport, battleCsv } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `exr-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '力竭战报', side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const hero = battle.actors[0];
  hero.name = '英雄';
  const foe = { ...structuredClone(hero), id: 'foe-1', name: '敌人', side: '敌方' };
  foe.combat = undefined;
  battle.actors.push(foe);
  battle = structuredClone(startCombat(battle, { [hero.id]: 20, 'foe-1': 10 }));
  return { battle, heroId: hero.id };
}

test('effectsOf 列出力竭等级与惩罚', () => {
  const { battle, heroId } = setup();
  const tired = setExhaustion(battle, heroId, 3);
  const hero = tired.actors.find(actor => actor.id === heroId);
  const parts = effectsOf(hero);
  assert.ok(parts.some(text => /^力竭 3 级（攻击／豁免／检定 -6，速度 -15 尺）$/.test(text)));
});

test('没有力竭的单位不输出力竭行', () => {
  const { battle, heroId } = setup();
  const hero = battle.actors.find(actor => actor.id === heroId);
  assert.ok(!effectsOf(hero).some(text => text.startsWith('力竭')));
});

test('战报的状态小节包含力竭', () => {
  const { battle, heroId } = setup();
  const tired = setExhaustion(battle, heroId, 2);
  const report = battleReport(tired);
  assert.match(report, /## 状态/);
  assert.match(report, /力竭 2 级/);
});

test('统计 CSV 的状态效果列包含力竭', () => {
  const { battle, heroId } = setup();
  const tired = setExhaustion(battle, heroId, 1);
  const csv = battleCsv(tired);
  assert.match(csv, /力竭 1 级/);
});
