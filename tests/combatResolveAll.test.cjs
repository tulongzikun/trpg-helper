const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, pendingOpportunities, resolveAllPrompts, readyAction, endTurn } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `resolveall-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = name => ({
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: `char-${name}`,
  revision: 1,
  publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name,
    species: '人类',
    characterClass: '战士',
    level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40,
    armorClass: 16,
    speedFt: 30,
    actions: '',
    notes: '',
    details: { equipment: '长剑' },
  },
});

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '一键结算', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero('守卫'), { battleId, side: '友方' }, ids()).store;
  store = addCharacter(store, hero('同伴'), { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 12, height: 8, cellFt: 5 });
  const guards = battle.actors.filter(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  const initiatives = {};
  battle.actors.forEach(actor => { initiatives[actor.id] = actor.id === foe.id ? 20 : 10; });
  battle = structuredClone(startCombat(battle, initiatives));
  battle.actors.find(actor => actor.id === guards[0].id).position = { x: 1, y: 1 };
  battle.actors.find(actor => actor.id === guards[1].id).position = { x: 1, y: 2 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: 2, y: 1 };
  return { battle, guardIds: guards.map(actor => actor.id), foeId: foe.id };
}

test('没有提示时什么也不做', () => {
  const { battle } = setup();
  const result = resolveAllPrompts(battle);
  assert.equal(result.battle, battle);
  assert.deepEqual(result.resolved, []);
  assert.deepEqual(result.skipped, []);
});

test('两名守卫的借机提示会一起结算并都消耗反应', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 5, 1);
  assert.equal(pendingOpportunities(moved).length, 2);
  const result = resolveAllPrompts(moved, { random: sequence(0.9, 0.5, 0.9, 0.5) });
  assert.equal(result.resolved.length, 2);
  assert.deepEqual(result.skipped, []);
  assert.equal(pendingOpportunities(result.battle).length, 0);
});

test('反应已经用掉的守卫会被跳过并记录原因', () => {
  const { battle, guardIds, foeId } = setup();
  const spent = structuredClone(battle);
  spent.actors.find(actor => actor.id === guardIds[0]).combat.reactionUsed = true;
  const moved = moveActorToCell(spent, foeId, 5, 1);
  const result = resolveAllPrompts(moved, { random: sequence(0.9, 0.5) });
  assert.equal(result.resolved.length, 1);
  assert.equal(result.skipped.length, 1);
  assert.match(result.skipped[0], /反应/);
  assert.equal(pendingOpportunities(result.battle).length, 0);
});

test('准备动作提示走准备动作的结算路径', () => {
  const { battle, guardIds, foeId } = setup();
  const prepared = structuredClone(battle);
  const actor = prepared.actors.find(item => item.id === guardIds[0]);
  actor.combat.ready = { action: '攻击靠近的敌人', trigger: '有敌人进入 5 尺' };
  prepared.combat.pendingOpportunity = [{ reactorId: guardIds[0], targetId: foeId, kind: 'ready' }];
  const result = resolveAllPrompts(prepared, { random: sequence(0.9, 0.5) });
  assert.equal(result.resolved.length, 1);
  assert.match(result.resolved[0], /准备动作/);
  assert.equal(pendingOpportunities(result.battle).length, 0);
});
