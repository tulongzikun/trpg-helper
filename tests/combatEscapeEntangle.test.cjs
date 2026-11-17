const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, castEntangle, escapeEntangle, endTurn } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `esc-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-esc', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '苔丝', species: '人类', characterClass: '游侠', level: 3,
    abilities: { str: 14, dex: 16, con: 12, int: 10, wis: 14, cha: 10 },
    maxHp: 28, armorClass: 15, speedFt: 30, actions: '长弓：+7 命中，1d8+3 穿刺伤害，远程 150 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '挣脱', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 10, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const caster = next.actors.find(actor => actor.side === '友方');
  const foe = next.actors.find(actor => actor.side === '敌方');
  caster.position = { x: 0, y: 0 };
  foe.position = { x: 1, y: 0 };
  return { battle: next, caster, foe };
}

const cells = [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }];
const logs = battle => battle.combat.log.map(item => item.text).join('\n');

// 让目标成为当前行动者，并在它回合结束时保持缠绕（豁免失败）
const toFoeTurn = battle => {
  const result = endTurn(battle, { random: sequence(0.01) });
  return result;
};

test('被缠住的单位用动作挣脱成功', () => {
  const { battle, caster, foe } = setup();
  const entangled = castEntangle(battle, caster.id, cells, { random: sequence(0.01) });
  const foeTurn = toFoeTurn(entangled);
  const state = foeTurn.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.entangled, true);
  const result = escapeEntangle(foeTurn, foe.id, { random: sequence(0.99) });
  const after = result.battle.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(after.entangled, undefined);
  assert.equal(after.conditions.includes('束缚'), false);
  assert.equal(after.actionUsed, true);
  assert.equal(result.outcome.success, true);
  assert.match(logs(result.battle), /用动作挣脱了藤蔓/);
});

test('挣脱失败仍被缠住但消耗动作', () => {
  const { battle, caster, foe } = setup();
  const entangled = castEntangle(battle, caster.id, cells, { random: sequence(0.01) });
  const foeTurn = toFoeTurn(entangled);
  const result = escapeEntangle(foeTurn, foe.id, { random: sequence(0.01) });
  const after = result.battle.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(after.entangled, true);
  assert.ok(after.conditions.includes('束缚'));
  assert.equal(after.actionUsed, true);
  assert.equal(result.outcome.success, false);
  assert.match(logs(result.battle), /没能挣脱藤蔓/);
});

test('未被缠住时无法使用挣脱', () => {
  const { battle, foe } = setup();
  const foeTurn = toFoeTurn(battle);
  assert.throws(() => escapeEntangle(foeTurn, foe.id), /该单位没有被藤蔓缠住/);
});

test('非当前回合单位不能挣脱', () => {
  const { battle, caster, foe } = setup();
  const entangled = castEntangle(battle, caster.id, cells, { random: sequence(0.01) });
  assert.throws(() => escapeEntangle(entangled, foe.id), /只有当前回合的单位可以挣脱藤蔓/);
});

test('动作已用后不能再挣脱', () => {
  const { battle, caster, foe } = setup();
  const entangled = castEntangle(battle, caster.id, cells, { random: sequence(0.01) });
  const foeTurn = toFoeTurn(entangled);
  const used = structuredClone(foeTurn);
  used.actors.find(actor => actor.id === foe.id).combat.actionUsed = true;
  assert.throws(() => escapeEntangle(used, foe.id), /该单位本回合已经使用过动作/);
});

test('挣脱后可正常移动', () => {
  const { battle, caster, foe } = setup();
  const entangled = castEntangle(battle, caster.id, cells, { random: sequence(0.01) });
  const foeTurn = toFoeTurn(entangled);
  const freed = escapeEntangle(foeTurn, foe.id, { random: sequence(0.99) }).battle;
  const after = freed.actors.find(actor => actor.id === foe.id);
  assert.equal(after.position.x, 1);
  assert.equal(after.combat.entangled, undefined);
});
