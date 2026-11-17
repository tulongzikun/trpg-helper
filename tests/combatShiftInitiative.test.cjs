const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, endTurn, shiftInitiative, currentActorId } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `shift-${++counter}`;

function setup() {
  const store = addMonsters(
    emptyStore(),
    card,
    { newBattleName: '先攻调整', side: '敌方', count: 2, distinctEntries: [entry, { ...entry, name: '哥布林二号', statBlocks: [{ ...entry.statBlocks[0], name: '哥布林二号' }] }] },
    ids(),
    () => '2026-01-01T00:00:00Z',
  ).store;
  const battle = store.battles[0];
  const initiatives = {};
  battle.actors.forEach((actor, index) => { initiatives[actor.id] = 20 - index * 5; });
  return { battle: startCombat(battle, initiatives), first: battle.actors[0].id, second: battle.actors[1].id };
}

test('后移一位改变顺序', () => {
  const { battle, first, second } = setup();
  const next = shiftInitiative(battle, first, 1);
  assert.equal(next.combat.order[0], second);
  assert.equal(next.combat.order[1], first);
});

test('前移一位把单位推到前面', () => {
  const { battle, first, second } = setup();
  const next = shiftInitiative(battle, second, -1);
  assert.equal(next.combat.order[0], second);
  assert.equal(next.combat.order[1], first);
});

test('当前行动者保持不变', () => {
  const { battle, first } = setup();
  assert.equal(currentActorId(battle), first);
  const next = shiftInitiative(battle, first, 1);
  assert.equal(currentActorId(next), first);
  assert.equal(next.combat.order[next.combat.turnIndex], first);
});

test('第一位不能再前移', () => {
  const { battle, first } = setup();
  assert.throws(() => shiftInitiative(battle, first, -1), /已经排在先攻顺序的第一位。/);
});

test('最后一位不能再后移', () => {
  const { battle, first } = setup();
  const shifted = shiftInitiative(battle, first, 1);
  assert.equal(shifted.combat.order[1], first);
  assert.throws(() => shiftInitiative(shifted, first, 1), /已经排在先攻顺序的最后一位。/);
});

test('回合推进仍按新顺序进行', () => {
  const { battle, first, second } = setup();
  const shifted = shiftInitiative(battle, first, 1);
  const advanced = endTurn(shifted);
  assert.equal(currentActorId(advanced), second);
});
