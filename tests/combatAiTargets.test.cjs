const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, fleeBattle, surrender } = require('../apps/web/src/combat.ts');
const { suggestAttacks, suggestTurn, hasImmediateAttack } = require('../apps/web/src/combatAi.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `ai-target-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: 'AI 目标', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const hero = { ...structuredClone(battle.actors[0]), id: 'hero-1', name: '英雄', side: '友方' };
  hero.combat = undefined;
  battle.actors.push(hero);
  battle = structuredClone(startCombat(battle, Object.fromEntries(battle.actors.map(actor => [actor.id, actor.id === 'hero-1' ? 20 : 10]))));
  const foe = battle.actors.find(actor => actor.id !== 'hero-1');
  return { battle, heroId: 'hero-1', foeId: foe.id };
}

test('正常敌人会被建议为攻击目标', () => {
  const { battle, heroId, foeId } = setup();
  const list = suggestAttacks(battle, heroId);
  assert.ok(list.some(item => item.targetId === foeId));
});

test('已撤离的敌人不再被建议攻击', () => {
  const { battle, heroId, foeId } = setup();
  const fled = fleeBattle(battle, foeId);
  const list = suggestAttacks(fled, heroId);
  assert.equal(list.some(item => item.targetId === foeId), false);
});

test('已投降的敌人不再被建议攻击', () => {
  const { battle, heroId, foeId } = setup();
  const yielded = surrender(battle, foeId);
  const list = suggestAttacks(yielded, heroId);
  assert.equal(list.some(item => item.targetId === foeId), false);
});

test('只剩投降的敌人时，建议变成按兵不动', () => {
  const { battle, heroId, foeId } = setup();
  const yielded = surrender(battle, foeId);
  const turn = suggestTurn(yielded);
  if (turn.actorId === heroId) {
    assert.equal(turn.action, 'hold');
    assert.match(turn.note, /没有可攻击的敌人/);
  } else {
    assert.equal(turn.actorId, foeId);
  }
});

test('hasImmediateAttack 对已撤离的敌人返回 false', () => {
  const { battle, heroId, foeId } = setup();
  const fled = fleeBattle(battle, foeId);
  assert.equal(hasImmediateAttack(fled, heroId), false);
});
