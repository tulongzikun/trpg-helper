const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, attack, castBarkskin, barkskinTargets, endConcentration, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `bark-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

function hero(armorClass = 15) {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-bark', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '塞拉', species: '人类', characterClass: '德鲁伊', level: 3,
      abilities: { str: 12, dex: 14, con: 14, int: 10, wis: 16, cha: 10 },
      maxHp: 30, armorClass, speedFt: 30, actions: '短剑：+4 命中，1d6+2 穿刺伤害，近战 5 尺', notes: '', details: {},
    },
  };
}

function setup(armorClass = 15, heroInitiative = 10) {
  let store = addMonsters(emptyStore(), card, { newBattleName: '树肤', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero(armorClass), { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 12, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? heroInitiative : 20 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const caster = next.actors.find(actor => actor.side === '友方');
  const foe = next.actors.find(actor => actor.side === '敌方');
  caster.position = { x: 0, y: 0 };
  foe.position = { x: 1, y: 0 };
  return { battle: next, caster, foe };
}

const swing = { attackBonus: 0, damageExpression: '1d4', damageType: '挥砍', range: 'melee' };
const acSeenBy = (battle, attackerId, targetId) => attack(battle, { attackerId, targetId, ...swing }, { random: sequence(0.5, 0.5) }).outcome.targetAc;

test('树肤术把 AC 抬到 17，并记录 10 轮与专注', () => {
  const { battle, caster } = setup(15);
  const next = castBarkskin(battle, caster.id, caster.id);
  const state = next.actors.find(actor => actor.id === caster.id).combat;
  assert.equal(state.barkskin, 10);
  assert.equal(state.barkskinBy, caster.id);
  assert.equal(state.concentration.spell, '树肤术');
  assert.equal(state.actionUsed, true);
  const foe = next.actors.find(actor => actor.side === '敌方');
  assert.equal(acSeenBy(next, foe.id, caster.id), 17);
});

test('原本 AC 更高时不会被压低', () => {
  const { battle, caster } = setup(18);
  const next = castBarkskin(battle, caster.id, caster.id);
  const foe = next.actors.find(actor => actor.side === '敌方');
  assert.equal(acSeenBy(next, foe.id, caster.id), 18);
});

test('重复施放被拒绝', () => {
  const { battle, caster } = setup(15, 20);
  const next = castBarkskin(battle, caster.id, caster.id);
  const ready = structuredClone(next);
  ready.actors.find(actor => actor.id === caster.id).combat.actionUsed = false;
  assert.throws(() => castBarkskin(ready, caster.id, caster.id), /目标已经受到树肤术的影响/);
});

test('只能影响 5 尺内的单位', () => {
  const { battle, caster, foe } = setup(15, 20);
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === foe.id).position = { x: 6, y: 0 };
  assert.throws(() => castBarkskin(far, caster.id, foe.id), /树肤术只能影响 5 尺内的单位/);
});

test('结束专注后 AC 回落', () => {
  const { battle, caster } = setup(15, 10);
  const next = castBarkskin(battle, caster.id, caster.id);
  const foe = next.actors.find(actor => actor.side === '敌方');
  assert.equal(acSeenBy(next, foe.id, caster.id), 17);
  const ended = endConcentration(next, caster.id);
  assert.equal(ended.actors.find(actor => actor.id === caster.id).combat.barkskin, undefined);
  assert.equal(acSeenBy(ended, foe.id, caster.id), 15);
});

test('长休清除树肤术，目标筛选含自己且限 5 尺', () => {
  const { battle, caster, foe } = setup(15, 20);
  const candidates = barkskinTargets(battle, caster.id).map(actor => actor.id);
  assert.deepEqual(candidates, [caster.id]);
  const next = castBarkskin(battle, caster.id, caster.id);
  const rested = takeLongRest(next);
  assert.equal(rested.actors.find(actor => actor.id === caster.id).combat.barkskin, undefined);
  assert.equal(rested.actors.find(actor => actor.id === caster.id).combat.barkskinBy, undefined);
  assert.equal(foe.side, '敌方');
});
