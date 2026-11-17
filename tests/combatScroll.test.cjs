const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { addItem, readScroll, scrollDc, scrollSpellOf, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `scroll-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-scroll', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '牧师', level: 5,
    abilities: { str: 12, dex: 12, con: 14, int: 10, wis: 16, cha: 10 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '硬头锤：+5 命中，1d6+2 钝击伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '卷轴', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  const started = startCombat(withHero, initiatives);
  const first = started.actors.find(actor => actor.side === '友方');
  return { battle: started, first };
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;
const actorOf = (battle, id) => battle.actors.find(actor => actor.id === id);
const logs = battle => battle.combat.log.map(line => line.text).join('\n');
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };
const withScroll = (battle, first, name, quantity = 1) => addItem(battle, first.id, name, quantity);

test('卷轴名称解析与 DC', () => {
  assert.equal(scrollSpellOf('法术卷轴：治疗术（1 环）'), '治疗术');
  assert.equal(scrollSpellOf('法术卷轴：群体治疗术（3 环）'), '群体治疗术');
  assert.equal(scrollSpellOf('治疗药水'), null);
  assert.equal(scrollDc('法术卷轴：治疗术（1 环）'), 11);
  assert.equal(scrollDc('法术卷轴：火球术（3 环）'), 13);
  assert.equal(scrollDc('法术卷轴：治疗术'), 11);
});

test('成功阅读卷轴施放治疗术并消耗卷轴', () => {
  const { battle, first } = setup();
  const prepared = withScroll(battle, first, '法术卷轴：治疗术（1 环）');
  actorOf(prepared, first.id).currentHp = 20;
  const result = readScroll(prepared, first.id, '法术卷轴：治疗术（1 环）', { random: sequence(0.5, 0.5, 0.5) });
  assert.equal(result.success, true);
  assert.equal(result.spell, '治疗术');
  assert.ok(actorOf(result.battle, first.id).currentHp > 20);
  assert.equal(stateOf(result.battle, first.id).items, undefined);
  assert.equal(stateOf(result.battle, first.id).actionUsed, true);
  assert.ok(logs(result.battle).includes('施放治疗术'));
});

test('检定失败时卷轴化为灰烬且没有效果', () => {
  const { battle, first } = setup();
  const prepared = withScroll(battle, first, '法术卷轴：治疗术（1 环）');
  actorOf(prepared, first.id).currentHp = 20;
  const result = readScroll(prepared, first.id, '法术卷轴：治疗术（1 环）', { random: sequence(0.05) });
  assert.equal(result.success, false);
  assert.equal(actorOf(result.battle, first.id).currentHp, 20);
  assert.equal(stateOf(result.battle, first.id).items, undefined);
  assert.ok(logs(result.battle).includes('卷轴化为灰烬'));
});

test('祝福术卷轴会让施法者获得祝福并进入专注', () => {
  const { battle, first } = setup();
  const prepared = withScroll(battle, first, '法术卷轴：祝福术（1 环）');
  const result = readScroll(prepared, first.id, '法术卷轴：祝福术（1 环）', { random: sequence(0.9) });
  const state = stateOf(result.battle, first.id);
  assert.equal(result.success, true);
  assert.equal(state.blessed, 10);
  assert.equal(state.concentration.spell, '祝福术');
});

test('数量大于 1 时只减少一个', () => {
  const { battle, first } = setup();
  const prepared = withScroll(battle, first, '法术卷轴：治疗术（1 环）', 2);
  const result = readScroll(prepared, first.id, '法术卷轴：治疗术（1 环）', { random: sequence(0.5, 0.5, 0.5) });
  const items = stateOf(result.battle, first.id).items;
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 1);
});

test('拒绝非卷轴、不存在的物品与已用动作', () => {
  const { battle, first } = setup();
  const potion = addItem(battle, first.id, '治疗药水', 1, '2d4+2');
  assert.throws(() => readScroll(potion, first.id, '治疗药水'), /不是可用的法术卷轴/);
  assert.throws(() => readScroll(battle, first.id, '法术卷轴：治疗术'), /没有「法术卷轴：治疗术」这个物品/);
  const prepared = withScroll(battle, first, '法术卷轴：治疗术（1 环）');
  const spent = structuredClone(prepared);
  spent.actors.find(actor => actor.id === first.id).combat.actionUsed = true;
  assert.throws(() => readScroll(spent, first.id, '法术卷轴：治疗术（1 环）'), /本回合已经使用过动作/);
});
