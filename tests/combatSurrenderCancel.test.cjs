const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, surrender, damageActor, healActor, executeCaptive, endTurn, currentActorId } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `surrender-cancel-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '投降取消', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  for (const actor of battle.actors) actor.position = { x: 0, y: 0 };
  const hero = { ...structuredClone(battle.actors[0]), id: 'hero-1', name: '英雄', side: '友方' };
  hero.combat = undefined;
  hero.position = { x: 1, y: 0 };
  battle.actors.push(hero);
  battle = structuredClone(startCombat(battle, Object.fromEntries(battle.actors.map(actor => [actor.id, actor.id === 'hero-1' ? 20 : 10]))));
  const foeId = battle.actors.find(actor => actor.id !== 'hero-1').id;
  const yielded = surrender(battle, foeId);
  return { battle: yielded, heroId: 'hero-1', foeId };
}

test('投降者挨打后重新投入战斗', () => {
  const { battle, foeId } = setup();
  assert.equal(battle.actors.find(actor => actor.id === foeId).combat.surrendered, true);
  const after = damageActor(battle, foeId, 1, '挥砍').battle;
  const state = after.actors.find(actor => actor.id === foeId).combat;
  assert.equal(state.surrendered, undefined);
  assert.ok(after.combat.log.some(entry => entry.text.includes('遭到攻击，重新投入战斗')));
});

test('重新投入战斗后会恢复自己的回合', () => {
  const { battle, heroId, foeId } = setup();
  const stillYielded = endTurn(battle);
  assert.notEqual(currentActorId(stillYielded), foeId);
  const after = damageActor(battle, foeId, 1, '挥砍').battle;
  assert.equal(currentActorId(after), heroId);
  const advanced = endTurn(after);
  assert.equal(currentActorId(advanced), foeId);
});

test('治疗不会取消投降', () => {
  const { battle, foeId } = setup();
  const wounded = structuredClone(battle);
  const target = wounded.actors.find(actor => actor.id === foeId);
  target.currentHp = Math.max(1, target.currentHp - 1);
  target.combat.surrendered = true;
  const healed = healActor(wounded, foeId, 1);
  assert.equal(healed.actors.find(actor => actor.id === foeId).combat.surrendered, true);
});

test('被完全免疫的 0 点伤害不会取消投降', () => {
  const { battle, foeId } = setup();
  const guarded = structuredClone(battle);
  const target = guarded.actors.find(actor => actor.id === foeId);
  target.combat.damageImmunities = ['火焰'];
  target.combat.surrendered = true;
  const after = damageActor(guarded, foeId, 5, '火焰').battle;
  assert.equal(after.actors.find(actor => actor.id === foeId).combat.surrendered, true);
});

test('处决仍然可以正常进行（不改变投降状态即可处决）', () => {
  const { battle, heroId, foeId } = setup();
  const executed = executeCaptive(battle, heroId, foeId);
  const state = executed.actors.find(actor => actor.id === foeId).combat;
  assert.equal(state.status, 'dead');
  assert.ok(executed.combat.log.some(entry => entry.text.includes('处决了投降的')));
});
