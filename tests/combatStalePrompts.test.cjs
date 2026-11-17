const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, pendingOpportunities, declineOpportunity, endTurn } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `stale-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '作废提示', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const foe = battle.actors[0];
  foe.position = { x: 0, y: 0 };
  const hero = { ...structuredClone(foe), id: 'hero-1', name: '英雄', side: '友方', position: { x: 0, y: 1 } };
  hero.combat = undefined;
  battle.actors.push(hero);
  battle = structuredClone(startCombat(battle, { [foe.id]: 10, 'hero-1': 20 }));
  battle = configureGrid(battle, { width: 10, height: 10, cellFt: 5 });
  return { battle, foeId: foe.id };
}

const textsOf = battle => (battle.combat?.log ?? []).map(item => item.text);

test('未结算的反应提示会在回合结束时作废并记入战报', () => {
  const { battle } = setup();
  const moved = moveActorToCell(battle, 'hero-1', 0, 3);
  assert.equal(pendingOpportunities(moved).length, 1);
  const ended = endTurn(moved, { random: () => 0.5 });
  assert.equal(pendingOpportunities(ended).length, 0);
  assert.ok(textsOf(ended).some(text => /1 条未结算的反应提示随回合结束作废。/.test(text)));
});

test('没有待结算提示时不写作废日志', () => {
  const { battle } = setup();
  const ended = endTurn(battle, { random: () => 0.5 });
  assert.ok(!textsOf(ended).some(text => /反应提示随回合结束作废/.test(text)));
});

test('已经放弃的提示不会重复出现在作废日志里', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, 'hero-1', 0, 3);
  const cleared = declineOpportunity(moved, foeId);
  assert.equal(pendingOpportunities(cleared).length, 0);
  const ended = endTurn(cleared, { random: () => 0.5 });
  assert.ok(!textsOf(ended).some(text => /反应提示随回合结束作废/.test(text)));
});

test('多条提示一起作废时写出总数', () => {
  const { battle } = setup();
  const cloned = structuredClone(battle);
  const foe = cloned.actors[0];
  cloned.combat.pendingOpportunity = [
    { reactorId: foe.id, targetId: 'hero-1' },
    { reactorId: foe.id, targetId: 'hero-1' },
  ];
  const ended = endTurn(cloned, { random: () => 0.5 });
  assert.ok(textsOf(ended).some(text => /2 条未结算的反应提示随回合结束作废。/.test(text)));
  assert.equal(pendingOpportunities(ended).length, 0);
});
