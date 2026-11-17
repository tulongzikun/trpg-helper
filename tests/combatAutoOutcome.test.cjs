const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, setActorHp, currentActorId } = require('../apps/web/src/combat.ts');
const { autoAct, autoSide, autoTurn } = require('../apps/web/src/combatAuto.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `ao-${++counter}`;

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '收尾', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const enemy = battle.actors[0];
  const ally = { ...enemy, id: 'ally', name: '艾拉', side: '友方' };
  return startCombat({ ...battle, actors: [ally, enemy] }, { ally: 20, [enemy.id]: 5 });
}

function finished() {
  const battle = setup();
  const enemyId = battle.actors.find(item => item.side === '敌方').id;
  return setActorHp(battle, enemyId, 0);
}

test('战斗结束后自动行动直接等待且不改状态', () => {
  const battle = finished();
  const before = currentActorId(battle);
  const result = autoAct(battle, before);
  assert.equal(result.kind, 'wait');
  assert.match(result.text, /战斗已经结束/);
  assert.deepEqual(result.battle, battle);
});

test('战斗结束后自动回合不再结束回合', () => {
  const battle = finished();
  const before = currentActorId(battle);
  const result = autoTurn(battle, before);
  assert.match(result.text, /战斗已经结束/);
  assert.equal(currentActorId(result.battle), before);
  assert.equal(result.battle.combat.round, battle.combat.round);
});

test('整轮自动在战斗结束时停止', () => {
  const battle = finished();
  const before = currentActorId(battle);
  const result = autoSide(battle, '友方');
  assert.equal(result.turns.length, 1);
  assert.match(result.turns[0], /战斗已经结束/);
  assert.equal(currentActorId(result.battle), before);
});

test('未结束的战斗照常自动推进', () => {
  const battle = setup();
  const result = autoSide(battle, '友方');
  assert.ok(result.turns.length >= 1);
  assert.doesNotMatch(result.turns.join(' '), /战斗已经结束/);
  assert.notEqual(currentActorId(result.battle), currentActorId(battle));
});
