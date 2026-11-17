const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, grapple, attack } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `grab-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-grab', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '布兰', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '擒抱', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const heroId = withHero.actors.find(actor => actor.side === '友方').id;
  const foes = withHero.actors.filter(actor => actor.side === '敌方');
  const initiatives = {};
  withHero.actors.forEach((actor) => { initiatives[actor.id] = actor.id === heroId ? 20 : 10; });
  const started = startCombat(withHero, initiatives);
  const placed = {
    ...started,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: started.actors.map(actor => actor.id === heroId
      ? { ...actor, position: { x: 0, y: 0 } }
      : actor.id === foes[0].id ? { ...actor, position: { x: 0, y: 1 } }
        : actor.id === foes[1].id ? { ...actor, position: { x: 1, y: 0 } } : actor),
  };
  return { battle: placed, heroId, grapplerId: foes[0].id, otherId: foes[1].id };
}

// 英雄力量 16 对抗，d20 取 0.99 → 20 必成功；之后把「谁擒抱谁」翻转成「英雄被敌人擒抱」
const grabByHero = (battle, heroId, foeId) => grapple(battle, { attackerId: heroId, targetId: foeId }, { random: () => 0.99 }).battle;

function heroGrappledBy(battle, heroId, grapplerId) {
  return {
    ...battle,
    actors: battle.actors.map(actor => actor.id === heroId
      ? { ...actor, combat: { ...actor.combat, grappledBy: grapplerId, conditions: [...actor.combat.conditions.filter(item => item !== '擒抱'), '擒抱'] } }
      : actor),
  };
}

const swing = (battle, attackerId, targetId) => attack(battle, {
  attackerId, targetId, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍',
}, { random: () => 0.5 });

const detailOf = battle => String(battle.combat.log.at(-1)?.detail ?? '');

test('被擒抱者攻击擒抱者时没有劣势', () => {
  const { battle, heroId, grapplerId } = setup();
  const held = heroGrappledBy(battle, heroId, grapplerId);
  const result = swing(held, heroId, grapplerId);
  assert.equal(result.outcome.mode, 'normal');
  assert.equal(result.outcome.notes.length, 0);
});

test('被擒抱者攻击其他人时仍是劣势', () => {
  const { battle, heroId, grapplerId, otherId } = setup();
  const held = heroGrappledBy(battle, heroId, grapplerId);
  const result = swing(held, heroId, otherId);
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.ok(result.outcome.notes.some(note => note.includes('擒抱')));
});

test('同时倒地与擒抱：劣势不叠加成两次，仍为劣势', () => {
  const { battle, heroId, grapplerId, otherId } = setup();
  const held = heroGrappledBy(battle, heroId, grapplerId);
  const prone = {
    ...held,
    actors: held.actors.map(actor => actor.id === heroId ? { ...actor, combat: { ...actor.combat, conditions: [...actor.combat.conditions, '倒地'] } } : actor),
  };
  const result = swing(prone, heroId, otherId);
  assert.equal(result.outcome.mode, 'disadvantage');
});

test('未被擒抱的攻击者不受影响', () => {
  const { battle, heroId, grapplerId } = setup();
  const result = swing(battle, heroId, grapplerId);
  assert.equal(result.outcome.mode, 'normal');
});

test('攻击擒抱者的算术明细里不写擒抱劣势', () => {
  const { battle, heroId, grapplerId } = setup();
  const held = heroGrappledBy(battle, heroId, grapplerId);
  const result = swing(held, heroId, grapplerId);
  assert.ok(!detailOf(result.battle).includes('擒抱'), `明细不应含擒抱：${detailOf(result.battle)}`);
});
