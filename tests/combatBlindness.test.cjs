const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, castBlindness, blindTargets, endConcentration, takeLongRest, endTurn } = require('../apps/web/src/combat.ts');
const { attackerAdjustment, targetAdjustment } = require('../apps/web/src/combatModifiers.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `blind-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-blind', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '伊莎', species: '人类', characterClass: '法师', level: 3,
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
    maxHp: 22, armorClass: 12, speedFt: 30, actions: '短杖：+3 命中，1d6+1 钝击伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '致盲', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 12, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const caster = next.actors.find(actor => actor.side === '友方');
  const foe = next.actors.find(actor => actor.side === '敌方');
  caster.position = { x: 0, y: 0 };
  foe.position = { x: 1, y: 0 };
  return { battle: next, caster, foe };
}

const logs = battle => battle.combat.log.map(item => item.text).join('\n');

test('致盲术命中后写入目盲、10 轮与专注', () => {
  const { battle, caster, foe } = setup();
  const result = castBlindness(battle, caster.id, foe.id, { random: sequence(0.01) });
  const state = result.battle.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.blinded, 10);
  assert.equal(state.blindedBy, caster.id);
  assert.ok(state.conditions.includes('目盲'));
  const casterState = result.battle.actors.find(actor => actor.id === caster.id).combat;
  assert.equal(casterState.actionUsed, true);
  assert.equal(casterState.concentration.spell, '致盲术');
  assert.match(logs(result.battle), /被致盲/);
});

test('豁免成功则不受影响', () => {
  const { battle, caster, foe } = setup();
  const result = castBlindness(battle, caster.id, foe.id, { random: sequence(0.99) });
  const state = result.battle.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.blinded, undefined);
  assert.equal(state.conditions.includes('目盲'), false);
  assert.match(logs(result.battle), /抵抗了致盲术/);
});

test('目盲让本人攻击劣势、被攻击时对方优势', () => {
  const { battle, caster, foe } = setup();
  const result = castBlindness(battle, caster.id, foe.id, { random: sequence(0.01) });
  const blinded = result.battle.actors.find(actor => actor.id === foe.id);
  assert.equal(attackerAdjustment(blinded).mode, 'disadvantage');
  assert.match(attackerAdjustment(blinded).notes.join(' '), /目盲/);
  assert.equal(targetAdjustment(blinded, 'melee').mode, 'advantage');
  assert.match(targetAdjustment(blinded, 'ranged').notes.join(' '), /目标目盲/);
});

test('目标回合开始重复体质豁免可恢复视力', () => {
  const { battle, caster, foe } = setup();
  const blinded = castBlindness(battle, caster.id, foe.id, { random: sequence(0.01) }).battle;
  // 推两轮让目标行动：第一轮结束 → 目标回合开始（豁免成功）
  const first = endTurn(blinded, { random: sequence(0.99) });
  const state = first.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.blinded, undefined);
  assert.equal(state.conditions.includes('目盲'), false);
  assert.match(logs(first), /恢复了视力/);
});

test('结束专注与长休都会解除致盲', () => {
  const { battle, caster, foe } = setup();
  const blinded = castBlindness(battle, caster.id, foe.id, { random: sequence(0.01) }).battle;
  const ended = endConcentration(blinded, caster.id);
  const state = ended.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.blinded, undefined);
  assert.equal(state.conditions.includes('目盲'), false);
  assert.match(logs(ended), /致盲术结束了/);

  const fresh = endConcentration(blinded, caster.id);
  fresh.actors.find(actor => actor.id === caster.id).combat.actionUsed = false;
  const again = castBlindness(fresh, caster.id, foe.id, { random: sequence(0.01) }).battle;
  const rested = takeLongRest(again);
  const restedState = rested.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(restedState.blinded, undefined);
  assert.equal(restedState.blindedBy, undefined);
});

test('拒绝自己、同伴与超距目标，候选只含 30 尺内敌人', () => {
  const { battle, caster, foe } = setup();
  assert.throws(() => castBlindness(battle, caster.id, caster.id), /不能对自己施放/);
  const ally = structuredClone(battle);
  ally.actors.find(actor => actor.id === foe.id).side = '友方';
  assert.throws(() => castBlindness(ally, caster.id, foe.id), /只能影响敌对单位/);
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === foe.id).position = { x: 9, y: 0 };
  assert.throws(() => castBlindness(far, caster.id, foe.id), /射程是 30 尺/);
  assert.deepEqual(blindTargets(battle, caster.id).map(actor => actor.id), [foe.id]);
  assert.deepEqual(blindTargets(far, caster.id), []);
});
