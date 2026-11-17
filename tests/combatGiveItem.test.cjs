const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, moveActorToCell, addItem, giveItem } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `gv-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '递物', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const foe = { ...base.actors[0], id: 'foe', name: '雾影兽', currentHp: 40, maxHp: 40 };
  const hero = { ...foe, id: 'hero', name: '艾拉', side: '友方' };
  const ally = { ...foe, id: 'ally', name: '贝塔', side: '友方' };
  let battle = configureGrid({ ...base, actors: [hero, ally, foe] }, { width: 10, height: 8, cellFt: 5 });
  battle = startCombat(battle, { hero: 20, ally: 15, foe: 10 });
  battle = moveActorToCell(battle, 'hero', 0, 0);
  battle = moveActorToCell(battle, 'ally', 0, 1);
  battle = moveActorToCell(battle, 'foe', 6, 0);
  return battle;
}

test('递给同伴时合并同名物品并扣减数量', () => {
  let battle = setup();
  battle = addItem(battle, 'hero', '治疗药水', 3, '2d4+2', ids());
  battle = addItem(battle, 'ally', '治疗药水', 1, '2d4+2', ids());
  const result = giveItem(battle, 'hero', 'ally', '治疗药水', 2, ids());
  const hero = result.battle.actors.find(item => item.id === 'hero');
  const ally = result.battle.actors.find(item => item.id === 'ally');
  assert.equal(hero.combat.items.find(item => item.name === '治疗药水').quantity, 1);
  assert.equal(ally.combat.items.find(item => item.name === '治疗药水').quantity, 3);
  assert.equal(result.moved, 2);
  assert.match(result.battle.combat.log.at(-1).text, /递给/);
});

test('全部递出后原主人不再保留该物品', () => {
  let battle = setup();
  battle = addItem(battle, 'hero', '解毒剂', 1, undefined, ids());
  const result = giveItem(battle, 'hero', 'ally', '解毒剂', 1, ids());
  const hero = result.battle.actors.find(item => item.id === 'hero');
  assert.equal(hero.combat.items, undefined);
  const ally = result.battle.actors.find(item => item.id === 'ally');
  assert.equal(ally.combat.items.find(item => item.name === '解毒剂').quantity, 1);
});

test('数量与物品校验', () => {
  let battle = setup();
  battle = addItem(battle, 'hero', '治疗药水', 2, '2d4+2', ids());
  assert.throws(() => giveItem(battle, 'hero', 'ally', '治疗药水', 3, ids()), /传递数量须为 1 至 2 的整数。/);
  assert.throws(() => giveItem(battle, 'hero', 'ally', '治疗药水', 0, ids()), /传递数量须为 1 至 2 的整数。/);
  assert.throws(() => giveItem(battle, 'hero', 'ally', '解毒剂', 1, ids()), /该单位没有「解毒剂」这个物品。/);
  assert.throws(() => giveItem(battle, 'hero', 'hero', '治疗药水', 1, ids()), /不能把物品递给自己。/);
});

test('距离与阵营校验', () => {
  let battle = setup();
  battle = addItem(battle, 'hero', '治疗药水', 2, '2d4+2', ids());
  const far = { ...battle, actors: battle.actors.map(item => item.id === 'ally' ? { ...item, position: { x: 7, y: 6 } } : item) };
  assert.throws(() => giveItem(far, 'hero', 'ally', '治疗药水', 1, ids()), /只能把物品传递给 5 尺内的同伴。/);
  assert.throws(() => giveItem(battle, 'hero', 'foe', '治疗药水', 1, ids()), /只能把物品递给同阵营的同伴。/);
  const down = { ...battle, actors: battle.actors.map(item => item.id === 'ally' ? { ...item, currentHp: 0, combat: { ...item.combat, status: 'down' } } : item) };
  assert.throws(() => giveItem(down, 'hero', 'ally', '治疗药水', 1, ids()), /只有在场的单位可以传递物品。/);
});
