const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { castSleepCloud, configureGrid, endConcentration, endTurn, moveActorToCell, sleepCloudAt, startCombat, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `sleepcloud-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '睡眠云', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const build = (id, name, side) => ({ ...base.actors[0], id, name, side });
  const seeded = { ...base, actors: [build('hero', '艾拉', '友方'), build('foe', '哥布林', '敌方')] };
  const config = configureGrid(seeded, { width: 20, height: 20, cellFt: 5 });
  let battle = startCombat(config, { hero: 20, foe: 10 });
  battle = moveActorToCell(battle, 'hero', 2, 2);
  battle = moveActorToCell(battle, 'foe', 8, 8);
  return battle;
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;
const logs = battle => battle.combat.log.map(line => line.text).join('\n');

test('施放睡眠云会记录格子、消耗动作与专注', () => {
  const battle = setup();
  const next = castSleepCloud(battle, 'hero', [{ x: 7, y: 7 }, { x: 8, y: 8 }, { x: 9, y: 9 }], { random: sequence(0.5) });
  assert.equal(next.sleepCloud.length, 3);
  assert.equal(next.sleepCloudBy, 'hero');
  assert.equal(sleepCloudAt(next, 8, 8), true);
  assert.equal(sleepCloudAt(next, 2, 2), false);
  assert.equal(stateOf(next, 'hero').actionUsed, true);
  assert.equal(stateOf(next, 'hero').concentration.spell, '睡眠云');
  assert.ok(logs(next).includes('施放睡眠云'));
});

test('区域内的单位立刻做感知豁免，失败陷入沉睡', () => {
  const battle = setup();
  const next = castSleepCloud(battle, 'hero', [{ x: 7, y: 7 }, { x: 8, y: 8 }, { x: 9, y: 9 }], { random: sequence(0) });
  const foeState = stateOf(next, 'foe');
  assert.equal(foeState.sleeping, true);
  assert.ok(foeState.conditions.includes('失能'));
  assert.ok(foeState.conditions.includes('倒地'));
  assert.ok(logs(next).includes('吸入睡眠粉尘'));
});

test('豁免成功时不会沉睡', () => {
  const battle = setup();
  const next = castSleepCloud(battle, 'hero', [{ x: 8, y: 8 }], { random: sequence(0.99) });
  assert.equal(stateOf(next, 'foe').sleeping, undefined);
  assert.ok(logs(next).includes('屏住呼吸'));
});

test('走进睡眠云会立刻触发豁免', () => {
  const battle = setup();
  const next = castSleepCloud(battle, 'hero', [{ x: 5, y: 8 }, { x: 4, y: 8 }], { random: sequence(0) });
  assert.equal(stateOf(next, 'foe').sleeping, undefined);
  // 轮到哥布林后走进云里：先推进两个回合让哥布林成为当前单位
  const foeTurn = endTurn(next, { random: sequence(0.99) });
  const walked = moveActorToCell(foeTurn, 'foe', 5, 8, { random: sequence(0) });
  assert.equal(stateOf(walked, 'foe').sleeping, true);
  assert.ok(logs(walked).includes('吸入睡眠粉尘'));
});

test('结束专注与长休都会清除睡眠云', () => {
  const battle = setup();
  const next = castSleepCloud(battle, 'hero', [{ x: 8, y: 8 }], { random: sequence(0.99) });
  const ended = endConcentration(next, 'hero');
  assert.equal(ended.sleepCloud, undefined);
  assert.equal(ended.sleepCloudBy, undefined);
  const rested = takeLongRest(next);
  assert.equal(rested.sleepCloud, undefined);
});

test('非法输入会被拒绝：无方格、空格、超额、越界、非整数与重复专注', () => {
  const battle = setup();
  assert.throws(() => castSleepCloud({ ...battle, grid: undefined }, 'hero', [{ x: 1, y: 1 }]), /请先启用方格战场/);
  assert.throws(() => castSleepCloud(battle, 'hero', []), /请选择睡眠云覆盖的格子/);
  assert.throws(() => castSleepCloud(battle, 'hero', Array.from({ length: 13 }, (_, index) => ({ x: index % 10, y: Math.floor(index / 10) }))), /最多覆盖 12 格/);
  assert.throws(() => castSleepCloud(battle, 'hero', [{ x: 99, y: 1 }]), /超出战场范围/);
  assert.throws(() => castSleepCloud(battle, 'hero', [{ x: 1.5, y: 1 }]), /坐标须为整数/);
  const cast = castSleepCloud(battle, 'hero', [{ x: 8, y: 8 }], { random: sequence(0.99) });
  assert.throws(() => castSleepCloud(cast, 'hero', [{ x: 3, y: 3 }]), /已经使用过动作/);
});
