const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, endTurn, hide, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-hide', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: { equipment: '长剑', skillProficiencies: ['隐匿'] },
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '躲藏测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const sneaker = withHero.actors.find(actor => actor.side === '友方');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  return { battle: startCombat(withHero, { [sneaker.id]: 20, [monster.id]: 10 }), sneaker, monster };
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;
const strike = (attacker, target) => ({
  attackerId: attacker.id, targetId: target.id, attackBonus: 5, damageExpression: '1d8', damageType: '挥砍',
  range: 'melee', distanceFt: 5,
});

test('隐匿高于被动察觉时躲藏成功', () => {
  const { battle, sneaker } = setup();
  const hidden = hide(battle, sneaker.id, 15);
  assert.equal(stateOf(hidden, sneaker.id).hidden, true);
  assert.match(hidden.combat.log.at(-1).text, /躲藏成功（隐匿 15 对被动察觉 11）/);
});

test('隐匿不高于被动察觉时躲藏失败', () => {
  const { battle, sneaker } = setup();
  const failed = hide(battle, sneaker.id, 5);
  assert.equal(stateOf(failed, sneaker.id).hidden, false);
  assert.match(failed.combat.log.at(-1).text, /躲藏失败（隐匿 5 对被动察觉 11）/);
});

test('躲藏中的攻击者获得优势，攻击后现身', () => {
  const { battle, sneaker, monster } = setup();
  const hiddenAgain = endTurn(endTurn(hide(battle, sneaker.id, 15)));
  const result = attack(hiddenAgain, strike(sneaker, monster), { random: sequence(0.1, 0.9), makeId: ids() });
  assert.equal(result.outcome.mode, 'advantage');
  assert.equal(result.outcome.natural, 19);
  assert.equal(stateOf(result.battle, sneaker.id).hidden, false);
  assert.match(String(result.battle.combat.log.at(-1).detail), /攻击者处于躲藏/);
});

test('攻击躲藏中的目标具有劣势，目标被攻击后现身', () => {
  const { battle, sneaker, monster } = setup();
  const monsterTurn = endTurn(battle);
  const monsterHidden = hide(monsterTurn, monster.id, 20);
  const heroTurn = endTurn(monsterHidden);
  const result = attack(heroTurn, strike(sneaker, monster), { random: sequence(0.9, 0.1), makeId: ids() });
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.equal(result.outcome.natural, 3);
  assert.equal(stateOf(result.battle, monster.id).hidden, false);
});

test('躲藏消耗动作并校验检定结果', () => {
  const { battle, sneaker, monster } = setup();
  assert.throws(() => hide(battle, monster.id, 10), /只有当前回合的单位可以躲藏。/);
  assert.throws(() => hide(battle, sneaker.id, 61), /隐匿检定结果须为 0 至 60 的整数。/);
  const hidden = hide(battle, sneaker.id, 15);
  assert.throws(() => hide(hidden, sneaker.id, 15), /该单位本回合已经使用过动作。/);
});
