const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { addHazard, configureGrid, endTurn, hazardAt, moveActorToCell, removeHazard, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (equipment) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-hazard', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 60, actions: '', notes: '', details: { equipment },
  },
});

function setup(place = true) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '危险地形', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero('长剑'), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const friend = withHero.actors.find(actor => actor.side === '友方');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  let next = startCombat(withHero, { [friend.id]: 20, [monster.id]: 10 });
  next = configureGrid(next, { width: 10, height: 3, cellFt: 5 });
  if (place) {
    next = moveActorToCell(next, friend.id, 1, 1);
    next = moveActorToCell(next, monster.id, 3, 1);
  }
  return { battle: next, friend, monster };
}

const hpOf = (battle, id) => battle.actors.find(actor => actor.id === id).currentHp;

test('踏入危险地形立即受到伤害', () => {
  const { battle, friend } = setup();
  const withHazard = addHazard(battle, { x: 2, y: 1, damageExpression: '1d6', damageType: '火焰' });
  const moved = moveActorToCell(withHazard, friend.id, 2, 1, { random: sequence(0.5), makeId: ids() });
  assert.equal(hpOf(moved, friend.id), 36);
  assert.match(moved.combat.log.at(-1).text, /踏入危险地形/);
  assert.match(moved.combat.log.at(-1).text, /4 点火焰伤害/);
});

test('放置到危险地形也结算伤害', () => {
  const { battle, friend } = setup(false);
  const withHazard = addHazard(battle, { x: 2, y: 2, damageExpression: '1d6', damageType: '火焰' });
  const placed = moveActorToCell(withHazard, friend.id, 2, 2, { random: sequence(0.5), makeId: ids() });
  assert.equal(hpOf(placed, friend.id), 36);
  assert.match(placed.combat.log.at(-1).text, /踏入危险地形/);
});

test('绕开危险地形不受伤', () => {
  const { battle, friend } = setup();
  const withHazard = addHazard(battle, { x: 2, y: 1, damageExpression: '1d6', damageType: '火焰' });
  const moved = moveActorToCell(withHazard, friend.id, 1, 2);
  assert.equal(hpOf(moved, friend.id), 40);
  assert.ok(!moved.combat.log.at(-1).text.includes('危险地形'));
});

test('危险地形输入校验', () => {
  const { battle } = setup();
  const noGrid = { ...battle, grid: undefined };
  assert.throws(() => addHazard(noGrid, { x: 1, y: 1, damageExpression: '1d6', damageType: '火焰' }), /请先启用方格战场/);
  assert.throws(() => addHazard(battle, { x: 40, y: 1, damageExpression: '1d6', damageType: '火焰' }), /目标格子超出战场范围/);
  assert.throws(() => addHazard(battle, { x: 2, y: 1, damageExpression: '', damageType: '火焰' }), /请填写危险地形的伤害骰/);
  assert.throws(() => addHazard(battle, { x: 2, y: 1, damageExpression: 'abc', damageType: '火焰' }), /伤害骰格式无效/);
  assert.throws(() => addHazard(battle, { x: 2, y: 1, damageExpression: '1d6', damageType: '强酸' }), /危险地形的伤害类型无效/);
});

test('清除危险地形', () => {
  const { battle } = setup();
  const withHazard = addHazard(battle, { x: 2, y: 1, damageExpression: '1d6', damageType: '火焰' });
  assert.ok(hazardAt(withHazard, 2, 1));
  const cleared = removeHazard(withHazard, 2, 1);
  assert.equal(hazardAt(cleared, 2, 1), undefined);
  assert.match(cleared.combat.log.at(-1).text, /危险地形已清除/);
  assert.throws(() => removeHazard(cleared, 2, 1), /该格没有危险地形/);
});

test('关闭方格时清除危险地形', () => {
  const { battle } = setup();
  const withHazard = addHazard(battle, { x: 2, y: 1, damageExpression: '1d6', damageType: '火焰' });
  const closed = configureGrid(withHazard, null);
  assert.equal(closed.hazards, undefined);
});

test('站在危险地形上开始回合也会受伤', () => {
  const { battle, friend } = setup();
  const withHazard = addHazard(battle, { x: 1, y: 1, damageExpression: '1d6', damageType: '火焰' });
  const back = endTurn(endTurn(withHazard, { makeId: ids() }), { random: sequence(0.5), makeId: ids() });
  assert.equal(hpOf(back, friend.id), 36);
  assert.ok(back.combat.log.some(item => /在危险地形/.test(item.text)));
});
