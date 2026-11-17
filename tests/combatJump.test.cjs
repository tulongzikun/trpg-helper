const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter, damageTypes } = require('../apps/web/src/battle.ts');
const { addHazard, configureGrid, jumpToCell, moveActorToCell, startCombat, toggleDifficultCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-jump', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, saveProficiencies: [],
    actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: { equipment: '长剑' },
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '跳跃', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  const started = startCombat(withHero, initiatives);
  const friend = started.actors.find(actor => actor.side === '友方');
  let grid = configureGrid(started, { width: 20, height: 10, cellFt: 5 });
  grid = moveActorToCell(grid, friend.id, 1, 1);
  const monster = grid.actors.find(actor => actor.side === '敌方');
  grid = moveActorToCell(grid, monster.id, 5, 5);
  return { battle: grid, friend };
}

test('跳跃按直线距离消耗，不因困难地形翻倍', () => {
  const { battle, friend } = setup();
  const rough = toggleDifficultCell(battle, 2, 1);
  const jumped = jumpToCell(rough, friend.id, 2, 1);
  const record = jumped.combat.log.at(-1);
  assert.ok(record.text.includes('跳跃到 (2, 1)'));
  assert.ok(record.text.includes('消耗 5 尺'));
  const walked = moveActorToCell(rough, friend.id, 2, 1);
  assert.ok(walked.combat.log.at(-1).text.includes('困难地形使消耗翻倍'));
});

test('跳跃距离不能超过力量值尺', () => {
  const { battle, friend } = setup();
  assert.throws(() => jumpToCell(battle, friend.id, 9, 1), /跳跃距离超出上限（16 尺）/);
  assert.ok(jumpToCell(battle, friend.id, 4, 1));
});

test('不能跳到墙格或被占用的格子', () => {
  const { battle, friend } = setup();
  const occupied = battle.actors.find(actor => actor.id !== friend.id);
  assert.throws(() => jumpToCell(battle, friend.id, occupied.position.x, occupied.position.y), /该格已有单位/);
  assert.throws(() => jumpToCell(battle, friend.id, 25, 1), /目标格子超出战场范围/);
});

test('跳跃落点不会触发危险地形伤害', () => {
  const { battle, friend } = setup();
  const hazard = addHazard(battle, { x: 2, y: 1, damageExpression: '2d6', damageType: '火焰' });
  const jumped = jumpToCell(hazard, friend.id, 2, 1);
  const actor = jumped.actors.find(item => item.id === friend.id);
  assert.equal(actor.currentHp, 40);
  assert.ok(jumped.combat.log.some(record => record.text.includes('跳跃到 (2, 1)')));
});

test('跳跃仍受移动力上限约束且需要当前回合', () => {
  const { battle, friend } = setup();
  const moved = moveActorToCell(battle, friend.id, 4, 1);
  const jumped = jumpToCell(moved, friend.id, 7, 1);
  assert.throws(() => jumpToCell(jumped, friend.id, 8, 1), /移动距离超出速度上限（30 尺）/);
  const monster = moved.actors.find(actor => actor.side === '敌方');
  assert.throws(() => jumpToCell(moved, monster.id, 3, 3), /只有当前回合的单位可以跳跃/);
});
