const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { castCommand, configureGrid, endTurn, moveActorToCell, startCombat, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `cmd-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '命令', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const build = (id, name, side) => ({ ...base.actors[0], id, name, side });
  const seeded = { ...base, actors: [build('caster', '艾拉', '友方'), build('foe', '哥布林', '敌方')] };
  const config = configureGrid(seeded, { width: 20, height: 20, cellFt: 5 });
  const [caster, foe] = config.actors.map(actor => actor.id);
  let battle = startCombat(config, { [caster]: 20, [foe]: 10 });
  battle = moveActorToCell(battle, caster, 4, 5);
  battle = moveActorToCell(battle, foe, 5, 5);
  return { battle, caster, foe };
}

test('落地命令：豁免失败立即倒地并消耗动作', () => {
  const { battle, caster, foe } = setup();
  const next = castCommand(battle, caster, foe, 'drop', { random: sequence(0.05) });
  const foeState = next.actors.find(actor => actor.id === foe).combat;
  const casterState = next.actors.find(actor => actor.id === caster).combat;
  assert.ok(foeState.conditions.includes('倒地'));
  assert.equal(casterState.actionUsed, true);
  assert.ok(next.combat.log.some(line => line.text.includes('应声倒地')));
});

test('豁免成功时命令术无效', () => {
  const { battle, caster, foe } = setup();
  const next = castCommand(battle, caster, foe, 'drop', { random: sequence(0.99) });
  const foeState = next.actors.find(actor => actor.id === foe).combat;
  assert.ok(!foeState.conditions.includes('倒地'));
  assert.equal(foeState.commanded, undefined);
  assert.ok(next.combat.log.some(line => line.text.includes('抵抗住了')));
});

test('停止命令：目标的下一个回合被自动跳过', () => {
  const { battle, caster, foe } = setup();
  const halted = castCommand(battle, caster, foe, 'halt', { random: sequence(0.05) });
  const foeState = halted.actors.find(actor => actor.id === foe).combat;
  assert.equal(foeState.commanded, 'halt');
  const passed = endTurn(halted, { random: sequence(0.05) });
  assert.equal(passed.combat.order[passed.combat.turnIndex], caster);
  const afterState = passed.actors.find(actor => actor.id === foe).combat;
  assert.equal(afterState.commanded, undefined);
  assert.ok(passed.combat.log.some(line => line.text.includes('受命令术影响，整个回合无法行动')));
});

test('命令术拒绝自己、无效指令与超距', () => {
  const { battle, caster, foe } = setup();
  assert.throws(() => castCommand(battle, caster, caster, 'drop'), /不能对自己施放/);
  assert.throws(() => castCommand(battle, caster, foe, 'flee'), /指令无效/);
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === foe).position = { x: 19, y: 19 };
  assert.throws(() => castCommand(far, caster, foe, 'drop'), /60 尺内的单位/);
});

test('沉默区域内无法施放命令术，长休清除停止标记', () => {
  const { battle, caster, foe } = setup();
  const silenced = structuredClone(battle);
  silenced.silence = [{ x: 4, y: 5 }];
  assert.throws(() => castCommand(silenced, caster, foe, 'drop'), /沉默区域/);
  const halted = castCommand(battle, caster, foe, 'halt', { random: sequence(0.05) });
  const rested = takeLongRest(halted);
  assert.equal(rested.actors.find(actor => actor.id === foe).combat.commanded, undefined);
});

test('动作已用或不在场时拒绝施放', () => {
  const { battle, caster, foe } = setup();
  const busy = structuredClone(battle);
  busy.actors.find(actor => actor.id === caster).combat.actionUsed = true;
  assert.throws(() => castCommand(busy, caster, foe, 'drop'), /已经使用过动作/);
  const downed = structuredClone(battle);
  downed.actors.find(actor => actor.id === foe).combat.status = 'down';
  assert.throws(() => castCommand(downed, caster, foe, 'drop'), /只能对在场的单位/);
});
