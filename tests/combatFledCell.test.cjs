const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, fleeBattle, creatureCover } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `fled-cell-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '撤离占格', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const hero = { ...structuredClone(battle.actors[0]), id: 'hero-1', name: '英雄', side: '友方' };
  hero.combat = undefined;
  hero.position = { x: 0, y: 0 };
  battle.actors.push(hero);
  for (const actor of battle.actors) {
    if (actor.id !== 'hero-1') actor.position = { x: 2, y: 0 };
  }
  battle = structuredClone(startCombat(battle, Object.fromEntries(battle.actors.map(actor => [actor.id, actor.id === 'hero-1' ? 20 : 10]))));
  battle = configureGrid(battle, { width: 10, height: 10, cellFt: 5 });
  return battle;
}

test('在场单位占据格子，别人不能进入', () => {
  const battle = setup();
  assert.throws(() => moveActorToCell(battle, 'hero-1', 2, 0), /该格已有单位/);
});

test('撤离后该格不再被占用', () => {
  const battle = setup();
  const foeId = battle.actors.find(actor => actor.id !== 'hero-1').id;
  const fled = fleeBattle(battle, foeId);
  const moved = moveActorToCell(fled, 'hero-1', 2, 0);
  const hero = moved.actors.find(actor => actor.id === 'hero-1');
  assert.deepEqual(hero.position, { x: 2, y: 0 });
});

test('在场单位挡在连线上时提供生物掩体', () => {
  const battle = setup();
  const foeId = battle.actors.find(actor => actor.id !== 'hero-1').id;
  const extra = { ...structuredClone(battle.actors.find(actor => actor.id === foeId)), id: 'middle-1', name: '挡路的同伴', side: '友方' };
  extra.position = { x: 1, y: 0 };
  const withMiddle = structuredClone(battle);
  withMiddle.actors.push(extra);
  const blocker = creatureCover(withMiddle, 'hero-1', foeId);
  assert.equal(blocker?.id, 'middle-1');
});

test('撤离者不再提供生物掩体', () => {
  const battle = setup();
  const foeId = battle.actors.find(actor => actor.id !== 'hero-1').id;
  const extra = { ...structuredClone(battle.actors.find(actor => actor.id === foeId)), id: 'middle-1', name: '挡路的同伴', side: '友方' };
  extra.position = { x: 1, y: 0 };
  const withMiddle = structuredClone(battle);
  withMiddle.actors.push(extra);
  const middle = withMiddle.actors.find(actor => actor.id === 'middle-1');
  middle.combat.fled = true;
  assert.equal(creatureCover(withMiddle, 'hero-1', foeId), null);
});

test('投降者仍占格、仍能挡枪（人还在原地）', () => {
  const battle = setup();
  const foeId = battle.actors.find(actor => actor.id !== 'hero-1').id;
  const extra = { ...structuredClone(battle.actors.find(actor => actor.id === foeId)), id: 'middle-1', name: '投降的同伴', side: '友方' };
  extra.position = { x: 1, y: 0 };
  const withMiddle = structuredClone(battle);
  withMiddle.actors.push(extra);
  withMiddle.actors.find(actor => actor.id === 'middle-1').combat.surrendered = true;
  assert.equal(creatureCover(withMiddle, 'hero-1', foeId)?.id, 'middle-1');
  assert.throws(() => moveActorToCell(withMiddle, 'hero-1', 1, 0), /该格已有单位/);
});
