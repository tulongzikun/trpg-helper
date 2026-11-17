const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { castSleep, configureGrid, damageActor, moveActorToCell, startCombat, wakeUp } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `sleep-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };
/** 5d8 每颗取 2 点（0.125）。 */
const poolTen = () => sequence(0.125, 0.125, 0.125, 0.125, 0.125);

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '沉睡', side: '敌方', count: 3 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const config = configureGrid(store.battles[0], { width: 10, height: 10, cellFt: 5 });
  const [caster, weak, strong] = config.actors.map(actor => actor.id);
  let battle = startCombat(config, { [caster]: 20, [weak]: 15, [strong]: 10 });
  battle = moveActorToCell(battle, caster, 2, 2);
  battle = moveActorToCell(battle, weak, 3, 2);
  battle = moveActorToCell(battle, strong, 4, 2);
  battle.actors.find(actor => actor.id === weak).currentHp = 5;
  battle.actors.find(actor => actor.id === strong).currentHp = 30;
  return { battle, caster, weak, strong };
}

test('沉睡术按生命值由低到高消耗生命池', () => {
  const { battle, caster, weak, strong } = setup();
  const result = castSleep(battle, caster, [weak, strong], { random: poolTen() });
  assert.equal(result.pool, 5);
  assert.deepEqual(result.slept, [weak]);
  const weakState = result.battle.actors.find(actor => actor.id === weak).combat;
  assert.equal(weakState.sleeping, true);
  assert.ok(weakState.conditions.includes('失能'));
  assert.ok(weakState.conditions.includes('倒地'));
  assert.notEqual(result.battle.actors.find(actor => actor.id === strong).combat.sleeping, true);
  assert.ok(result.battle.combat.log.some(line => line.text.includes('陷入沉睡')));
  assert.equal(result.battle.actors.find(actor => actor.id === caster).combat.actionUsed, true);
});

test('受到伤害会从沉睡中醒来', () => {
  const { battle, caster, weak } = setup();
  const slept = castSleep(battle, caster, [weak], { random: poolTen() }).battle;
  const hit = damageActor(slept, weak, 1, '挥砍');
  const state = hit.battle.actors.find(actor => actor.id === weak).combat;
  assert.equal(state.sleeping, undefined);
  assert.ok(!state.conditions.includes('失能'));
  assert.ok(!state.conditions.includes('倒地'));
  assert.ok(hit.battle.combat.log.some(line => line.text.includes('从沉睡中醒来')));
});

test('唤醒动作移除沉睡状态', () => {
  const { battle, caster, weak, strong } = setup();
  const slept = castSleep(battle, caster, [weak], { random: poolTen() }).battle;
  const woken = wakeUp(slept, strong, weak);
  const state = woken.actors.find(actor => actor.id === weak).combat;
  assert.equal(state.sleeping, undefined);
  assert.ok(!state.conditions.includes('失能'));
  assert.ok(woken.combat.log.some(line => line.text.includes('叫醒了')));
});

test('唤醒只能对沉睡者使用', () => {
  const { battle, strong, weak } = setup();
  assert.throws(() => wakeUp(battle, strong, weak), /该单位没有处于沉睡/);
});

test('沉睡术会拒绝超出 20 尺的目标与空目标', () => {
  const { battle, caster, weak } = setup();
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === weak).position = { x: 9, y: 9 };
  assert.throws(() => castSleep(far, caster, [weak], { random: poolTen() }), /只能影响 20 尺/);
  assert.throws(() => castSleep(battle, caster, [], { random: poolTen() }), /请选择沉睡术的目标/);
});

test('生命池不足时无人陷入沉睡，已沉睡的目标会被跳过', () => {
  const { battle, caster, weak, strong } = setup();
  const tinyPool = castSleep(battle, caster, [strong], { random: sequence(0, 0, 0, 0, 0) });
  assert.equal(tinyPool.pool, 5);
  assert.equal(tinyPool.slept.length, 0);
  assert.ok(tinyPool.battle.combat.log.some(line => line.text.includes('无人陷入沉睡')));
  const slept = castSleep(battle, caster, [weak], { random: poolTen() }).battle;
  const again = castSleep(slept, strong, [weak], { random: poolTen() });
  assert.equal(again.slept.length, 0);
});
