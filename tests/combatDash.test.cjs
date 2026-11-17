const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { dash, endTurn, spendMovement, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-dash', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: { equipment: '长剑' },
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '疾跑测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const runner = withHero.actors.find(actor => actor.side === '友方');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  return { battle: startCombat(withHero, { [runner.id]: 20, [monster.id]: 10 }), runner, monster };
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;

test('疾跑让本回合的移动力翻倍', () => {
  const { battle, runner } = setup();
  const dashed = dash(battle, runner.id);
  assert.equal(stateOf(dashed, runner.id).dashMovement, 30);
  const moved = spendMovement(dashed, runner.id, 55);
  assert.equal(stateOf(moved, runner.id).movementUsed, 55);
  assert.match(moved.combat.log.at(-1).text, /移动了 55 尺（共 55\/60 尺）/);
});

test('疾跑后仍不能超过两倍速度', () => {
  const { battle, runner } = setup();
  const dashed = dash(battle, runner.id);
  assert.throws(() => spendMovement(dashed, runner.id, 61), /移动距离超出速度上限（60 尺）。/);
});

test('疾跑消耗动作，且只有当前回合单位可以使用', () => {
  const { battle, runner, monster } = setup();
  assert.throws(() => dash(battle, monster.id), /只有当前回合的单位可以疾跑。/);
  const dashed = dash(battle, runner.id);
  assert.equal(stateOf(dashed, runner.id).actionUsed, true);
  assert.throws(() => dash(dashed, runner.id), /该单位本回合已经使用过动作。/);
});

test('新回合开始时疾跑加成与移动消耗都清零', () => {
  const { battle, runner, monster } = setup();
  const dashed = spendMovement(dash(battle, runner.id), runner.id, 40);
  const back = endTurn(endTurn(dashed));
  assert.equal(back.combat.order[back.combat.turnIndex], runner.id);
  assert.equal(stateOf(back, runner.id).dashMovement, 0);
  assert.equal(stateOf(back, runner.id).movementUsed, 0);
  assert.throws(() => spendMovement(back, runner.id, 31), /移动距离超出速度上限（30 尺）。/);
  void monster;
});
