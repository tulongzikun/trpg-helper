const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { attack, castHoldPerson, configureGrid, endConcentration, endTurn, hostileTargets, moveActorToCell, startCombat, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `hold-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '定身', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

test('定身术命中后目标麻痹并记录专注与轮数', () => {
  const { battle, caster, foe } = setup();
  const next = castHoldPerson(battle, caster, foe, { random: sequence(0.05) });
  const foeState = next.actors.find(actor => actor.id === foe).combat;
  assert.equal(foeState.paralyzed, 10);
  assert.equal(foeState.paralyzedBy, caster);
  assert.ok(foeState.conditions.includes('麻痹'));
  const casterState = next.actors.find(actor => actor.id === caster).combat;
  assert.equal(casterState.actionUsed, true);
  assert.equal(casterState.concentration.spell, '定身术');
  assert.ok(next.combat.log.some(line => line.text.includes('被定住')));
});

test('目标感知豁免成功时不受影响', () => {
  const { battle, caster, foe } = setup();
  const next = castHoldPerson(battle, caster, foe, { random: sequence(0.99) });
  const foeState = next.actors.find(actor => actor.id === foe).combat;
  assert.equal(foeState.paralyzed, undefined);
  assert.ok(!foeState.conditions.includes('麻痹'));
  assert.ok(next.combat.log.some(line => line.text.includes('抵抗住了')));
});

test('攻击麻痹目标时获得优势', () => {
  const { battle, caster, foe } = setup();
  const held = castHoldPerson(battle, caster, foe, { random: sequence(0.05) });
  const ready = structuredClone(held);
  ready.actors.find(actor => actor.id === caster).combat.actionUsed = false;
  const strike = attack(ready, { attackerId: caster, targetId: foe, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5) });
  assert.equal(strike.outcome.mode, 'advantage');
  assert.ok(strike.outcome.notes.some(note => note.includes('目标麻痹')));
});

test('麻痹目标无法行动与移动', () => {
  const { battle, caster, foe } = setup();
  const held = castHoldPerson(battle, caster, foe, { random: sequence(0.05) });
  const foeTurn = endTurn(held, { random: sequence(0.05) });
  assert.throws(() => attack(foeTurn, { attackerId: foe, targetId: caster, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5) }), /处于麻痹状态/);
  assert.throws(() => moveActorToCell(foeTurn, foe, 9, 5), /处于麻痹状态的单位无法移动/);
});

test('目标在自己的回合开始时重掷感知豁免，成功即解除', () => {
  const { battle, caster, foe } = setup();
  const held = castHoldPerson(battle, caster, foe, { random: sequence(0.05) });
  const escaped = endTurn(held, { random: sequence(0.99) });
  const foeState = escaped.actors.find(actor => actor.id === foe).combat;
  assert.equal(foeState.paralyzed, undefined);
  assert.ok(!foeState.conditions.includes('麻痹'));
  assert.ok(escaped.combat.log.some(line => line.text.includes('挣脱了定身术')));
});

test('豁免失败则轮数递减，耗尽后结束', () => {
  const { battle, caster, foe } = setup();
  const held = castHoldPerson(battle, caster, foe, { random: sequence(0.05) });
  const weakened = structuredClone(held);
  const state = weakened.actors.find(actor => actor.id === foe).combat;
  state.paralyzed = 1;
  const passed = endTurn(weakened, { random: sequence(0.05) });
  const after = passed.actors.find(actor => actor.id === foe).combat;
  assert.equal(after.paralyzed, undefined);
  assert.ok(passed.combat.log.some(line => line.text.includes('身上的定身术结束了')));
});

test('结束专注与长休都会解除定身术', () => {
  const { battle, caster, foe } = setup();
  const held = castHoldPerson(battle, caster, foe, { random: sequence(0.05) });
  const cleared = endConcentration(held, caster);
  const foeState = cleared.actors.find(actor => actor.id === foe).combat;
  assert.equal(foeState.paralyzed, undefined);
  assert.ok(!foeState.conditions.includes('麻痹'));
  const rested = takeLongRest(castHoldPerson(battle, caster, foe, { random: sequence(0.05) }));
  assert.equal(rested.actors.find(actor => actor.id === foe).combat.paralyzed, undefined);
});

test('定身术拒绝自己、已麻痹、超距与已有专注', () => {
  const { battle, caster, foe } = setup();
  assert.throws(() => castHoldPerson(battle, caster, caster), /不能对自己施放/);
  const held = castHoldPerson(battle, caster, foe, { random: sequence(0.05) });
  assert.throws(() => castHoldPerson(held, caster, foe, { random: sequence(0.05) }), /已经处于麻痹状态/);
  const far = structuredClone(battle);
  const farFoe = far.actors.find(actor => actor.id === foe);
  farFoe.position = { x: 19, y: 19 };
  assert.throws(() => castHoldPerson(far, caster, foe), /60 尺内的单位/);
  const busy = structuredClone(battle);
  busy.actors.find(actor => actor.id === caster).combat.concentration = { spell: '祝福术' };
  assert.throws(() => castHoldPerson(busy, caster, foe), /已经在维持其他专注/);
});

test('hostileTargets 只列出敌方且在场的目标', () => {
  const { battle, caster, foe } = setup();
  const targets = hostileTargets(battle, caster, 60);
  assert.deepEqual(targets.map(actor => actor.id), [foe]);
  assert.deepEqual(hostileTargets(battle, caster, 4), []);
});
