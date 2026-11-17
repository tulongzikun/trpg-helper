const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, castBless, castHoldPerson, grapple, mountUp, addAura, fleeBattle, surrender, removeCombatant, damageActor,
} = require('../apps/web/src/combat.ts');
const { danglingFields, danglingAuras, danglingOrder, currentMissing } = require('./helpers/integrity.cjs');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `integ-${++counter}`;

const leader = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-integ', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '伊兰', species: '人类', characterClass: '圣武士', level: 9,
    abilities: { str: 17, dex: 10, con: 14, int: 10, wis: 12, cha: 17 },
    maxHp: 60, armorClass: 18, speedFt: 30, actions: '长剑：+6 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};
const friend = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-integ-ally', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '诺拉', species: '人类', characterClass: '牧师', level: 9,
    abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 18, cha: 12 },
    maxHp: 48, armorClass: 16, speedFt: 30, actions: '锤矛：+4 命中，1d6+2 钝击伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '引用完整性', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const first = addCharacter(store, leader, { battleId: store.battles[0].id, side: '友方' }, ids());
  const second = addCharacter(first.store, friend, { battleId: first.store.battles[0].id, side: '友方' }, ids());
  const battle = second.store.battles[0];
  const leaderId = battle.actors.find(actor => actor.name === '伊兰').id;
  const friendId = battle.actors.find(actor => actor.name === '诺拉').id;
  const foeIds = battle.actors.filter(actor => actor.side === '敌方').map(actor => actor.id);
  const initiatives = {};
  battle.actors.forEach((actor) => { initiatives[actor.id] = actor.side === '友方' ? (actor.id === leaderId ? 20 : 18) : 10; });
  const started = startCombat(battle, initiatives);
  const placed = {
    ...started,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: started.actors.map(actor => {
      if (actor.id === leaderId) return { ...actor, position: { x: 0, y: 0 } };
      if (actor.id === friendId) return { ...actor, position: { x: 0, y: 2 } };
      if (actor.id === foeIds[0]) return { ...actor, position: { x: 0, y: 1 } };
      return { ...actor, position: { x: 1, y: 0 } };
    }),
  };
  return { battle: placed, leaderId, friendId, foeIds };
}

const dominate = () => ({ random: () => 0.99 });

// 造一个「身上挂满状态」的战场：祝福、擒抱、骑乘、灵光、定身术
function loaded() {
  const { battle, leaderId, friendId, foeIds } = setup();
  let current = castBless(battle, friendId, [leaderId], { random: () => 0.9 });
  const gripped = grapple(current, { attackerId: leaderId, targetId: foeIds[0] }, dominate()).battle;
  const sameSide = { ...gripped, actors: gripped.actors.map(actor => actor.id === foeIds[1] ? { ...actor, side: '友方' } : actor) };
  const mounted = mountUp(sameSide, leaderId, foeIds[1]);
  const aura = addAura(mounted, { ownerId: leaderId, name: '守护灵光', radiusFt: 10, bonus: 1, kind: 'saves' });
  return { battle: aura, leaderId, friendId, foeIds };
}

function assertClean(battle, label) {
  assert.deepEqual(danglingFields(battle), [], `${label} 后仍有悬挂字段`);
  assert.deepEqual(danglingAuras(battle), [], `${label} 后仍有悬挂灵光`);
  assert.deepEqual(danglingOrder(battle), [], `${label} 后先攻顺序仍有不存在的单位`);
  assert.equal(currentMissing(battle), false, `${label} 后当前行动者不存在`);
}

test('撤离后没有指向离场单位的悬挂引用', () => {
  const { battle, leaderId } = loaded();
  assertClean(fleeBattle(battle, leaderId), '撤离');
});

test('投降后没有悬挂引用', () => {
  const { battle, leaderId } = loaded();
  assertClean(surrender(battle, leaderId), '投降');
});

test('移出战场后没有悬挂引用', () => {
  const { battle, leaderId } = loaded();
  assertClean(removeCombatant(battle, leaderId), '移除');
});

test('死亡后没有悬挂引用', () => {
  const { battle, leaderId } = loaded();
  assertClean(damageActor(battle, leaderId, 200, '挥砍').battle, '死亡');
});

test('定身术施法者离场后目标不再被麻痹', () => {
  const { battle, friendId, foeIds } = setup();
  const held = castHoldPerson(battle, friendId, foeIds[0], { random: () => 0.01 });
  const after = removeCombatant(held, friendId);
  const victim = after.actors.find(actor => actor.id === foeIds[0]).combat;
  assert.equal(victim.paralyzedBy, undefined);
  assert.equal(victim.conditions.includes('麻痹'), false);
  assertClean(after, '移除施法者');
});
