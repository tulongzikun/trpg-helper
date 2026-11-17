const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { damageActor, startCombat } = require('../apps/web/src/combat.ts');
const { crXp, defeatedActors, encounterReward, encounterXp, rewardSummary } = require('../apps/web/src/encounterReward.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;

function setup(count = 2) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '战果', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const order = {};
  let initiative = 20;
  for (const actor of battle.actors) order[actor.id] = initiative--;
  const started = startCombat(battle, order);
  return { battle: started, actors: started.actors };
}

test('挑战等级换算经验值覆盖整数与分数', () => {
  assert.equal(crXp('0'), 10);
  assert.equal(crXp('1/8'), 25);
  assert.equal(crXp('1/4'), 50);
  assert.equal(crXp('1/2'), 100);
  assert.equal(crXp('1'), 200);
  assert.equal(crXp(5), 1800);
  assert.equal(crXp(0.25), 50);
  assert.equal(crXp('30'), 155000);
  assert.equal(crXp('未知'), 0);
  assert.equal(crXp(undefined), 0);
});

test('只统计已死亡单位并累加经验', () => {
  const { battle, actors } = setup(2);
  assert.equal(encounterXp(battle), 0);
  const killed = damageActor(battle, actors[0].id, 20, '挥砍').battle;
  assert.equal(defeatedActors(killed).length, 1);
  assert.equal(encounterXp(killed), 50, 'CR 1/4 每个 50 点');
  const both = damageActor(killed, actors[1].id, 20, '挥砍').battle;
  assert.equal(encounterXp(both), 100);
});

test('敌方全部阵亡时判定战斗完成', () => {
  const { battle, actors } = setup(2);
  const both = damageActor(damageActor(battle, actors[0].id, 20, '挥砍').battle, actors[1].id, 20, '挥砍').battle;
  const reward = encounterReward(both);
  assert.deepEqual(reward, { xp: 100, defeated: 2, remaining: 0, completed: true });
  assert.match(rewardSummary(both), /战斗结束：击败 2 个单位，共 100 点经验。/);
});

test('仍有敌人时说明剩余数量', () => {
  const { battle, actors } = setup(2);
  const one = damageActor(battle, actors[0].id, 20, '挥砍').battle;
  assert.deepEqual(encounterReward(one), { xp: 50, defeated: 1, remaining: 1, completed: false });
  assert.match(rewardSummary(one), /已击败 1 个单位，获得 50 点经验；仍有 1 个敌方单位在场。/);
});

test('尚未击败任何单位时给出提示', () => {
  const { battle } = setup(2);
  assert.match(rewardSummary(battle), /尚未击败任何单位，仍有 2 个敌方单位在场。/);
  assert.equal(encounterReward(battle).completed, false);
});

