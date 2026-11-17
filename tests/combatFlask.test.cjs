const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { configureGrid, endTurn, moveActorToCell, startCombat, throwFlask } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `flask-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup(items = [{ name: '圣水', quantity: 2 }]) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '投掷', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const build = (id, name, side) => ({ ...base.actors[0], id, name, side });
  const seeded = { ...base, actors: [build('thrower', '艾拉', '友方'), build('foe', '哥布林', '敌方')] };
  const config = configureGrid(seeded, { width: 20, height: 20, cellFt: 5 });
  let battle = startCombat(config, { thrower: 20, foe: 10 });
  battle = moveActorToCell(battle, 'thrower', 2, 2);
  battle = moveActorToCell(battle, 'foe', 5, 2);
  const clone = structuredClone(battle);
  clone.actors.find(actor => actor.id === 'thrower').combat.items = items.map(item => ({ ...item }));
  return clone;
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;

test('投掷圣水命中会造成光耀伤害，并消耗动作与物品', () => {
  const battle = setup([{ name: '圣水', quantity: 2 }]);
  const result = throwFlask(battle, 'thrower', 'foe', 'holy-water', { random: sequence(0.99, 0.5, 0.5), makeId: ids() });
  assert.equal(result.outcome.hit, true);
  assert.equal(result.outcome.natural, 20);
  assert.equal(result.outcome.damage, 8);
  assert.equal(result.outcome.ongoing, false);
  const throwerState = stateOf(result.battle, 'thrower');
  assert.equal(throwerState.actionUsed, true);
  assert.equal(throwerState.items[0].quantity, 1);
  const foe = result.battle.actors.find(actor => actor.id === 'foe');
  assert.ok(foe.currentHp < foe.maxHp);
  assert.ok(result.battle.combat.log.some(line => line.text.includes('投掷圣水')));
});

test('未命中不造成伤害，但仍消耗动作与物品', () => {
  const battle = setup([{ name: '圣水', quantity: 3 }]);
  const result = throwFlask(battle, 'thrower', 'foe', 'holy-water', { random: sequence(0, 0.5), makeId: ids() });
  assert.equal(result.outcome.hit, false);
  assert.equal(result.outcome.damage, 0);
  const throwerState = stateOf(result.battle, 'thrower');
  assert.equal(throwerState.actionUsed, true);
  assert.equal(throwerState.items[0].quantity, 2);
  assert.equal(result.battle.actors.find(actor => actor.id === 'foe').currentHp, battle.actors.find(actor => actor.id === 'foe').currentHp);
});

test('炽火胶命中会附加可豁免终止的持续火焰伤害', () => {
  const battle = setup([{ name: '炽火胶', quantity: 1 }]);
  const result = throwFlask(battle, 'thrower', 'foe', 'alchemists-fire', { random: sequence(0.99, 0.5), makeId: ids() });
  assert.equal(result.outcome.hit, true);
  assert.equal(result.outcome.ongoing, true);
  assert.equal(result.outcome.damage, 3);
  const foeState = stateOf(result.battle, 'foe');
  assert.equal(foeState.ongoing.length, 1);
  assert.equal(foeState.ongoing[0].name, '炽火胶');
  assert.deepEqual(foeState.ongoing[0].saveEnds, { ability: 'dex', dc: 10 });
  const before = result.battle.actors.find(actor => actor.id === 'foe').currentHp;
  const burned = endTurn(result.battle, { random: sequence(0, 0.5) });
  assert.ok(burned.actors.find(actor => actor.id === 'foe').currentHp < before);
});

test('背包里没有对应的投掷物时拒绝投掷', () => {
  const battle = setup([{ name: '圣水', quantity: 1 }]);
  assert.throws(() => throwFlask(battle, 'thrower', 'foe', 'alchemists-fire', { random: sequence(0.99) }), /背包里没有炽火胶/);
  const empty = structuredClone(battle);
  empty.actors.find(actor => actor.id === 'thrower').combat.items = [];
  assert.throws(() => throwFlask(empty, 'thrower', 'foe', 'holy-water', { random: sequence(0.99) }), /背包里没有圣水/);
});

test('超出 20 尺、非当前回合与动作已用都会被拒绝', () => {
  const battle = setup([{ name: '圣水', quantity: 2 }]);
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === 'foe').position = { x: 14, y: 2 };
  assert.throws(() => throwFlask(far, 'thrower', 'foe', 'holy-water', { random: sequence(0.99) }), /超出 20 尺/);
  const otherTurn = endTurn(battle, { random: sequence(0.5) });
  assert.throws(() => throwFlask(otherTurn, 'thrower', 'foe', 'holy-water', { random: sequence(0.99) }), /只有当前回合的单位/);
  const used = throwFlask(battle, 'thrower', 'foe', 'holy-water', { random: sequence(0.99, 0.5, 0.5) });
  assert.throws(() => throwFlask(used.battle, 'thrower', 'foe', 'holy-water', { random: sequence(0.99) }), /已经使用过动作/);
});

test('用光的投掷物会从背包里移除', () => {
  const battle = setup([{ name: '圣水', quantity: 1 }]);
  const result = throwFlask(battle, 'thrower', 'foe', 'holy-water', { random: sequence(0.99, 0.5, 0.5) });
  assert.equal(stateOf(result.battle, 'thrower').items.length, 0);
});
