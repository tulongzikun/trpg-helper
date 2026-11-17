const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, grapple, moveActorToCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `drag-haz-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-drag-haz', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup(extra = {}) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '拖拽地形', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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
    ...extra,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: started.actors.map(actor => actor.id === heroId ? { ...actor, position: { x: 0, y: 0 } } : actor.id === foeId ? { ...actor, position: { x: 0, y: 1 } } : actor),
  };
  return { battle: placed, heroId, foeId };
}

const grab = (battle, heroId, foeId) => grapple(battle, { attackerId: heroId, targetId: foeId }, { random: () => 0.99 }).battle;
const textsOf = battle => (battle.combat?.log ?? []).map(item => item.text);

// 英雄从 (0,0) 拖到 (0,3) 时，受害者被带到 (0, 2)：相邻格里离原格最近、且不越界（x 不能小于 0）
const DRAG_SPOT = { x: 0, y: 2 };

test('把被擒抱者拖进岩浆会受到火焰伤害', () => {
  const { battle, heroId, foeId } = setup({ terrain: 'lava' });
  const grappled = grab(battle, heroId, foeId);
  const before = grappled.actors.find(actor => actor.id === foeId).currentHp;
  const moved = moveActorToCell(grappled, heroId, 0, 3, { random: () => 0.5 });
  const victim = moved.actors.find(actor => actor.id === foeId);
  assert.deepEqual(victim.position, DRAG_SPOT);
  assert.ok(victim.currentHp < before, `受害者应受伤：${before} → ${victim.currentHp}`);
  assert.ok(textsOf(moved).some(text => text.includes('岩浆')));
});

test('把被擒抱者拖进危险地形格会受到对应伤害', () => {
  const { battle, heroId, foeId } = setup({ hazards: [{ x: DRAG_SPOT.x, y: DRAG_SPOT.y, damageExpression: '2d6', damageType: '穿刺' }] });
  const grappled = grab(battle, heroId, foeId);
  const before = grappled.actors.find(actor => actor.id === foeId).currentHp;
  const moved = moveActorToCell(grappled, heroId, 0, 3, { random: () => 0.5 });
  const victim = moved.actors.find(actor => actor.id === foeId);
  assert.ok(victim.currentHp < before, `受害者应受伤：${before} → ${victim.currentHp}`);
  assert.ok(textsOf(moved).some(text => text.includes('危险地形')));
});

test('把被擒抱者拖进荆棘会受到穿刺伤害', () => {
  const { battle, heroId, foeId } = setup({ terrain: 'brambles' });
  const grappled = grab(battle, heroId, foeId);
  const before = grappled.actors.find(actor => actor.id === foeId).currentHp;
  const moved = moveActorToCell(grappled, heroId, 0, 3);
  const victim = moved.actors.find(actor => actor.id === foeId);
  assert.equal(before - victim.currentHp, 1);
  assert.ok(textsOf(moved).some(text => text.includes('荆棘')));
});

test('普通地面拖拽不产生额外伤害', () => {
  const { battle, heroId, foeId } = setup();
  const grappled = grab(battle, heroId, foeId);
  const before = grappled.actors.find(actor => actor.id === foeId).currentHp;
  const moved = moveActorToCell(grappled, heroId, 0, 3);
  assert.equal(moved.actors.find(actor => actor.id === foeId).currentHp, before);
});

test('地形伤害不会让受害者在一次拖拽里被重复结算', () => {
  const { battle, heroId, foeId } = setup({ terrain: 'lava' });
  const grappled = grab(battle, heroId, foeId);
  const moved = moveActorToCell(grappled, heroId, 0, 3, { random: () => 0.5 });
  const victimHits = moved.combat.log.filter(item => item.text.includes('踏入岩浆')).length;
  // 受害者一次 + 拖拽者自己踩进岩浆一次
  assert.equal(victimHits, 2, moved.combat.log.map(item => item.text).join(' / '));
});
