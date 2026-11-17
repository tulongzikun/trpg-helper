const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, castSleep, endConcentration, damageActor, castBless } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `slp-focus-${++counter}`;

const mage = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-slp-focus', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '奥莉', species: '人类', characterClass: '法师', level: 5,
    abilities: { str: 8, dex: 14, con: 12, int: 17, wis: 11, cha: 10 },
    maxHp: 30, armorClass: 12, speedFt: 30, actions: '火焰箭：+4 命中，1d10 火焰伤害，射程 60 尺', notes: '', details: {},
  },
};

// 每次 d8 都掷 1 → 池子 5，足以放倒 5 点生命的目标
const lowRolls = () => ({ random: () => 0 });

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '沉睡专注', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const withMage = addCharacter(store, mage, { battleId: store.battles[0].id, side: '友方' }, ids());
  const battle = withMage.store.battles[0];
  const mageId = battle.actors.find(actor => actor.name === '奥莉').id;
  const foe = battle.actors.find(actor => actor.side === '敌方');
  const initiatives = {};
  battle.actors.forEach((actor) => { initiatives[actor.id] = actor.id === mageId ? 20 : 10; });
  const started = startCombat(battle, initiatives);
  // 目标生命压到 5 点，保证 5d8=5 的池子刚好放倒
  const thinned = {
    ...started,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: started.actors.map(actor => actor.id === foe.id
      ? { ...actor, currentHp: 5, position: { x: 0, y: 2 } }
      : actor.id === mageId ? { ...actor, position: { x: 0, y: 0 } } : actor),
  };
  return { battle: thinned, mageId, foeId: foe.id };
}

test('沉睡术需要维持专注并记录施法者', () => {
  const { battle, mageId, foeId } = setup();
  const result = castSleep(battle, mageId, [foeId], lowRolls());
  const caster = result.battle.actors.find(actor => actor.id === mageId).combat;
  const target = result.battle.actors.find(actor => actor.id === foeId).combat;
  assert.equal(caster.concentration?.spell, '沉睡术');
  assert.equal(target.sleeping, true);
  assert.equal(target.sleepingBy, mageId);
});

test('已经在维持其他专注时不能再施放沉睡术', () => {
  const { battle, mageId, foeId } = setup();
  const blessed = castBless(battle, mageId, [mageId], { random: () => 0.9 });
  // 祝福术已消耗动作，模拟下个回合再施放沉睡术
  const later = { ...blessed, actors: blessed.actors.map(actor => actor.combat ? { ...actor, combat: { ...actor.combat, actionUsed: false } } : actor) };
  assert.throws(() => castSleep(later, mageId, [foeId], lowRolls()), /施法者已经在维持其他专注/);
});

test('结束专注后沉睡者醒来', () => {
  const { battle, mageId, foeId } = setup();
  const slept = castSleep(battle, mageId, [foeId], lowRolls()).battle;
  const woken = endConcentration(slept, mageId);
  const target = woken.actors.find(actor => actor.id === foeId).combat;
  assert.equal(target.sleeping, undefined);
  assert.equal(target.sleepingBy, undefined);
  assert.equal(target.conditions.includes('失能'), false);
  assert.equal(target.conditions.includes('倒地'), false);
});

test('施法者倒下时沉睡者一并醒来', () => {
  const { battle, mageId, foeId } = setup();
  const slept = castSleep(battle, mageId, [foeId], lowRolls()).battle;
  const hurt = damageActor(slept, mageId, 200, '挥砍').battle;
  const target = hurt.actors.find(actor => actor.id === foeId).combat;
  assert.equal(target.sleeping, undefined);
  assert.equal(target.conditions.includes('倒地'), false);
});

test('没有专注时结束专注也不会误唤醒', () => {
  const { battle, foeId } = setup();
  assert.throws(() => endConcentration(battle, foeId), /当前没有维持专注/);
});
