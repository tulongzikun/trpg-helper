const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, grapple, escapeGrapple, moveActorToCell, jumpToCell, fade } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `gspd-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-gspd', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '布兰', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '擒抱速度', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const heroId = withHero.actors.find(actor => actor.side === '友方').id;
  const foeId = withHero.actors.find(actor => actor.side === '敌方').id;
  const initiatives = {};
  withHero.actors.forEach((actor) => { initiatives[actor.id] = actor.id === heroId ? 20 : 10; });
  const started = startCombat(withHero, initiatives);
  const placed = {
    ...started,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: started.actors.map(actor => actor.id === heroId ? { ...actor, position: { x: 0, y: 0 } } : actor.id === foeId ? { ...actor, position: { x: 0, y: 1 } } : actor),
  };
  return { battle: placed, heroId, foeId };
}

// 让英雄被敌人擒抱：先由英雄擒抱并成功，再把关系翻转
function heroHeldBy(battle, heroId, holderId) {
  const flipped = {
    ...battle,
    actors: battle.actors.map(actor => actor.id === heroId
      ? { ...actor, combat: { ...actor.combat, grappledBy: holderId, conditions: [...actor.combat.conditions.filter(item => item !== '擒抱'), '擒抱'] } }
      : actor),
  };
  return flipped;
}

const takeTurn = (battle, actorId) => {
  let current = battle;
  for (let step = 0; step < 4; step += 1) {
    if (current.combat.currentActorId === actorId) return current;
    current = require('../apps/web/src/combat.ts').endTurn(current, { random: () => 0.5 });
  }
  return current;
};

test('被擒抱的单位无法移动，并给出明确提示', () => {
  const { battle, heroId, foeId } = setup();
  const held = heroHeldBy(battle, heroId, foeId);
  assert.throws(() => moveActorToCell(held, heroId, 0, 2), /被擒抱的单位无法移动，需先挣脱擒抱。/);
});

test('被擒抱的单位不能跳跃', () => {
  const { battle, heroId, foeId } = setup();
  const held = heroHeldBy(battle, heroId, foeId);
  assert.throws(() => jumpToCell(held, heroId, 0, 2), /被擒抱的单位无法跳跃/);
});

test('擒抱者本人不受影响，可以正常移动', () => {
  const { battle, heroId, foeId } = setup();
  const grabbed = grapple(battle, { attackerId: heroId, targetId: foeId }, { random: () => 0.99 }).battle;
  const moved = moveActorToCell(grabbed, heroId, 0, 3);
  assert.deepEqual(moved.actors.find(actor => actor.id === heroId).position, { x: 0, y: 3 });
});

test('挣脱擒抱后恢复移动能力', () => {
  const { battle, heroId, foeId } = setup();
  const held = heroHeldBy(battle, heroId, foeId);
  const turn = takeTurn(held, heroId);
  const freed = escapeGrapple(turn, heroId, { random: () => 0.99 }).battle;
  assert.ok(!freed.actors.find(actor => actor.id === heroId).combat.grappledBy);
  const moved = moveActorToCell(freed, heroId, 0, 2);
  assert.deepEqual(moved.actors.find(actor => actor.id === heroId).position, { x: 0, y: 2 });
});

test('被擒抱者的速度按 0 处理：连一格都走不动', () => {
  const { battle, heroId, foeId } = setup();
  const held = heroHeldBy(battle, heroId, foeId);
  // 相邻一格也要被拒（不是「速度上限 30 尺」而是擒抱本身）
  assert.throws(() => moveActorToCell(held, heroId, 0, 4), /被擒抱的单位无法移动/);
});
