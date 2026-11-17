const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, fleeBattle, availableTargets, healTargets, hostileTargets, spellTargets, blindTargets, deafenTargets, aidTargets, barkskinTargets } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `fled-target-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '撤离目标', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  for (const actor of battle.actors) {
    actor.position = { x: 0, y: 0 };
  }
  const hero = { ...structuredClone(battle.actors[0]), id: 'hero-1', name: '英雄', side: '友方' };
  hero.combat = undefined;
  hero.position = { x: 1, y: 1 };
  battle.actors.push(hero);
  battle = structuredClone(startCombat(battle, Object.fromEntries(battle.actors.map(actor => [actor.id, actor.id === 'hero-1' ? 20 : 10]))));
  const foe = battle.actors.find(actor => actor.id !== 'hero-1');
  return { battle, heroId: 'hero-1', foeId: foe.id };
}

test('撤离前：敌人出现在可攻击目标与敌对目标里', () => {
  const { battle, heroId, foeId } = setup();
  assert.ok(availableTargets(battle, heroId).some(actor => actor.id === foeId));
  assert.ok(hostileTargets(battle, heroId, 60).some(actor => actor.id === foeId));
});

test('撤离后：不再出现在可攻击目标里', () => {
  const { battle, heroId, foeId } = setup();
  const fled = fleeBattle(battle, foeId);
  assert.equal(availableTargets(fled, heroId).some(actor => actor.id === foeId), false);
});

test('撤离后：不再是敌对法术的候选目标', () => {
  const { battle, heroId, foeId } = setup();
  const fled = fleeBattle(battle, foeId);
  assert.equal(hostileTargets(fled, heroId, 60).some(actor => actor.id === foeId), false);
  assert.equal(blindTargets(fled, heroId, 60).some(actor => actor.id === foeId), false);
  assert.equal(deafenTargets(fled, heroId, 60).some(actor => actor.id === foeId), false);
});

test('撤离后：不再被友方增益或治疗选中', () => {
  const { battle, heroId, foeId } = setup();
  const fled = fleeBattle(battle, foeId);
  // 让撤离者与英雄同阵营，验证友方目标筛选同样排除它。
  const ally = structuredClone(fled);
  const allyActor = ally.actors.find(actor => actor.id === foeId);
  allyActor.side = '友方';
  assert.equal(healTargets(ally, heroId).some(actor => actor.id === foeId), false);
  assert.equal(aidTargets(ally, heroId).some(actor => actor.id === foeId), false);
  assert.equal(barkskinTargets(ally, heroId).some(actor => actor.id === foeId), false);
  assert.equal(spellTargets(ally, heroId).some(actor => actor.id === foeId), false);
});

test('投降的单位仍可被选中（仍在战场上）', () => {
  const { battle, heroId, foeId } = setup();
  const yielded = structuredClone(battle);
  yielded.actors.find(actor => actor.id === foeId).combat.surrendered = true;
  assert.ok(availableTargets(yielded, heroId).some(actor => actor.id === foeId));
});
