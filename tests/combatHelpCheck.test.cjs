const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, helpCheck, abilityCheck } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `hc-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++ % values.length]; };

function hero(name, extra = {}) {
  const sheet = { name, level: 5, characterClass: '战士', abilities: { str: 14, dex: 16, con: 14, int: 12, wis: 12, cha: 10 }, details: { skillProficiencies: ['隐匿', '察觉'], equipment: '短弓' }, actions: '', ...extra };
  return { sheet };
}

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '协助', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const foe = { ...base.actors[0], id: 'foe', name: '雾影兽' };
  const helper = { ...foe, id: 'helper', name: '博尔', side: '友方', characterSnapshot: hero('博尔') };
  const scout = { ...foe, id: 'scout', name: '艾拉', side: '友方', characterSnapshot: hero('艾拉') };
  const battle = startCombat({ ...base, actors: [helper, scout, foe] }, { helper: 20, scout: 10, foe: 5 });
  return battle;
}

test('协助检定让下一次检定取高，并在用掉后清除', () => {
  const battle = helpCheck(setup(), 'helper', 'scout', ids());
  const scout = battle.actors.find(item => item.id === 'scout');
  assert.equal(scout.combat.helpedCheck, true);
  assert.equal(scout.combat.helpedAttack, undefined);
  assert.match(battle.combat.log.at(-1).text, /协助/);
  const result = abilityCheck(battle, { actorId: 'scout', ability: 'dex', skill: '隐匿', dc: 15 }, { random: sequence(0.1, 0.9) });
  assert.equal(result.outcome.mode, 'advantage');
  assert.equal(result.outcome.natural, 19);
  assert.equal(result.battle.actors.find(item => item.id === 'scout').combat.helpedCheck, undefined);
});

test('未协助时检定保持单骰', () => {
  const battle = setup();
  const result = abilityCheck(battle, { actorId: 'scout', ability: 'dex', skill: '隐匿', dc: 15 }, { random: sequence(0.1, 0.9) });
  assert.equal(result.outcome.mode, 'normal');
  assert.equal(result.outcome.natural, 3);
});

test('协助检定消耗协助者的动作', () => {
  const battle = helpCheck(setup(), 'helper', 'scout', ids());
  assert.equal(battle.actors.find(item => item.id === 'helper').combat.actionUsed, true);
  assert.throws(() => helpCheck(battle, 'helper', 'scout', ids()), /该单位本回合已经使用过动作。/);
});

test('不能协助自己或敌对单位', () => {
  const battle = setup();
  assert.throws(() => helpCheck(battle, 'helper', 'helper', ids()), /不能协助自己。/);
  assert.throws(() => helpCheck(battle, 'helper', 'foe', ids()), /只能协助同阵营的单位。/);
});

test('非当前行动者不能发起协助', () => {
  const battle = setup();
  assert.throws(() => helpCheck(battle, 'scout', 'helper', ids()), /只有当前回合的单位可以协助。/);
});
