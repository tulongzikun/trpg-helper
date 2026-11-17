const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, addUnidentifiedItem, identifyItem, useItem } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '鉴定', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const foe = { ...base.actors[0], id: 'foe', name: '雾影兽', currentHp: 40, maxHp: 40 };
  const hero = { ...foe, id: 'hero', name: '艾拉', side: '友方' };
  return startCombat({ ...base, actors: [hero, foe] }, { hero: 20, foe: 10 });
}

test('未鉴定物品标记为未鉴定且不能使用', () => {
  let battle = addUnidentifiedItem(setup(), 'hero', '神秘药水', 1, '2d4+2', ids());
  const hero = battle.actors.find(item => item.id === 'hero');
  assert.equal(hero.combat.items[0].identified, false);
  assert.throws(() => useItem(battle, 'hero', '神秘药水', undefined, ids()), /尚未鉴定，无法使用。/);
});

test('鉴定消耗动作并解除限制', () => {
  let battle = addUnidentifiedItem(setup(), 'hero', '神秘药水', 1, '2d4+2', ids());
  battle = identifyItem(battle, 'hero', '神秘药水', ids());
  const hero = battle.actors.find(item => item.id === 'hero');
  assert.equal(hero.combat.items[0].identified, true);
  assert.equal(hero.combat.actionUsed, true);
  assert.match(battle.combat.log.at(-1).text, /鉴定了「神秘药水」/);
});

test('重复鉴定与不存在物品报错', () => {
  let battle = addUnidentifiedItem(setup(), 'hero', '神秘药水', 1, '2d4+2', ids());
  battle = identifyItem(battle, 'hero', '神秘药水', ids());
  const back = { ...battle, actors: battle.actors.map(item => item.id === 'hero' ? { ...item, combat: { ...item.combat, actionUsed: false } } : item) };
  assert.throws(() => identifyItem(back, 'hero', '神秘药水', ids()), /已经鉴定过了。/);
  assert.throws(() => identifyItem(back, 'hero', '不存在', ids()), /该单位没有「不存在」这个物品。/);
});

test('鉴定只能用当前回合的动作', () => {
  const battle = addUnidentifiedItem(setup(), 'hero', '神秘药水', 1, '2d4+2', ids());
  assert.throws(() => identifyItem(battle, 'foe', '神秘药水', ids()), /只有当前回合的单位可以鉴定物品。|该单位没有「神秘药水」这个物品。/);
});
