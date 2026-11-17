const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, setExhaustion, rerollInitiative, setInitiative } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `init-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-init-exh', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '先攻力竭', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  const started = startCombat(withHero, initiatives);
  return { battle: started, heroId: started.actors.find(actor => actor.side === '友方').id };
}

// 固定 d20 = 10（random 0.45），英雄敏捷 14 → 先攻加值 +2
const fixedDie = () => 0.45;

test('没有力竭时重掷先攻为 d20 + 敏捷加值', () => {
  const { battle, heroId } = setup();
  const rerolled = rerollInitiative(battle, { random: fixedDie });
  const hero = rerolled.actors.find(actor => actor.id === heroId);
  assert.equal(hero.combat.initiative, 12);
});

test('力竭 2 级让重掷的先攻少 4', () => {
  const { battle, heroId } = setup();
  const tired = setExhaustion(battle, heroId, 2);
  const rerolled = rerollInitiative(tired, { random: fixedDie });
  const hero = rerolled.actors.find(actor => actor.id === heroId);
  assert.equal(hero.combat.initiative, 8);
});

test('力竭逐级累加（3 级共 -6）', () => {
  const { battle, heroId } = setup();
  const tired = setExhaustion(battle, heroId, 3);
  const rerolled = rerollInitiative(tired, { random: fixedDie });
  assert.equal(rerolled.actors.find(actor => actor.id === heroId).combat.initiative, 6);
});

test('手动指定的先攻值不受力竭影响', () => {
  const { battle, heroId } = setup();
  const tired = setExhaustion(battle, heroId, 4);
  const adjusted = setInitiative(tired, heroId, 15);
  assert.equal(adjusted.actors.find(actor => actor.id === heroId).combat.initiative, 15);
});

test('力竭提高等级后重掷仍能拉开差距', () => {
  const { battle, heroId } = setup();
  const plain = rerollInitiative(battle, { random: fixedDie });
  const tired = setExhaustion(battle, heroId, 1);
  const lowered = rerollInitiative(tired, { random: fixedDie });
  const plainValue = plain.actors.find(actor => actor.id === heroId).combat.initiative;
  const loweredValue = lowered.actors.find(actor => actor.id === heroId).combat.initiative;
  assert.equal(plainValue - loweredValue, 2);
});
