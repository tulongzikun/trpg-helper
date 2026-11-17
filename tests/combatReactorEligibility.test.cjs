const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, pendingOpportunities } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `reactor-${++counter}`;

function setup(mutate) {
  const created = addMonsters(emptyStore(), card, { newBattleName: '反应资格', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const foe = battle.actors[0];
  foe.position = { x: 0, y: 0 };
  const hero = { ...structuredClone(foe), id: 'hero-1', name: '英雄', side: '友方', position: { x: 0, y: 1 } };
  hero.combat = undefined;
  battle.actors.push(hero);
  battle = structuredClone(startCombat(battle, { [foe.id]: 10, 'hero-1': 20 }));
  battle = configureGrid(battle, { width: 10, height: 10, cellFt: 5 });
  const foeId = foe.id;
  if (mutate) {
    const target = battle.actors.find(actor => actor.id === foeId);
    mutate(target);
  }
  return { battle, foeId };
}

test('健康的敌人会在英雄离开触及时排队借机攻击', () => {
  const { battle } = setup();
  const moved = moveActorToCell(battle, 'hero-1', 0, 3);
  assert.equal(pendingOpportunities(moved).length, 1);
});

test('麻痹的敌人不会排队借机攻击', () => {
  const { battle } = setup(actor => actor.combat.conditions.push('麻痹'));
  const moved = moveActorToCell(battle, 'hero-1', 0, 3);
  assert.equal(pendingOpportunities(moved).length, 0);
});

test('失能的敌人不会排队借机攻击', () => {
  const { battle } = setup(actor => actor.combat.conditions.push('失能'));
  const moved = moveActorToCell(battle, 'hero-1', 0, 3);
  assert.equal(pendingOpportunities(moved).length, 0);
});

test('已撤离的敌人不会排队借机攻击', () => {
  const { battle } = setup(actor => { actor.combat.fled = true; });
  const moved = moveActorToCell(battle, 'hero-1', 0, 3);
  assert.equal(pendingOpportunities(moved).length, 0);
});

test('投降的敌人不会排队借机攻击', () => {
  const { battle } = setup(actor => { actor.combat.surrendered = true; });
  const moved = moveActorToCell(battle, 'hero-1', 0, 3);
  assert.equal(pendingOpportunities(moved).length, 0);
});

test('倒地的敌人不会排队借机攻击', () => {
  const { battle } = setup(actor => { actor.combat.status = 'down'; actor.currentHp = 0; });
  const moved = moveActorToCell(battle, 'hero-1', 0, 3);
  assert.equal(pendingOpportunities(moved).length, 0);
});
