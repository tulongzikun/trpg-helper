const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, moveActorToCell, addItem, lootCorpse, setActorHp } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `lt-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '搜刮', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const foe = { ...base.actors[0], id: 'foe', name: '雾影兽', currentHp: 40, maxHp: 40 };
  const hero = { ...foe, id: 'hero', name: '艾拉', side: '友方' };
  let battle = configureGrid({ ...base, actors: [hero, foe] }, { width: 10, height: 8, cellFt: 5 });
  battle = startCombat(battle, { hero: 20, foe: 10 });
  battle = moveActorToCell(battle, 'hero', 0, 0);
  battle = moveActorToCell(battle, 'foe', 1, 0);
  return battle;
}

test('搜刮阵亡单位把物品转移给自己并合并同名物品', () => {
  let battle = setup();
  battle = addItem(battle, 'foe', '治疗药水', 2, '2d4+2', ids());
  battle = addItem(battle, 'hero', '治疗药水', 1, '2d4+2', ids());
  battle = addItem(battle, 'foe', '解毒剂', 1, undefined, ids());
  const dead = setActorHp(battle, 'foe', 0);
  const result = lootCorpse(dead, 'hero', 'foe', ids());
  const hero = result.battle.actors.find(item => item.id === 'hero');
  const potion = hero.combat.items.find(item => item.name === '治疗药水');
  assert.equal(potion.quantity, 3);
  assert.ok(hero.combat.items.some(item => item.name === '解毒剂'));
  const foe = result.battle.actors.find(item => item.id === 'foe');
  assert.equal(foe.combat.items, undefined);
  assert.deepEqual(result.looted.sort(), ['解毒剂', '治疗药水'].sort());
  assert.match(result.battle.combat.log.at(-1).text, /搜刮了/);
});

test('活着的单位不能被搜刮', () => {
  let battle = setup();
  battle = addItem(battle, 'foe', '治疗药水', 1, '2d4+2', ids());
  assert.throws(() => lootCorpse(battle, 'hero', 'foe', ids()), /只能搜刮已经死亡或投降的单位。/);
});

test('距离过远、身上没东西时报错', () => {
  let battle = setup();
  battle = addItem(battle, 'foe', '治疗药水', 1, '2d4+2', ids());
  battle = setActorHp(battle, 'foe', 0);
  const far = { ...battle, actors: battle.actors.map(item => item.id === 'foe' ? { ...item, position: { x: 8, y: 7 } } : item) };
  assert.throws(() => lootCorpse(far, 'hero', 'foe', ids()), /只能搜刮 5 尺内的尸体。/);
  const empty = { ...battle, actors: battle.actors.map(item => item.id === 'foe' ? { ...item, combat: { ...item.combat, items: undefined } } : item) };
  assert.throws(() => lootCorpse(empty, 'hero', 'foe', ids()), /该单位身上没有可搜刮的物品。/);
});

test('搜刮者不在场时报错', () => {
  let battle = setup();
  battle = addItem(battle, 'foe', '治疗药水', 1, '2d4+2', ids());
  battle = setActorHp(battle, 'foe', 0);
  const down = { ...battle, actors: battle.actors.map(item => item.id === 'hero' ? { ...item, currentHp: 0, combat: { ...item.combat, status: 'down' } } : item) };
  assert.throws(() => lootCorpse(down, 'hero', 'foe', ids()), /只有在场的单位可以搜刮。/);
});
