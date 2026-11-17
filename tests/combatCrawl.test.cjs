const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `crawl-${++counter}`;

function setup(extra) {
  const created = addMonsters(emptyStore(), card, { newBattleName: '爬行', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  battle = structuredClone(configureGrid(battle, { width: 10, height: 10, cellFt: 5 }));
  battle = structuredClone(startCombat(battle, Object.fromEntries(battle.actors.map(actor => [actor.id, 10]))));
  if (extra) extra(battle.actors[0]);
  return { battle, foe: battle.actors[0], other: battle.actors[1] };
}

test('倒地时移动消耗翻倍并写「爬行」日志', () => {
  const { battle, foe } = setup(actor => {
    actor.position = { x: 0, y: 0 };
    actor.combat.conditions.push('倒地');
  });
  const moved = moveActorToCell(battle, foe.id, 1, 0);
  const state = moved.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.movementUsed, 10);
  assert.match(moved.combat.log.at(-1).text, /倒地爬行使消耗翻倍/);
});

test('未倒地时同样的移动只消耗 5 尺', () => {
  const { battle, foe } = setup(actor => { actor.position = { x: 0, y: 0 }; });
  const moved = moveActorToCell(battle, foe.id, 1, 0);
  const state = moved.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.movementUsed, 5);
  assert.doesNotMatch(moved.combat.log.at(-1).text, /爬行/);
});

test('爬行四格即超出速度上限', () => {
  const { battle, foe } = setup(actor => {
    actor.position = { x: 0, y: 0 };
    actor.combat.conditions.push('倒地');
  });
  assert.throws(() => moveActorToCell(battle, foe.id, 4, 0), /移动距离超出速度上限/);
});

test('起身之后不再算爬行', () => {
  const { battle, foe } = setup(actor => {
    actor.position = { x: 0, y: 0 };
    actor.combat.conditions.push('倒地');
  });
  const stood = structuredClone(battle);
  const actor = stood.actors.find(item => item.id === foe.id);
  actor.combat.conditions = actor.combat.conditions.filter(item => item !== '倒地');
  const moved = moveActorToCell(stood, foe.id, 1, 0);
  const state = moved.actors.find(item => item.id === foe.id).combat;
  assert.equal(state.movementUsed, 5);
});

test('飞行单位倒地也不算爬行', () => {
  const { battle, foe } = setup(actor => {
    actor.position = { x: 0, y: 0 };
    actor.combat.conditions.push('倒地');
    actor.combat.flying = true;
  });
  const moved = moveActorToCell(battle, foe.id, 1, 0);
  const state = moved.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.movementUsed, 5);
  assert.doesNotMatch(moved.combat.log.at(-1).text, /爬行/);
});
