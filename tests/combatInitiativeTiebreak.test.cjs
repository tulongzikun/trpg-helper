const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, setInitiative, addReinforcement } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `tb-${++counter}`;

function unit(base, id, name, side, dex) {
  return { ...base, id, name, side, template: { ...base.template, abilities: { ...(base.template.abilities ?? {}), dex } } };
}

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '平局', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0].actors[0];
  const hero = unit(base, 'hero', '艾拉', '友方', 16);
  const ally = unit(base, 'ally', '贝尔', '友方', 10);
  const enemy = unit(base, 'enemy', '雾影兽', '敌方', 14);
  return { battle: { ...store.battles[0], actors: [hero, ally, enemy] }, hero, ally, enemy };
}

test('先攻相同时按敏捷调整值排序', () => {
  const { battle } = setup();
  const started = startCombat(battle, { hero: 15, ally: 15, enemy: 15 });
  assert.deepEqual(started.combat.order, ['hero', 'enemy', 'ally']);
});

test('敏捷也相同时按名称排序', () => {
  const store = addMonsters(emptyStore(), card, { newBattleName: '同名', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0].actors[0];
  const first = unit(base, 'a1', '阿尔法', '敌方', 12);
  const second = unit(base, 'b1', '贝塔', '敌方', 12);
  const started = startCombat({ ...store.battles[0], actors: [second, first] }, { a1: 10, b1: 10 });
  assert.deepEqual(started.combat.order, ['a1', 'b1']);
});

test('修改先攻造成平局时也按敏捷裁决', () => {
  const { battle } = setup();
  const started = startCombat(battle, { hero: 20, ally: 10, enemy: 5 });
  assert.deepEqual(started.combat.order, ['hero', 'ally', 'enemy']);
  const tied = setInitiative(started, 'ally', 5);
  assert.deepEqual(tied.combat.order, ['hero', 'enemy', 'ally']);
  assert.equal(tied.combat.order[tied.combat.turnIndex], 'hero');
});

test('增援在先攻相同时按敏捷插入到更高敏捷之前', () => {
  const store = addMonsters(emptyStore(), card, { newBattleName: '平局增援', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0].actors[0];
  const slowA = unit(base, 'slowA', '甲', '敌方', 8);
  const slowB = unit(base, 'slowB', '乙', '友方', 8);
  const started = startCombat({ ...store.battles[0], actors: [slowA, slowB] }, { slowA: 15, slowB: 15 });
  const added = addReinforcement(started, card, { side: '敌方', initiative: 15, name: '高敏捷增援' }, ids());
  assert.equal(added.battle.combat.order[0], added.actorId);
  assert.deepEqual(added.battle.combat.order.slice(1), ['slowA', 'slowB']);
});

test('先攻更高时增援插到队列最前并把当前行动者后移', () => {
  const { battle } = setup();
  const started = startCombat(battle, { hero: 15, ally: 15, enemy: 15 });
  const top = addReinforcement(started, card, { side: '敌方', initiative: 25, name: '快增援' }, ids());
  assert.equal(top.battle.combat.order[0], top.actorId);
  assert.equal(top.battle.combat.turnIndex, 1);
  assert.equal(top.battle.combat.order[1], 'hero');
});
