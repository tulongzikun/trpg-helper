const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, surrender, executeCaptive, captiveTargets } = require('../apps/web/src/combat.ts');
const { battleOutcome } = require('../apps/web/src/combatOutcome.ts');
const { defeatedActors } = require('../apps/web/src/encounterReward.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `exec-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-exec', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '格里姆', species: '人类', characterClass: '战士', level: 3,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 34, armorClass: 16, speedFt: 30, actions: '巨斧：+5 命中，1d12+3 挥砍伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '处决', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 10, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const ally = next.actors.find(actor => actor.side === '友方');
  const foes = next.actors.filter(actor => actor.side === '敌方');
  ally.position = { x: 0, y: 0 };
  foes[0].position = { x: 1, y: 0 };
  foes[1].position = { x: 4, y: 0 };
  return { battle: next, ally, foes };
}

const logs = battle => battle.combat.log.map(item => item.text).join('\n');

test('处决投降者：目标阵亡、消耗动作、写入日志', () => {
  const { battle, ally, foes } = setup();
  const gave = surrender(battle, foes[0].id);
  const next = executeCaptive(gave, ally.id, foes[0].id);
  const state = next.actors.find(actor => actor.id === foes[0].id).combat;
  assert.equal(state.status, 'dead');
  assert.equal(next.actors.find(actor => actor.id === foes[0].id).currentHp, 0);
  assert.equal(next.actors.find(actor => actor.id === ally.id).combat.actionUsed, true);
  assert.match(logs(next), /处决了投降的/);
});

test('处决后计入击败经验且可判胜', () => {
  const { battle, ally, foes } = setup();
  const first = executeCaptive(surrender(battle, foes[0].id), ally.id, foes[0].id);
  const both = structuredClone(first);
  both.actors.find(actor => actor.id === ally.id).combat.actionUsed = false;
  both.actors.find(actor => actor.id === foes[1].id).position = { x: 1, y: 1 };
  const second = executeCaptive(surrender(both, foes[1].id), ally.id, foes[1].id);
  assert.equal(battleOutcome(second), 'victory');
  const defeated = defeatedActors(second).map(actor => actor.id);
  assert.deepEqual(defeated.sort(), [foes[0].id, foes[1].id].sort());
});

test('只能处决已经投降的单位', () => {
  const { battle, ally, foes } = setup();
  assert.throws(() => executeCaptive(battle, ally.id, foes[0].id), /只能处决已经投降的单位/);
});

test('只能处决 5 尺内的投降者', () => {
  const { battle, ally, foes } = setup();
  const gave = surrender(battle, foes[1].id);
  assert.throws(() => executeCaptive(gave, ally.id, foes[1].id), /只能处决 5 尺内的投降者/);
});

test('非当前回合与动作已用都会被拒绝', () => {
  const { battle, ally, foes } = setup();
  const gave = surrender(battle, foes[0].id);
  const after = structuredClone(gave);
  after.combat.turnIndex = after.combat.order.indexOf(foes[0].id);
  assert.throws(() => executeCaptive(after, ally.id, foes[0].id), /只有当前回合的单位可以处决俘虏/);
  const used = structuredClone(gave);
  used.actors.find(actor => actor.id === ally.id).combat.actionUsed = true;
  assert.throws(() => executeCaptive(used, ally.id, foes[0].id), /该单位本回合已经使用过动作/);
});

test('俘虏候选只包含 5 尺内投降者，阵亡后不可再处决', () => {
  const { battle, ally, foes } = setup();
  assert.deepEqual(captiveTargets(battle, ally.id), []);
  const gave = surrender(battle, foes[0].id);
  assert.deepEqual(captiveTargets(gave, ally.id).map(actor => actor.id), [foes[0].id]);
  const onlyFar = surrender(battle, foes[1].id);
  assert.deepEqual(captiveTargets(onlyFar, ally.id), []);
  const dead = executeCaptive(gave, ally.id, foes[0].id);
  assert.deepEqual(captiveTargets(dead, ally.id), []);
  const reused = structuredClone(dead);
  reused.actors.find(actor => actor.id === ally.id).combat.actionUsed = false;
  assert.throws(() => executeCaptive(reused, ally.id, foes[0].id), /已经死亡/);
});
