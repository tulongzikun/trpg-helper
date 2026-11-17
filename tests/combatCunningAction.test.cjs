const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { cunningAction, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (characterClass, level) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-cunning', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '影刃', species: '人类', characterClass, level,
    abilities: { str: 12, dex: 16, con: 14, int: 12, wis: 12, cha: 10 },
    maxHp: 40, armorClass: 15, speedFt: 30, actions: '', notes: '', details: { equipment: '' },
  },
});

function setup(characterClass, level) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '灵巧动作', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(characterClass, level), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const friend = withHero.actors.find(actor => actor.side === '友方');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  return { battle: startCombat(withHero, initiatives), friend, monster };
}

test('2 级游荡者可以用附赠动作疾跑', () => {
  const { battle, friend } = setup('游荡者', 2);
  const result = cunningAction(battle, friend.id, 'dash');
  const state = result.actors.find(actor => actor.id === friend.id).combat;
  assert.equal(state.bonusUsed, true);
  assert.equal(state.actionUsed, false);
  assert.equal(state.dashMovement, 30);
  assert.match(result.combat.log.at(-1).text, /使用疾跑/);
});

test('灵巧动作撤离同样只花附赠动作', () => {
  const { battle, friend } = setup('游荡者', 2);
  const result = cunningAction(battle, friend.id, 'disengage');
  const state = result.actors.find(actor => actor.id === friend.id).combat;
  assert.equal(state.disengaged, true);
  assert.equal(state.bonusUsed, true);
  assert.equal(state.actionUsed, false);
});

test('附赠动作已用时拒绝第二个灵巧动作', () => {
  const { battle, friend } = setup('游荡者', 2);
  const once = cunningAction(battle, friend.id, 'dash');
  assert.throws(() => cunningAction(once, friend.id, 'disengage'), /该单位本回合已经使用过附赠动作/);
});

test('非游荡者不能使用灵巧动作', () => {
  const { battle, friend } = setup('战士', 5);
  assert.throws(() => cunningAction(battle, friend.id, 'dash'), /只有 2 级以上的游荡者可以使用灵巧动作/);
});

test('1 级游荡者还不能使用灵巧动作', () => {
  const { battle, friend } = setup('游荡者', 1);
  assert.throws(() => cunningAction(battle, friend.id, 'hide'), /只有 2 级以上的游荡者可以使用灵巧动作/);
});

test('灵巧动作躲藏使用隐匿检定', () => {
  const { battle, friend } = setup('游荡者', 2);
  const result = cunningAction(battle, friend.id, 'hide', { random: sequence(0.5), makeId: ids() }, 25);
  const state = result.actors.find(actor => actor.id === friend.id).combat;
  assert.equal(state.bonusUsed, true);
  assert.match(result.combat.log.at(-1).text, /躲藏成功/);
});
