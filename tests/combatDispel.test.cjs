const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { castDispelMagic, castFear, configureGrid, endTurn, moveActorToCell, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `dispel-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '驱散', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const build = (id, name, side) => ({ ...base.actors[0], id, name, side });
  const seeded = { ...base, actors: [build('caster', '艾拉', '友方'), build('foe', '哥布林', '敌方')] };
  const config = configureGrid(seeded, { width: 20, height: 20, cellFt: 5 });
  let battle = startCombat(config, { caster: 20, foe: 10 });
  battle = moveActorToCell(battle, 'caster', 2, 2);
  battle = moveActorToCell(battle, 'foe', 6, 2);
  return battle;
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;

test('驱散魔法成功时解除目标身上的恐惧术', () => {
  const base = setup();
  const feared = castFear(base, 'caster', ['foe'], { random: sequence(0.05) });
  const ready = structuredClone(feared);
  ready.actors.find(actor => actor.id === 'caster').combat.actionUsed = false;
  const result = castDispelMagic(ready, 'caster', 'foe', { random: sequence(0.99) });
  assert.equal(result.outcome.success, true);
  assert.deepEqual(result.outcome.dispelled, ['恐惧术']);
  const foeState = stateOf(result.battle, 'foe');
  assert.equal(foeState.frightened, undefined);
  assert.equal(foeState.frightenedBy, undefined);
  assert.ok(!foeState.conditions.includes('恐慌'));
  assert.equal(stateOf(result.battle, 'caster').actionUsed, true);
  assert.ok(result.battle.combat.log.some(line => line.text.includes('驱散了恐惧术')));
});

test('检定失败时不解除任何效果', () => {
  const base = setup();
  const feared = castFear(base, 'caster', ['foe'], { random: sequence(0.05) });
  const ready = structuredClone(feared);
  ready.actors.find(actor => actor.id === 'caster').combat.actionUsed = false;
  const result = castDispelMagic(ready, 'caster', 'foe', { random: sequence(0) });
  assert.equal(result.outcome.success, false);
  assert.deepEqual(result.outcome.dispelled, []);
  assert.equal(stateOf(result.battle, 'foe').frightened, 10);
  assert.ok(result.battle.combat.log.some(line => line.text.includes('未能驱散')));
});

test('目标没有可驱散效果时仍消耗动作', () => {
  const base = setup();
  const result = castDispelMagic(base, 'caster', 'foe', { random: sequence(0.99) });
  assert.equal(result.outcome.success, true);
  assert.deepEqual(result.outcome.dispelled, []);
  assert.equal(stateOf(result.battle, 'caster').actionUsed, true);
  assert.ok(result.battle.combat.log.some(line => line.text.includes('没有可驱散的法术效果')));
});

test('驱散魔法受 120 尺距离限制', () => {
  const base = setup();
  const far = structuredClone(base);
  far.grid = { ...far.grid, width: 40, height: 40 };
  far.actors.find(actor => actor.id === 'foe').position = { x: 30, y: 2 };
  assert.throws(() => castDispelMagic(far, 'caster', 'foe', { random: sequence(0.99) }), /120 尺内/);
});

test('非当前回合、动作已用与死亡目标都会被拒绝', () => {
  const base = setup();
  const other = endTurn(base, { random: sequence(0.5) });
  assert.throws(() => castDispelMagic(other, 'caster', 'foe', { random: sequence(0.99) }), /只有当前回合的单位/);
  const used = castDispelMagic(base, 'caster', 'foe', { random: sequence(0.99) });
  assert.throws(() => castDispelMagic(used.battle, 'caster', 'foe', { random: sequence(0.99) }), /已经使用过动作/);
  const dead = structuredClone(base);
  dead.actors.find(actor => actor.id === 'foe').combat.status = 'dead';
  assert.throws(() => castDispelMagic(dead, 'caster', 'foe', { random: sequence(0.99) }), /已经死亡的单位为目标/);
});

test('沉默区域内无法施放驱散魔法', () => {
  const base = setup();
  const next = structuredClone(base);
  next.silence = [{ x: 2, y: 2 }];
  next.silenceBy = 'someone';
  assert.throws(() => castDispelMagic(next, 'caster', 'foe', { random: sequence(0.99) }), /沉默区域/);
});
