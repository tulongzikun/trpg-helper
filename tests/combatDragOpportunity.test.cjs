const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, pendingOpportunities } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `dragop-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-dragop',
  revision: 1,
  publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '壮汉',
    species: '人类',
    characterClass: '战士',
    level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40,
    armorClass: 16,
    speedFt: 30,
    actions: '',
    notes: '',
    details: { equipment: '长剑' },
  },
};

function setup(draggerCell, victimCell, enemyCell) {
  let store = addMonsters(emptyStore(), card, { newBattleName: '拖拽借机', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 12, height: 8, cellFt: 5 });
  const [foeA, foeB] = battle.actors.filter(actor => actor.side === '敌方');
  const dragger = battle.actors.find(actor => actor.side === '友方');
  const victim = foeA;
  const enemy = foeB;
  battle = structuredClone(
    startCombat(battle, { [dragger.id]: 20, [victim.id]: 15, [enemy.id]: 10 }),
  );
  battle.actors.find(actor => actor.id === dragger.id).position = draggerCell;
  battle.actors.find(actor => actor.id === victim.id).position = victimCell;
  battle.actors.find(actor => actor.id === enemy.id).position = enemyCell;
  const victimState = battle.actors.find(actor => actor.id === victim.id).combat;
  victimState.grappledBy = dragger.id;
  if (!victimState.conditions.includes('擒抱')) victimState.conditions.push('擒抱');
  return { battle, draggerId: dragger.id, victimId: victim.id, enemyId: enemy.id };
}

test('拖拽受害者只为拖拽者触发借机提示', () => {
  const { battle, draggerId, victimId } = setup({ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 });
  const moved = moveActorToCell(battle, draggerId, 1, 0);
  const prompts = pendingOpportunities(moved);
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].targetId, draggerId);
  assert.equal(prompts.some(prompt => prompt.targetId === victimId), false);
  const victimCell = moved.actors.find(actor => actor.id === victimId).position;
  const draggerCell = moved.actors.find(actor => actor.id === draggerId).position;
  assert.ok(Math.max(Math.abs(victimCell.x - draggerCell.x), Math.abs(victimCell.y - draggerCell.y)) <= 1);
});

test('拖拽者留在触及范围内时不产生提示', () => {
  const { battle, draggerId } = setup({ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 });
  const moved = moveActorToCell(battle, draggerId, 2, 2);
  assert.equal(pendingOpportunities(moved).length, 0);
});

test('受害者被拖出触及范围也不会让敌人获得对它的借机攻击', () => {
  const { battle, draggerId, victimId } = setup({ x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 });
  const before = pendingOpportunities(battle).length;
  const moved = moveActorToCell(battle, draggerId, 1, 1);
  const prompts = pendingOpportunities(moved);
  assert.equal(before, 0);
  assert.equal(prompts.some(prompt => prompt.targetId === victimId), false);
});
