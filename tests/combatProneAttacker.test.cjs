const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, attack, toggleCondition, standUp } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `prone-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-prone-atk', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '倒地攻击', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const heroId = withHero.actors.find(actor => actor.side === '友方').id;
  const foeId = withHero.actors.find(actor => actor.side === '敌方').id;
  const initiatives = {};
  withHero.actors.forEach((actor) => { initiatives[actor.id] = actor.id === heroId ? 20 : 10; });
  const started = startCombat(withHero, initiatives);
  const placed = { ...started, grid: { width: 10, height: 10, cellFt: 5 }, actors: started.actors.map(actor => actor.id === heroId ? { ...actor, position: { x: 0, y: 0 } } : actor.id === foeId ? { ...actor, position: { x: 0, y: 1 } } : actor) };
  return { battle: placed, heroId, foeId };
}

const strike = (battle, heroId, foeId) => attack(battle, {
  attackerId: heroId, targetId: foeId, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', distanceFt: 5,
}, { random: () => 0.5 });

test('站立的攻击者没有倒地劣势', () => {
  const { battle, heroId, foeId } = setup();
  const result = strike(battle, heroId, foeId);
  assert.equal(result.outcome.mode, 'normal');
  assert.ok(!result.outcome.notes.some(note => note.includes('倒地')));
});

test('倒地攻击时攻击检定劣势，并在备注里写明', () => {
  const { battle, heroId, foeId } = setup();
  const prone = toggleCondition(battle, heroId, '倒地');
  const result = strike(prone, heroId, foeId);
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.ok(result.outcome.notes.some(note => note.includes('攻击方劣势') && note.includes('倒地')));
});

test('倒地且隐形时优势与劣势抵消为普通检定', () => {
  const { battle, heroId, foeId } = setup();
  const both = toggleCondition(toggleCondition(battle, heroId, '倒地'), heroId, '隐形');
  const result = strike(both, heroId, foeId);
  assert.equal(result.outcome.mode, 'normal');
  assert.ok(result.outcome.notes.some(note => note.includes('攻击方优势')));
  assert.ok(result.outcome.notes.some(note => note.includes('攻击方劣势')));
});

test('起身后恢复为普通检定', () => {
  const { battle, heroId, foeId } = setup();
  const prone = toggleCondition(battle, heroId, '倒地');
  const risen = standUp(prone, heroId);
  const result = strike(risen, heroId, foeId);
  assert.equal(result.outcome.mode, 'normal');
});

test('倒地时远程攻击同样劣势', () => {
  const { battle, heroId, foeId } = setup();
  const prone = toggleCondition(battle, heroId, '倒地');
  const result = attack(prone, {
    attackerId: heroId, targetId: foeId, attackBonus: 5, damageExpression: '1d8+3', damageType: '穿刺', range: 'ranged', distanceFt: 30,
  }, { random: () => 0.5 });
  assert.equal(result.outcome.mode, 'disadvantage');
});
