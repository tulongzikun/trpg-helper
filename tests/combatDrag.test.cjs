const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, grapple, moveActorToCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `drag-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-drag', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '拖拽', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

// 擒抱对抗：英雄力量 16（+3+专精），固定 d20 取 0.99 → 20，必成功
const grab = (battle, heroId, foeId) => grapple(battle, { attackerId: heroId, targetId: foeId }, { random: () => 0.99 });

const textsOf = battle => (battle.combat?.log ?? []).map(item => item.text);

test('擒抱后拖拽移动，受害者被带到相邻格', () => {
  const { battle, heroId, foeId } = setup();
  const grappled = grab(battle, heroId, foeId).battle;
  const moved = moveActorToCell(grappled, heroId, 0, 3);
  const foe = moved.actors.find(actor => actor.id === foeId);
  assert.ok(foe.position, '受害者应有位置');
  const distance = Math.max(Math.abs(foe.position.x - 0), Math.abs(foe.position.y - 3));
  assert.equal(distance, 1);
  assert.ok(textsOf(moved).some(text => text.includes('被拖拽到')));
});

test('拖拽时移动消耗翻倍', () => {
  const { battle, heroId, foeId } = setup();
  const grappled = grab(battle, heroId, foeId).battle;
  const moved = moveActorToCell(grappled, heroId, 0, 3);
  const heroState = moved.actors.find(actor => actor.id === heroId).combat;
  // 3 格 × 5 尺 × 2（拖拽）= 30 尺
  assert.equal(heroState.movementUsed, 30);
  assert.ok(textsOf(moved).some(text => text.includes('拖拽被擒抱的单位使消耗翻倍')));
});

test('未拖拽时同样距离只消耗 15 尺', () => {
  const { battle, heroId } = setup();
  const moved = moveActorToCell(battle, heroId, 0, 3);
  assert.equal(moved.actors.find(actor => actor.id === heroId).combat.movementUsed, 15);
});

test('拖拽后速度不够就无法继续拉开距离', () => {
  const { battle, heroId, foeId } = setup();
  const grappled = grab(battle, heroId, foeId).battle;
  const moved = moveActorToCell(grappled, heroId, 0, 3);
  assert.throws(() => moveActorToCell(moved, heroId, 0, 6), /移动距离超出速度上限（30 尺）/);
});

test('只带走被自己擒抱的目标，其他单位留在原格', () => {
  const { battle, heroId, foeId } = setup();
  const grappled = grab(battle, heroId, foeId).battle;
  const bystander = { ...grappled.actors.find(actor => actor.id === foeId), id: 'foe-b', name: '旁观者', position: { x: 2, y: 2 }, combat: { ...grappled.actors.find(actor => actor.id === foeId).combat, grappledBy: undefined, conditions: [] } };
  delete bystander.combat.grappledBy;
  const withBystander = { ...grappled, actors: [...grappled.actors, bystander] };
  const moved = moveActorToCell(withBystander, heroId, 0, 3);
  assert.deepEqual(moved.actors.find(actor => actor.id === 'foe-b').position, { x: 2, y: 2 });
});
