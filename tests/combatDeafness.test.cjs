const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, castDeafness, deafenTargets, castCommand, helpCheck, endConcentration, takeLongRest, endTurn } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `deaf-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-deaf', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '科林', species: '人类', characterClass: '吟游诗人', level: 3,
    abilities: { str: 10, dex: 14, con: 12, int: 12, wis: 12, cha: 16 },
    maxHp: 24, armorClass: 14, speedFt: 30, actions: '短剑：+4 命中，1d6+2 穿刺伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '耳聋', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

test('耳聋术命中后写入耳聋状态与专注', () => {
  const { battle, caster, foe } = setup();
  const result = castDeafness(battle, caster.id, foe.id, { random: sequence(0.01) });
  const state = result.battle.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.deafened, 10);
  assert.equal(state.deafenedBy, caster.id);
  assert.ok(state.conditions.includes('耳聋'));
  const casterState = result.battle.actors.find(actor => actor.id === caster.id).combat;
  assert.equal(casterState.actionUsed, true);
  assert.equal(casterState.concentration.spell, '耳聋术');
  assert.match(logs(result.battle), /耳聋 10 轮/);
});

test('豁免成功则不受影响', () => {
  const { battle, caster, foe } = setup();
  const result = castDeafness(battle, caster.id, foe.id, { random: sequence(0.99) });
  const state = result.battle.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.deafened, undefined);
  assert.equal(state.conditions.includes('耳聋'), false);
  assert.match(logs(result.battle), /抵抗了耳聋术/);
});

test('耳聋的目标听不见命令术', () => {
  const { battle, caster, foe } = setup();
  const deaf = castDeafness(battle, caster.id, foe.id, { random: sequence(0.01) }).battle;
  const ready = structuredClone(deaf);
  ready.actors.find(actor => actor.id === caster.id).combat.actionUsed = false;
  assert.throws(() => castCommand(ready, caster.id, foe.id, 'halt', { random: sequence(0.01) }), /听不见命令/);
});

test('耳聋的一方无法互相协助', () => {
  const { battle, caster, foe } = setup();
  const deaf = castDeafness(battle, caster.id, foe.id, { random: sequence(0.01) }).battle;
  const ready = structuredClone(deaf);
  ready.actors.find(actor => actor.id === caster.id).combat.actionUsed = false;
  assert.throws(() => helpCheck(ready, caster.id, foe.id), /耳聋/);
});

test('回合结束时体质豁免成功可恢复听觉', () => {
  const { battle, caster, foe } = setup();
  const deaf = castDeafness(battle, caster.id, foe.id, { random: sequence(0.01) }).battle;
  const next = endTurn(deaf, { random: sequence(0.99) });
  const state = next.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.deafened, undefined);
  assert.equal(state.conditions.includes('耳聋'), false);
  assert.match(logs(next), /恢复了听觉/);
});

test('结束专注与长休都会解除耳聋', () => {
  const { battle, caster, foe } = setup();
  const deaf = castDeafness(battle, caster.id, foe.id, { random: sequence(0.01) }).battle;
  const ended = endConcentration(deaf, caster.id);
  const endedState = ended.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(endedState.deafened, undefined);
  assert.equal(endedState.conditions.includes('耳聋'), false);
  assert.match(logs(ended), /耳聋术结束了/);
  const rested = takeLongRest(deaf);
  assert.equal(rested.actors.find(actor => actor.id === foe.id).combat.deafened, undefined);
});

test('候选只含 30 尺内敌人，并拒绝自己与同伴', () => {
  const { battle, caster, foe } = setup();
  assert.deepEqual(deafenTargets(battle, caster.id).map(actor => actor.id), [foe.id]);
  assert.throws(() => castDeafness(battle, caster.id, caster.id), /不能对自己施放/);
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === foe.id).position = { x: 9, y: 0 };
  assert.throws(() => castDeafness(far, caster.id, foe.id), /射程是 30 尺/);
  const ally = structuredClone(battle);
  ally.actors.find(actor => actor.id === foe.id).side = '友方';
  assert.throws(() => castDeafness(ally, caster.id, foe.id), /只能影响敌对单位/);
});
