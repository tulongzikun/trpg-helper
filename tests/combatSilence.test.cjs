const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { castBless, castSilence, configureGrid, endConcentration, endTurn, moveActorToCell, silenceAt, silenceBlocks, startCombat, takeLongRest } = require('../apps/web/src/combat.ts');
const { castSpell } = require('../apps/web/src/combatSpells.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `sil-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '沉默', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const config = configureGrid(store.battles[0], { width: 10, height: 10, cellFt: 5 });
  const [first, second] = config.actors.map(actor => actor.id);
  let battle = startCombat(config, { [first]: 20, [second]: 10 });
  battle = moveActorToCell(battle, first, 4, 5);
  battle = moveActorToCell(battle, second, 5, 5);
  return { battle, first, second };
}

test('沉默术消耗动作与专注并记录沉默格子', () => {
  const { battle, second } = setup();
  const next = castSilence(battle, second, [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }]);
  assert.equal(next.silence.length, 2);
  assert.equal(next.silenceBy, second);
  const state = next.actors.find(actor => actor.id === second).combat;
  assert.equal(state.actionUsed, true);
  assert.equal(state.concentration.spell, '沉默术');
  assert.ok(next.combat.log.some(line => line.text.includes('施放沉默术')));
  assert.equal(silenceAt(next, 4, 5), true);
  assert.equal(silenceAt(next, 6, 5), false);
});

test('站在沉默区域内的施法者无法施放法术', () => {
  const { battle, first, second } = setup();
  let next = castSilence(battle, second, [{ x: 5, y: 5 }, { x: 4, y: 5 }]);
  next = endTurn(next, {});
  assert.equal(silenceBlocks(next, first), true);
  assert.throws(() => castBless(next, first, [first]), /处于沉默区域，无法施放需要言语成分的法术/);
});

test('沉默区域外的施法者不受影响', () => {
  const { battle, first, second } = setup();
  let next = castSilence(battle, second, [{ x: 5, y: 5 }]);
  next = endTurn(next, {});
  assert.equal(silenceBlocks(next, first), false);
  const blessed = castBless(next, first, [first]);
  assert.equal(blessed.actors.find(actor => actor.id === first).combat.blessed, 10);
});

test('施法者在外时可以沉默区域内的目标施展法术', () => {
  const { battle, first, second } = setup();
  let next = castSilence(battle, second, [{ x: 5, y: 5 }]);
  next = endTurn(next, {});
  assert.equal(silenceBlocks(next, second), true);
  const blessed = castBless(next, first, [second]);
  assert.equal(blessed.actors.find(actor => actor.id === second).combat.blessed, 10);
});

test('沉默区域同样阻止通用法术施放', () => {
  const { battle, first, second } = setup();
  let next = castSilence(battle, second, [{ x: 4, y: 5 }]);
  next = endTurn(next, {});
  assert.throws(() => castSpell(next, {
    casterId: first,
    spell: '火焰箭',
    level: 0,
    attack: { targetId: second, attackBonus: 5, damageExpression: '1d10', damageType: '火焰' },
  }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() }), /处于沉默区域，无法施放需要言语成分的法术/);
});

test('结束专注与长休都会清除沉默区域', () => {
  const { battle, second } = setup();
  const silenced = castSilence(battle, second, [{ x: 5, y: 5 }]);
  const cleared = endConcentration(silenced, second);
  assert.equal(cleared.silence, undefined);
  assert.equal(cleared.silenceBy, undefined);
  assert.ok(cleared.combat.log.some(line => line.text.includes('沉默区域恢复了声音')));
  const rested = takeLongRest(castSilence(battle, second, [{ x: 5, y: 5 }]));
  assert.equal(rested.silence, undefined);
});

test('沉默术会拒绝无方格、空格子与超限格子', () => {
  const { battle, second } = setup();
  assert.throws(() => castSilence({ ...battle, grid: undefined }, second, [{ x: 1, y: 1 }]), /请先启用方格战场/);
  assert.throws(() => castSilence(battle, second, []), /请选择沉默术覆盖的格子/);
  const many = Array.from({ length: 21 }, (_, index) => ({ x: index % 10, y: Math.floor(index / 10) }));
  assert.throws(() => castSilence(battle, second, many), /最多覆盖 20 格/);
  assert.throws(() => castSilence(battle, second, [{ x: 99, y: 1 }]), /超出战场范围/);
  assert.throws(() => castSilence(battle, second, [{ x: 1.5, y: 1 }]), /坐标须为整数/);
});
