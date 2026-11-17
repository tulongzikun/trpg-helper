const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, setExhaustion, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `exh-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '力竭', side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const hero = battle.actors[0];
  hero.name = '英雄';
  const foe = { ...structuredClone(hero), id: 'foe-1', name: '敌人', side: '敌方' };
  foe.combat = undefined;
  battle.actors.push(foe);
  battle = structuredClone(startCombat(battle, { [hero.id]: 20, 'foe-1': 10 }));
  return { battle, heroId: hero.id };
}

const textsOf = battle => (battle.combat?.log ?? []).map(item => item.text);
const actorOf = (battle, id) => battle.actors.find(actor => actor.id === id);

test('力竭 6 级直接死亡', () => {
  const { battle, heroId } = setup();
  const done = setExhaustion(battle, heroId, 6);
  const hero = actorOf(done, heroId);
  assert.equal(hero.combat.status, 'dead');
  assert.equal(hero.combat.exhaustion, 6);
  assert.ok(textsOf(done).some(text => /力竭达到 6 级，生命终结/.test(text)));
});

test('力竭 5 级不会致死', () => {
  const { battle, heroId } = setup();
  const tired = setExhaustion(battle, heroId, 5);
  assert.equal(actorOf(tired, heroId).combat.status, 'active');
  assert.ok(!textsOf(tired).some(text => /生命终结/.test(text)));
});

test('力竭 0 级清除状态', () => {
  const { battle, heroId } = setup();
  const tired = setExhaustion(battle, heroId, 3);
  const rested = setExhaustion(tired, heroId, 0);
  assert.equal(actorOf(rested, heroId).combat.exhaustion, undefined);
  assert.ok(textsOf(rested).some(text => /力竭解除/.test(text)));
});

test('力竭等级影响日志中的惩罚数值', () => {
  const { battle, heroId } = setup();
  const tired = setExhaustion(battle, heroId, 2);
  assert.ok(textsOf(tired).some(text => /攻击、豁免与属性检定 -4，速度 -10 尺/.test(text)));
});

test('已经死亡的单位再次设置力竭不会重复结算', () => {
  const { battle, heroId } = setup();
  const once = setExhaustion(battle, heroId, 6);
  const twice = setExhaustion(once, heroId, 6);
  const deaths = textsOf(twice).filter(text => /生命终结/.test(text));
  assert.equal(deaths.length, 1);
});
