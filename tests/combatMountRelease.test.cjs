const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, mountUp, addAura, fleeBattle, surrender, removeCombatant } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `mnt-rel-${++counter}`;

const rider = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-mnt-rider', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '卢克', species: '人类', characterClass: '圣武士', level: 6,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 16 },
    maxHp: 52, armorClass: 18, speedFt: 30, actions: '长剑：+6 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '坐骑释放', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const withRider = addCharacter(store, rider, { battleId: store.battles[0].id, side: '友方' }, ids());
  const battle = withRider.store.battles[0];
  const riderId = battle.actors.find(actor => actor.name === '卢克').id;
  const mountId = battle.actors.find(actor => actor.side === '敌方').id;
  const initiatives = {};
  battle.actors.forEach((actor) => { initiatives[actor.id] = actor.id === riderId ? 20 : 10; });
  const started = startCombat(battle, initiatives);
  const placed = {
    ...started,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: started.actors.map(actor => actor.id === riderId ? { ...actor, position: { x: 0, y: 0 } }
      : { ...actor, position: { x: 0, y: 1 } }),
  };
  return { battle: placed, riderId, mountId };
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;

function mounted() {
  const { battle, riderId, mountId } = setup();
  // 坐骑与骑手同阵营，才能骑乘
  const sameSide = { ...battle, actors: battle.actors.map(actor => actor.id === mountId ? { ...actor, side: '友方' } : actor) };
  const up = mountUp(sameSide, riderId, mountId);
  assert.equal(stateOf(up, mountId).riderId, riderId);
  return { battle: up, riderId, mountId };
}

test('骑手撤离后坐骑空出来', () => {
  const { battle, riderId, mountId } = mounted();
  const gone = fleeBattle(battle, riderId);
  assert.equal(stateOf(gone, mountId).riderId, undefined);
});

test('骑手投降后坐骑空出来', () => {
  const { battle, riderId, mountId } = mounted();
  const yielded = surrender(battle, riderId);
  assert.equal(stateOf(yielded, mountId).riderId, undefined);
});

test('骑手被移出战场后坐骑空出来', () => {
  const { battle, riderId, mountId } = mounted();
  const removed = removeCombatant(battle, riderId);
  assert.equal(stateOf(removed, mountId).riderId, undefined);
});

test('灵光随持有者撤离而消失', () => {
  const { battle, riderId } = setup();
  const withAura = addAura(battle, { ownerId: riderId, name: '守护灵光', radiusFt: 10, bonus: 1, kind: 'saves' });
  assert.equal((withAura.auras ?? []).length, 1);
  const gone = fleeBattle(withAura, riderId);
  assert.equal((gone.auras ?? []).length, 0);
});

test('灵光随持有者被移除而消失', () => {
  const { battle, riderId } = setup();
  const withAura = addAura(battle, { ownerId: riderId, name: '守护灵光', radiusFt: 10, bonus: 1, kind: 'saves' });
  const removed = removeCombatant(withAura, riderId);
  assert.equal((removed.auras ?? []).length, 0);
});

test('坐骑离场时骑手落马', () => {
  const { battle, riderId, mountId } = mounted();
  const removed = removeCombatant(battle, mountId);
  const riderState = stateOf(removed, riderId);
  assert.equal(riderState.mountedOn, undefined);
  assert.equal(riderState.conditions.includes('倒地'), true);
});
