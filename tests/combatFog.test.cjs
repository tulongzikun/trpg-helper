const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { attack, castFogCloud, configureGrid, endConcentration, moveActorToCell, startCombat, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `fog-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '迷雾', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const config = configureGrid(store.battles[0], { width: 10, height: 10, cellFt: 5 });
  const [first, second] = config.actors.map(actor => actor.id);
  let battle = startCombat(config, { [first]: 20, [second]: 10 });
  battle = moveActorToCell(battle, first, 4, 5);
  battle = moveActorToCell(battle, second, 5, 5);
  return { battle, first, second };
}

test('雾云术消耗动作与专注并记录迷雾格子', () => {
  const { battle, second } = setup();
  const next = castFogCloud(battle, second, [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }]);
  assert.equal(next.fog.length, 2);
  assert.equal(next.fogBy, second);
  const state = next.actors.find(actor => actor.id === second).combat;
  assert.equal(state.actionUsed, true);
  assert.equal(state.concentration.spell, '雾云术');
  assert.ok(next.combat.log.some(line => line.text.includes('施放雾云术')));
});

test('雾外攻击雾内目标时攻击检定劣势', () => {
  const { battle, first, second } = setup();
  const fogged = castFogCloud(battle, second, [{ x: 5, y: 5 }]);
  const shot = attack(fogged, { attackerId: first, targetId: second, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  assert.equal(shot.outcome.mode, 'disadvantage');
  assert.ok(shot.outcome.notes.includes('云雾遮蔽：攻击检定劣势'));
});

test('双方都在雾内时视野受限互相抵消', () => {
  const { battle, first, second } = setup();
  const fogged = castFogCloud(battle, second, [{ x: 5, y: 5 }, { x: 4, y: 5 }]);
  const shot = attack(fogged, { attackerId: first, targetId: second, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  assert.equal(shot.outcome.mode, 'normal');
  assert.ok(!shot.outcome.notes.includes('云雾遮蔽：攻击检定劣势'));
});

test('结束专注后迷雾消散', () => {
  const { battle, second } = setup();
  const fogged = castFogCloud(battle, second, [{ x: 5, y: 5 }]);
  const cleared = endConcentration(fogged, second);
  assert.equal(cleared.fog, undefined);
  assert.equal(cleared.fogBy, undefined);
  assert.ok(cleared.combat.log.some(line => line.text.includes('迷雾消散了')));
});

test('长休清除迷雾', () => {
  const { battle, second } = setup();
  const fogged = castFogCloud(battle, second, [{ x: 5, y: 5 }]);
  const rested = takeLongRest(fogged);
  assert.equal(rested.fog, undefined);
});

test('雾云术会拒绝无方格、空格子与超限格子', () => {
  const { battle, second } = setup();
  assert.throws(() => castFogCloud({ ...battle, grid: undefined }, second, [{ x: 1, y: 1 }]), /请先启用方格战场/);
  assert.throws(() => castFogCloud(battle, second, []), /请选择雾云术覆盖的格子/);
  const many = Array.from({ length: 25 }, (_, index) => ({ x: index % 10, y: Math.floor(index / 10) }));
  assert.throws(() => castFogCloud(battle, second, many), /最多覆盖 24 格/);
  assert.throws(() => castFogCloud(battle, second, [{ x: 99, y: 1 }]), /超出战场范围/);
});
