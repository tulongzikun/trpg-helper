const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, attack, creatureCover } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `cc-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-cc', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '罗宾', species: '人类', characterClass: '游侠', level: 3,
    abilities: { str: 12, dex: 16, con: 12, int: 10, wis: 14, cha: 10 },
    maxHp: 28, armorClass: 15, speedFt: 30, actions: '长弓：+7 命中，1d8+3 穿刺伤害，远程 150 尺', notes: '', details: {},
  },
};

function setup(positions) {
  let store = addMonsters(emptyStore(), card, { newBattleName: '生物掩体', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 10, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const attacker = next.actors.find(actor => actor.side === '友方');
  const foes = next.actors.filter(actor => actor.side === '敌方');
  const [target, blocker] = foes;
  attacker.position = positions.attacker;
  target.position = positions.target;
  blocker.position = positions.blocker;
  return { battle: next, attacker, target, blocker };
}

const ranged = { attackBonus: 7, damageExpression: '1d8+3', damageType: '穿刺', range: 'ranged' };
const acVs = (battle, attackerId, targetId, extra = {}) =>
  attack(battle, { attackerId, targetId, ...ranged, ...extra }, { random: sequence(0.5, 0.5) }).outcome;

test('连线中间有单位时提供半掩体 AC +2', () => {
  const { battle, attacker, target, blocker } = setup({ attacker: { x: 0, y: 0 }, target: { x: 4, y: 0 }, blocker: { x: 2, y: 0 } });
  const result = attack(battle, { attackerId: attacker.id, targetId: target.id, ...ranged }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.targetAc, target.template.armorClass + 2);
  assert.match(result.battle.combat.log.at(-1).detail, /生物掩体/);
  assert.equal(creatureCover(battle, attacker.id, target.id).id, blocker.id);
});

test('没有单位挡在中间时没有生物掩体', () => {
  const { battle, attacker, target } = setup({ attacker: { x: 0, y: 0 }, target: { x: 4, y: 0 }, blocker: { x: 0, y: 4 } });
  const outcome = acVs(battle, attacker.id, target.id);
  assert.equal(outcome.targetAc, target.template.armorClass);
  assert.equal(creatureCover(battle, attacker.id, target.id), null);
});

test('近战攻击不吃生物掩体', () => {
  const { battle, attacker, target } = setup({ attacker: { x: 0, y: 0 }, target: { x: 1, y: 0 }, blocker: { x: 2, y: 0 } });
  const outcome = attack(battle, { attackerId: attacker.id, targetId: target.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee' }, { random: sequence(0.5, 0.5) }).outcome;
  assert.equal(outcome.targetAc, target.template.armorClass);
});

test('倒地或阵亡的单位不提供掩体', () => {
  const { battle, attacker, target, blocker } = setup({ attacker: { x: 0, y: 0 }, target: { x: 4, y: 0 }, blocker: { x: 2, y: 0 } });
  const down = structuredClone(battle);
  down.actors.find(actor => actor.id === blocker.id).combat.status = 'down';
  assert.equal(creatureCover(down, attacker.id, target.id), null);
  const dead = structuredClone(battle);
  dead.actors.find(actor => actor.id === blocker.id).combat.status = 'dead';
  assert.equal(creatureCover(dead, attacker.id, target.id), null);
});

test('斜向连线上的单位同样提供掩体', () => {
  const { battle, attacker, target, blocker } = setup({ attacker: { x: 0, y: 0 }, target: { x: 4, y: 4 }, blocker: { x: 2, y: 2 } });
  assert.equal(creatureCover(battle, attacker.id, target.id).id, blocker.id);
  assert.equal(acVs(battle, attacker.id, target.id).targetAc, target.template.armorClass + 2);
});

test('相邻格阻挡不算生物掩体', () => {
  const { battle, attacker, target } = setup({ attacker: { x: 0, y: 0 }, target: { x: 4, y: 0 }, blocker: { x: 3, y: 1 } });
  assert.equal(creatureCover(battle, attacker.id, target.id), null);
});

test('生物掩体与既有格掩体叠加', () => {
  const { battle, attacker, target } = setup({ attacker: { x: 0, y: 0 }, target: { x: 4, y: 0 }, blocker: { x: 2, y: 0 } });
  const result = attack(battle, { attackerId: attacker.id, targetId: target.id, ...ranged, cover: '半掩体' }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.targetAc, target.template.armorClass + 4);
  const text = result.battle.combat.log.at(-1).detail ?? '';
  assert.match(text, /半掩体/);
  assert.match(text, /生物掩体/);
});
