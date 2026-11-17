const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, castPolymorph, endTurn } = require('../apps/web/src/combat.ts');
const { actionBlocker } = require('../apps/web/src/combatModifiers.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `poly-exp-${++counter}`;

const mage = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-poly-exp', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '西奥', species: '人类', characterClass: '法师', level: 9,
    abilities: { str: 8, dex: 13, con: 12, int: 18, wis: 11, cha: 10 },
    maxHp: 44, armorClass: 12, speedFt: 30, actions: '火焰箭：+5 命中，1d10 火焰伤害，射程 60 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '变形到期', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const withMage = addCharacter(store, mage, { battleId: store.battles[0].id, side: '友方' }, ids());
  const battle = withMage.store.battles[0];
  const mageId = battle.actors.find(actor => actor.name === '西奥').id;
  const foeId = battle.actors.find(actor => actor.side === '敌方').id;
  const initiatives = {};
  battle.actors.forEach((actor) => { initiatives[actor.id] = actor.id === mageId ? 20 : 10; });
  return { battle: startCombat(battle, initiatives), mageId, foeId };
}

// 每次回合结束都会让所有轮数计时器递减一格，推进若干回合即可让 10 轮到期
function advance(battle, rounds) {
  let current = battle;
  for (let index = 0; index < rounds; index += 1) current = endTurn(current, { random: () => 0.99 });
  return current;
}

test('变形术到期后摘掉失能标记', () => {
  const { battle, mageId, foeId } = setup();
  const shaped = castPolymorph(battle, mageId, foeId, { random: () => 0.01 }).battle;
  assert.ok(shaped.actors.find(actor => actor.id === foeId).combat.conditions.includes('失能'));
  const expired = advance(shaped, 22);
  const after = expired.actors.find(actor => actor.id === foeId).combat;
  assert.equal(after.polymorphed, undefined);
  assert.equal(after.conditions.includes('失能'), false);
});

test('变形术未到期时失能仍然存在', () => {
  const { battle, mageId, foeId } = setup();
  const shaped = castPolymorph(battle, mageId, foeId, { random: () => 0.01 }).battle;
  const later = advance(shaped, 2);
  const after = later.actors.find(actor => actor.id === foeId).combat;
  assert.ok(after.polymorphed > 0);
  assert.ok(after.conditions.includes('失能'));
});

test('到期后不再是失能状态，可以行动', () => {
  const { battle, mageId, foeId } = setup();
  const shaped = castPolymorph(battle, mageId, foeId, { random: () => 0.01 }).battle;
  const expired = advance(shaped, 22);
  const foe = expired.actors.find(actor => actor.id === foeId);
  assert.equal(actionBlocker(foe), null);
});

test('变形术到期会写日志', () => {
  const { battle, mageId, foeId } = setup();
  const shaped = castPolymorph(battle, mageId, foeId, { random: () => 0.01 }).battle;
  const expired = advance(shaped, 22);
  const texts = expired.combat.log.map(item => item.text);
  assert.ok(texts.some(text => text.includes('变形术结束了')));
});
