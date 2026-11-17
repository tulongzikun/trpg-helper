const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { drinkHealingPotion, setActorHp, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-potion', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: { equipment: '长剑' },
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '药水测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const drinker = withHero.actors.find(actor => actor.side === '友方');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  return { battle: startCombat(withHero, { [drinker.id]: 20, [monster.id]: 10 }), drinker, monster };
}

const hpOf = (battle, id) => battle.actors.find(actor => actor.id === id).currentHp;
const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;

test('治疗药水恢复 2d4+2 点生命值', () => {
  const { battle, drinker } = setup();
  const hurt = setActorHp(battle, drinker.id, 20);
  const result = drinkHealingPotion(hurt, drinker.id, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.equal(result.healed, 8);
  assert.equal(hpOf(result.battle, drinker.id), 28);
  assert.match(result.battle.combat.log.at(-1).text, /恢复 8 点生命值（2d4\+2 掷出 8）/);
});

test('治疗不会超过最大生命值', () => {
  const { battle, drinker } = setup();
  const hurt = setActorHp(battle, drinker.id, 38);
  const result = drinkHealingPotion(hurt, drinker.id, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.equal(result.healed, 2);
  assert.equal(hpOf(result.battle, drinker.id), 40);
});

test('治疗药水消耗动作', () => {
  const { battle, drinker } = setup();
  const first = drinkHealingPotion(setActorHp(battle, drinker.id, 10), drinker.id, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.equal(stateOf(first.battle, drinker.id).actionUsed, true);
  assert.throws(() => drinkHealingPotion(first.battle, drinker.id, { random: sequence(0.5, 0.5), makeId: ids() }), /该单位本回合已经使用过动作。/);
});

test('治疗药水能唤醒倒地单位', () => {
  const { battle, drinker } = setup();
  const down = setActorHp(battle, drinker.id, 0);
  assert.equal(stateOf(down, drinker.id).status, 'down');
  const result = drinkHealingPotion(down, drinker.id, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.equal(stateOf(result.battle, drinker.id).status, 'active');
  assert.equal(hpOf(result.battle, drinker.id), 8);
});

test('死亡单位无法使用治疗药水', () => {
  const { battle, monster } = setup();
  const dead = setActorHp(battle, monster.id, 0);
  assert.equal(stateOf(dead, monster.id).status, 'dead');
  const monsterTurn = { ...dead, combat: { ...dead.combat, turnIndex: dead.combat.order.indexOf(monster.id) } };
  assert.throws(() => drinkHealingPotion(monsterTurn, monster.id, { random: sequence(0.5, 0.5), makeId: ids() }), /已经死亡的单位无法使用治疗药水。/);
});
