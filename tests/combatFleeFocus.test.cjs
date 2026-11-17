const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, blessTargets, castBless, castFogCloud, configureGrid, fleeBattle, surrender } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `focus-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '专注中断', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const foe = battle.actors[0];
  foe.position = { x: 0, y: 0 };
  const hero = { ...structuredClone(foe), id: 'hero-1', name: '牧师', side: '友方', position: { x: 0, y: 1 } };
  hero.combat = undefined;
  const ally = { ...structuredClone(foe), id: 'ally-1', name: '战士', side: '友方', position: { x: 0, y: 2 } };
  ally.combat = undefined;
  battle.actors.push(hero, ally);
  battle = structuredClone(startCombat(battle, { [foe.id]: 20, 'hero-1': 10, 'ally-1': 5 }));
  battle = configureGrid(battle, { width: 10, height: 10, cellFt: 5 });
  return { battle, heroId: 'hero-1' };
}

const textsOf = battle => (battle.combat?.log ?? []).map(item => item.text);

test('撤离时结束专注并解除祝福', () => {
  const { battle, heroId } = setup();
  const targetIds = blessTargets(battle, heroId).map(item => item.id);
  const blessed = castBless(battle, heroId, targetIds);
  const fled = fleeBattle(blessed, heroId);
  const hero = fled.actors.find(actor => actor.id === heroId);
  assert.equal(hero.combat.concentration, undefined);
  assert.ok(fled.actors.every(actor => actor.combat?.blessed === undefined));
  assert.ok(textsOf(fled).some(text => /撤离战场，专注的祝福术中断/.test(text)));
});

test('撤离时清掉留下的云雾', () => {
  const { battle, heroId } = setup();
  const fogged = castFogCloud(battle, heroId, [{ x: 1, y: 1 }]);
  const fled = fleeBattle(fogged, heroId);
  assert.equal(fled.fog, undefined);
  assert.equal(fled.fogBy, undefined);
  assert.ok(textsOf(fled).some(text => /迷雾消散了/.test(text)));
});

test('投降时同样中断专注', () => {
  const { battle, heroId } = setup();
  const blessed = castBless(battle, heroId, blessTargets(battle, heroId).map(item => item.id));
  const yielded = surrender(blessed, heroId);
  assert.equal(yielded.actors.find(actor => actor.id === heroId).combat.concentration, undefined);
  assert.ok(textsOf(yielded).some(text => /投降，专注的祝福术中断/.test(text)));
});

test('没有专注的单位撤离时不会产生专注中断日志', () => {
  const { battle, heroId } = setup();
  const fled = fleeBattle(battle, heroId);
  assert.ok(!textsOf(fled).some(text => /专注的/.test(text)));
});

test('撤离仍然清空与自身相关的反应提示', () => {
  const { battle, heroId } = setup();
  const cloned = structuredClone(battle);
  const foe = cloned.actors[0];
  cloned.combat.pendingOpportunity = [{ reactorId: foe.id, targetId: heroId }];
  const fled = fleeBattle(cloned, heroId);
  assert.deepEqual(fled.combat.pendingOpportunity, []);
});
