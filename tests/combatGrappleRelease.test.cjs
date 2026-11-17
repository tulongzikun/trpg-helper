const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, grapple, moveActorToCell, fleeBattle, surrender, damageActor, removeCombatant } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `grp-rel-${++counter}`;

const brute = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-grp-rel', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '托姆', species: '人类', characterClass: '战士', level: 8,
    abilities: { str: 18, dex: 12, con: 16, int: 8, wis: 10, cha: 8 },
    maxHp: 60, armorClass: 17, speedFt: 30, actions: '巨剑：+7 命中，2d6+4 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '擒抱释放', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const withBrute = addCharacter(store, brute, { battleId: store.battles[0].id, side: '友方' }, ids());
  const battle = withBrute.store.battles[0];
  const bruteId = battle.actors.find(actor => actor.name === '托姆').id;
  const foeId = battle.actors.find(actor => actor.side === '敌方').id;
  const initiatives = {};
  battle.actors.forEach((actor) => { initiatives[actor.id] = actor.id === bruteId ? 20 : 10; });
  const started = startCombat(battle, initiatives);
  const placed = {
    ...started,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: started.actors.map(actor => actor.id === bruteId ? { ...actor, position: { x: 0, y: 0 } }
      : { ...actor, position: { x: 0, y: 1 } }),
  };
  return { battle: placed, bruteId, foeId };
}

// 力量对抗全胜：0.99 对 0.0
const dominate = () => ({ random: () => 0.99 });
const fail = () => ({ random: () => 0.0 });

function grappledSetup() {
  const { battle, bruteId, foeId } = setup();
  const gripped = grapple(battle, { attackerId: bruteId, targetId: foeId }, dominate());
  const victim = gripped.battle.actors.find(actor => actor.id === foeId);
  assert.equal(victim.combat.grappledBy, bruteId);
  return { battle: gripped.battle, bruteId, foeId };
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;

test('擒抱者倒下后受害者重获自由', () => {
  const { battle, bruteId, foeId } = grappledSetup();
  const dead = damageActor(battle, bruteId, 200, '挥砍').battle;
  const victim = stateOf(dead, foeId);
  assert.equal(victim.grappledBy, undefined);
  assert.equal(victim.conditions.includes('擒抱'), false);
});

test('擒抱者撤离后受害者重获自由', () => {
  const { battle, bruteId, foeId } = grappledSetup();
  const gone = fleeBattle(battle, bruteId);
  assert.equal(stateOf(gone, foeId).grappledBy, undefined);
});

test('擒抱者投降后受害者重获自由', () => {
  const { battle, bruteId, foeId } = grappledSetup();
  const yielded = surrender(battle, bruteId);
  assert.equal(stateOf(yielded, foeId).grappledBy, undefined);
});

test('擒抱者被移出战场后受害者重获自由', () => {
  const { battle, bruteId, foeId } = grappledSetup();
  const removed = removeCombatant(battle, bruteId);
  assert.equal(stateOf(removed, foeId).grappledBy, undefined);
});

test('重获自由后受害者可以正常移动', () => {
  const { battle, bruteId, foeId } = grappledSetup();
  const dead = damageActor(battle, bruteId, 200, '挥砍').battle;
  // 让受害者成为当前行动者
  const foeTurn = { ...dead, combat: { ...dead.combat, turnIndex: dead.combat.order.indexOf(foeId) } };
  const moved = moveActorToCell(foeTurn, foeId, 0, 2);
  assert.deepEqual(moved.actors.find(actor => actor.id === foeId).position, { x: 0, y: 2 });
});
