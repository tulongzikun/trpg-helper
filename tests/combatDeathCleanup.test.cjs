const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  addAura, addOngoingEffect, damageActor, markSummon, startCombat, startConcentration,
} = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-death', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '法师', level: 5,
    abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    maxHp: 40, armorClass: 14, speedFt: 30, actions: '', notes: '', details: { equipment: '' },
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '死亡收尾', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const friend = withHero.actors.find(actor => actor.side === '友方');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  const started = startCombat(withHero, { [friend.id]: 20, [monster.id]: 10 });
  return { battle: started, friend, monster };
}

test('死亡会移除自身灵光', () => {
  const { battle, friend } = setup();
  const withAura = addAura(battle, { name: '守护灵光', ownerId: friend.id, radiusFt: 10, bonus: 2, kind: 'ac' });
  assert.equal(withAura.auras.length, 1);
  const result = damageActor(withAura, friend.id, 100, '挥砍', { random: sequence(0.5), makeId: ids() });
  assert.equal(result.battle.auras, undefined);
  assert.ok(result.battle.combat.log.some(item => /灵光随之消失/.test(item.text)));
});

test('死亡会中断专注并驱散召唤物', () => {
  const { battle, friend, monster } = setup();
  const focused = startConcentration(battle, friend.id, '召唤元素');
  const summoned = markSummon(focused, monster.id, { ownerId: friend.id });
  assert.equal(summoned.actors.length, 2);
  const result = damageActor(summoned, friend.id, 100, '挥砍', { random: sequence(0.5), makeId: ids() });
  const hero = result.battle.actors.find(actor => actor.id === friend.id);
  assert.equal(hero.combat.concentration, undefined);
  assert.equal(result.battle.actors.length, 1);
  assert.ok(result.battle.combat.log.some(item => /中断了对「召唤元素」的专注/.test(item.text)));
});

test('死亡会清除自身持续效果', () => {
  const { battle, friend } = setup();
  const poisoned = addOngoingEffect(battle, friend.id, { name: '剧毒', damageExpression: '1d6', damageType: '毒素' });
  const result = damageActor(poisoned.battle, friend.id, 100, '挥砍', { random: sequence(0.5), makeId: ids() });
  const hero = result.battle.actors.find(actor => actor.id === friend.id);
  assert.equal(hero.combat.ongoing, undefined);
  assert.ok(result.battle.combat.log.some(item => /持续效果一并清除/.test(item.text)));
});

test('倒地但未死亡时不会触发收尾', () => {
  const { battle, friend } = setup();
  const withAura = addAura(battle, { name: '守护灵光', ownerId: friend.id, radiusFt: 10, bonus: 2, kind: 'ac' });
  const wounded = damageActor(withAura, friend.id, 5, '挥砍', { random: sequence(0.5), makeId: ids() });
  assert.equal(wounded.battle.actors.find(actor => actor.id === friend.id).combat.status, 'active');
  assert.equal(wounded.battle.auras.length, 1);
});
