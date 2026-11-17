const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, setActorHp } = require('../apps/web/src/combat.ts');
const { battleOutcome, outcomeLabel, hasActingSide } = require('../apps/web/src/combatOutcome.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '胜负', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const enemy = base.actors[0];
  const ally = { ...enemy, id: 'ally', name: '艾拉', side: '友方' };
  return startCombat({ ...base, actors: [ally, enemy] }, { ally: 20, [enemy.id]: 1 });
}

test('双方都在场时为进行中', () => {
  const battle = setup();
  assert.equal(battleOutcome(battle), 'ongoing');
  assert.equal(outcomeLabel('ongoing'), '战斗进行中。');
});

test('敌方全部阵亡判定为胜利', () => {
  const battle = setup();
  const enemyId = battle.actors.find(item => item.side === '敌方').id;
  const after = setActorHp(battle, enemyId, 0);
  assert.equal(battleOutcome(after), 'victory');
  assert.match(outcomeLabel('victory'), /敌方已全部倒下/);
});

test('友方全部阵亡判定为失败', () => {
  const battle = setup();
  const after = setActorHp(battle, 'ally', 0);
  assert.equal(battleOutcome(after), 'defeat');
  assert.match(outcomeLabel('defeat'), /友方已全部倒下/);
});

test('双方同时倒下判定为同归于尽', () => {
  let battle = setup();
  const enemyId = battle.actors.find(item => item.side === '敌方').id;
  battle = setActorHp(battle, enemyId, 0);
  battle = setActorHp(battle, 'ally', 0);
  assert.equal(battleOutcome(battle), 'draw');
  assert.match(outcomeLabel('draw'), /同归于尽/);
});

test('hasActingSide 只看仍在行动的单位', () => {
  const battle = setup();
  assert.equal(hasActingSide(battle, '友方'), true);
  const after = setActorHp(battle, 'ally', 0);
  assert.equal(hasActingSide(after, '友方'), false);
  assert.equal(hasActingSide(after, '敌方'), true);
});
