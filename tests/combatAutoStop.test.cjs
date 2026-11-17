const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat }
 = require('../apps/web/src/combat.ts');
const { autoSide } = require('../apps/web/src/combatAuto.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `autostop-${++counter}`;

function setup({ withFoe = true } = {}) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '自动停止', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const hero = { ...base.actors[0], id: 'hero-1', name: '罗兰', side: '友方' };
  const foe = { ...base.actors[0], id: 'foe-1', name: '哥布林', side: '敌方' };
  const actors = withFoe ? [hero, foe] : [hero];
  const battle = { ...base, actors };
  const initiatives = {};
  actors.forEach((actor, index) => { initiatives[actor.id] = index === 0 ? 20 : 10; });
  return { battle: startCombat(battle, initiatives), heroId: 'hero-1', foeId: 'foe-1' };
}

test('轮到其他阵营时给出 side 原因且不记录回合', () => {
  const { battle } = setup();
  const result = autoSide(battle, '敌方', { random: () => 0.5 });
  assert.equal(result.turns.length, 0);
  assert.equal(result.stopped.reason, 'side');
  assert.match(result.stopped.text, /不属于敌方/);
});

test('战斗结束时给出 finished 原因', () => {
  const { battle } = setup({ withFoe: false });
  const result = autoSide(battle, '敌方', { random: () => 0.5 });
  assert.equal(result.stopped.reason, 'finished');
  assert.match(result.turns.join(' '), /战斗已经结束/);
});

test('达到回合上限时给出 limit 原因', () => {
  const { battle } = setup();
  const atEnemy = { ...battle, combat: { ...battle.combat, turnIndex: 1 } };
  const result = autoSide(atEnemy, '敌方', { random: () => 0.5 }, { maxTurns: 1 });
  assert.equal(result.turns.length, 1);
  assert.equal(result.stopped.reason, 'limit');
});

test('正常推进完整轮次时不带 stopped', () => {
  const { battle } = setup();
  const atEnemy = { ...battle, combat: { ...battle.combat, turnIndex: 1 } };
  const result = autoSide(atEnemy, '敌方', { random: () => 0.5 }, { maxTurns: 3 });
  assert.equal(result.turns.length, 1);
  assert.equal(result.stopped.reason, 'side');
});
