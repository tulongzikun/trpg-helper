const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { attack, castDarkness, configureGrid, endConcentration, inDarkness, moveActorToCell, opportunityAttack, startCombat, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `dark-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '黑暗', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const config = configureGrid(store.battles[0], { width: 10, height: 10, cellFt: 5 });
  const [first, second] = config.actors.map(actor => actor.id);
  let battle = startCombat(config, { [first]: 20, [second]: 10 });
  battle = moveActorToCell(battle, first, 4, 5);
  battle = moveActorToCell(battle, second, 5, 5);
  return { battle, first, second };
}

test('黑暗术消耗动作与专注并记录黑暗格子', () => {
  const { battle, second } = setup();
  const next = castDarkness(battle, second, [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }]);
  assert.equal(next.darkness.length, 2);
  assert.equal(next.darknessBy, second);
  const state = next.actors.find(actor => actor.id === second).combat;
  assert.equal(state.actionUsed, true);
  assert.equal(state.concentration.spell, '黑暗术');
  assert.ok(next.combat.log.some(line => line.text.includes('施放黑暗术')));
});

test('黑暗外的攻击者看不清黑暗内的目标', () => {
  const { battle, first, second } = setup();
  const dark = castDarkness(battle, second, [{ x: 5, y: 5 }]);
  assert.equal(inDarkness(dark, second), true);
  assert.equal(inDarkness(dark, first), false);
  const shot = attack(dark, { attackerId: first, targetId: second, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  assert.equal(shot.outcome.mode, 'disadvantage');
  assert.ok(shot.outcome.notes.includes('魔法黑暗：看不清目标'));
});

test('双方都在黑暗中时互相看不见，优劣抵消', () => {
  const { battle, first, second } = setup();
  const dark = castDarkness(battle, second, [{ x: 5, y: 5 }, { x: 4, y: 5 }]);
  const shot = attack(dark, { attackerId: first, targetId: second, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  assert.equal(shot.outcome.mode, 'normal');
  assert.ok(!shot.outcome.notes.includes('魔法黑暗：看不清目标'));
});

test('看不清目标时无法进行借机攻击', () => {
  const { battle, first, second } = setup();
  const dark = castDarkness(battle, second, [{ x: 5, y: 5 }]);
  const pending = structuredClone(dark);
  pending.combat.pendingOpportunity = [{ reactorId: second, targetId: first }];
  assert.throws(() => opportunityAttack(pending, second, {}, { random: sequence(0.5, 0.5) }), /魔法黑暗/);
  const both = structuredClone(dark);
  both.darkness = [{ x: 5, y: 5 }, { x: 4, y: 5 }];
  both.combat.pendingOpportunity = [{ reactorId: second, targetId: first }];
  const strike = opportunityAttack(both, second, {}, { random: sequence(0.5, 0.5, 0.5) });
  assert.ok(strike.outcome);
});

test('结束专注与长休都会清除魔法黑暗', () => {
  const { battle, second } = setup();
  const dark = castDarkness(battle, second, [{ x: 5, y: 5 }]);
  const cleared = endConcentration(dark, second);
  assert.equal(cleared.darkness, undefined);
  assert.equal(cleared.darknessBy, undefined);
  assert.ok(cleared.combat.log.some(line => line.text.includes('魔法黑暗消散了')));
  const rested = takeLongRest(dark);
  assert.equal(rested.darkness, undefined);
});

test('黑暗术会拒绝无方格、空格子、超限与越界坐标', () => {
  const { battle, second } = setup();
  assert.throws(() => castDarkness({ ...battle, grid: undefined }, second, [{ x: 1, y: 1 }]), /请先启用方格战场/);
  assert.throws(() => castDarkness(battle, second, []), /请选择黑暗术覆盖的格子/);
  const many = [...Array.from({ length: 10 }, (_, index) => ({ x: index, y: 0 })), { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }];
  assert.throws(() => castDarkness(battle, second, many), /最多覆盖 12 格/);
  assert.throws(() => castDarkness(battle, second, [{ x: 99, y: 1 }]), /超出战场范围/);
  assert.throws(() => castDarkness(battle, second, [{ x: 1.5, y: 1 }]), /须为整数/);
});
