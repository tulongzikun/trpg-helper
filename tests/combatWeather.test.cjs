const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { attack, damageActor, setFlying, setWeather, startCombat, tickTurnStart } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `weather-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '天气', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const [first, second] = store.battles[0].actors.map(actor => actor.id);
  const battle = startCombat(store.battles[0], { [first]: 20, [second]: 10 });
  return { battle, first, second };
}

const logs = battle => battle.combat.log.map(line => line.text).join('\n');

test('设置与解除天气会写入状态与战报', () => {
  const { battle } = setup();
  const stormy = setWeather(battle, 'rain');
  assert.equal(stormy.weather, 'rain');
  assert.ok(logs(stormy).includes('天气转为暴雨'));
  const windy = setWeather(stormy, 'wind');
  assert.equal(windy.weather, 'wind');
  assert.ok(logs(windy).includes('天气转为强风'));
  const clear = setWeather(windy, null);
  assert.equal(clear.weather, undefined);
  assert.ok(logs(clear).includes('天气放晴了'));
  assert.throws(() => setWeather(clear, null), /当前没有特殊天气/);
});

test('暴雨让远程攻击检定劣势，近战不受影响', () => {
  const { battle, first, second } = setup();
  const rainy = setWeather(battle, 'rain');
  const shot = attack(rainy, { attackerId: first, targetId: second, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍', range: 'ranged', ignoreDistanceCheck: true }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  assert.equal(shot.outcome.mode, 'disadvantage');
  assert.ok(shot.outcome.notes.includes('暴雨：远程攻击检定劣势'));
  const stab = attack(rainy, { attackerId: first, targetId: second, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  assert.equal(stab.outcome.mode, 'normal');
});

test('暴雨让火焰伤害减半，其他伤害不变', () => {
  const { battle, first } = setup();
  const rainy = setWeather(battle, 'rain');
  const fire = damageActor(rainy, first, 10, '火焰');
  assert.equal(fire.outcome.damage, 5);
  const blunt = damageActor(rainy, first, 10, '钝击');
  assert.equal(blunt.outcome.damage, 10);
});

test('强风让远程攻击劣势并写进战报说明', () => {
  const { battle, first, second } = setup();
  const windy = setWeather(battle, 'wind');
  const shot = attack(windy, { attackerId: first, targetId: second, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍', range: 'ranged', ignoreDistanceCheck: true }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  assert.equal(shot.outcome.mode, 'disadvantage');
  assert.ok(shot.outcome.notes.includes('强风：远程攻击检定劣势'));
});

test('强风会把高处的飞行单位吹落并结算坠落伤害', () => {
  const { battle, first } = setup();
  const windy = setWeather(battle, 'wind');
  const airborne = setFlying(windy, first, true);
  const hovered = structuredClone(airborne);
  hovered.actors.find(actor => actor.id === first).elevation = 20;
  const next = tickTurnStart(hovered, { random: sequence(0.1, 0.5, 0.5) });
  const state = next.actors.find(actor => actor.id === first).combat;
  assert.notEqual(state.flying, true);
  assert.equal(next.actors.find(actor => actor.id === first).elevation, undefined);
  assert.ok(state.conditions.includes('倒地'));
  assert.ok(logs(next).includes('在强风中被吹落'));
});

test('强风中通过力量豁免的飞行单位保持飞行', () => {
  const { battle, first } = setup();
  const windy = setWeather(battle, 'wind');
  const airborne = setFlying(windy, first, true);
  const hovered = structuredClone(airborne);
  hovered.actors.find(actor => actor.id === first).elevation = 20;
  const next = tickTurnStart(hovered, { random: sequence(0.95) });
  assert.equal(next.actors.find(actor => actor.id === first).combat.flying, true);
  assert.equal(next.actors.find(actor => actor.id === first).elevation, 20);
  assert.ok(logs(next).includes('在强风中稳住身形'));
});
