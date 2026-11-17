const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid: grid, endTurn, moveActorToCell, opportunityAttack, pendingOpportunities, setEnterReachOpportunity, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (equipment) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-polearm', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '守卫', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: { equipment },
  },
});

function setup(equipment, startX) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '长武器', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(equipment), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  let started = startCombat(withHero, initiatives);
  const friend = started.actors.find(actor => actor.side === '友方');
  const monster = started.actors.find(actor => actor.side === '敌方');
  started = grid(started, { width: 14, height: 8, cellFt: 5 });
  started = moveActorToCell(started, friend.id, 1, 1);
  started = moveActorToCell(started, monster.id, startX, 1);
  started = endTurn(started);
  assert.equal(started.combat.order[started.combat.turnIndex], monster.id);
  return { battle: started, friend, monster };
}

test('开启后敌人进入长武器触及范围会获得借机提示', () => {
  const { battle, friend, monster } = setup('戟', 5);
  const enabled = setEnterReachOpportunity(battle, true);
  const moved = moveActorToCell(enabled, monster.id, 3, 1);
  const prompts = pendingOpportunities(moved);
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].reactorId, friend.id);
  assert.equal(prompts[0].targetId, monster.id);
  assert.ok(moved.combat.log.some(item => item.text.includes('进入') && item.text.includes('可以借机攻击')), 'missing enter log');
  const struck = opportunityAttack(moved, friend.id, {}, { random: sequence(0.5, 0.5) });
  assert.equal(pendingOpportunities(struck.battle).length, 0);
  assert.ok(struck.battle.combat.log.some(item => item.text.includes('守卫') && item.text.includes('借机攻击')), 'missing reaction log');
});

test('关闭时敌人进入触及范围不会触发借机', () => {
  const { battle, monster } = setup('戟', 5);
  const moved = moveActorToCell(battle, monster.id, 3, 1);
  assert.equal(pendingOpportunities(moved).length, 0);
  assert.equal(moved.combat.log.some(item => item.text.includes('进入')), false);
});

test('普通近战武器不会因进入触及而借机', () => {
  const { battle, monster } = setup('长剑', 5);
  const enabled = setEnterReachOpportunity(battle, true);
  const moved = moveActorToCell(enabled, monster.id, 2, 1);
  assert.equal(pendingOpportunities(moved).length, 0);
});

test('开启后离开触及范围仍然触发借机', () => {
  const { battle, friend, monster } = setup('戟', 2);
  const enabled = setEnterReachOpportunity(battle, true);
  const moved = moveActorToCell(enabled, monster.id, 5, 1);
  const prompts = pendingOpportunities(moved);
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].reactorId, friend.id);
  assert.ok(moved.combat.log.some(item => item.text.includes('离开') && item.text.includes('可以借机攻击')));
});

test('开关会写入战场状态并记录日志', () => {
  const { battle } = setup('戟', 5);
  const on = setEnterReachOpportunity(battle, true);
  assert.equal(on.enterReachOpportunity, true);
  assert.ok(on.combat.log.at(-1).text.includes('已开启'));
  const off = setEnterReachOpportunity(on, false);
  assert.equal(off.enterReachOpportunity, undefined);
  assert.ok(off.combat.log.at(-1).text.includes('已关闭'));
});
