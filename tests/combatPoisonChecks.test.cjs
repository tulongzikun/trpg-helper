const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { applyPoison, configureGrid, endTurn, escapeGrapple, grapple, moveActorToCell, shove, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `poison-check-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '中毒检定', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const build = (id, name, side) => ({ ...base.actors[0], id, name, side });
  const seeded = { ...base, actors: [build('hero', '艾拉', '友方'), build('foe', '哥布林', '敌方')] };
  const config = configureGrid(seeded, { width: 20, height: 20, cellFt: 5 });
  let battle = startCombat(config, { hero: 20, foe: 10 });
  battle = moveActorToCell(battle, 'hero', 2, 2);
  battle = moveActorToCell(battle, 'foe', 3, 2);
  return battle;
}

const logs = battle => battle.combat.log.map(line => line.text).join('\n');

test('中毒的擒抱方掷两次取低并且日志标注劣势', () => {
  const battle = setup();
  const poisoned = applyPoison(battle, 'hero', { random: sequence(0) }).battle;
  // 攻击方两次掷骰 19 与 3，取 3；目标一次掷 5
  const result = grapple(poisoned, { attackerId: 'hero', targetId: 'foe' }, { random: sequence(0.9, 0.1, 0.2) });
  assert.equal(result.outcome.attackerNatural, 3);
  assert.ok(logs(result.battle).includes('中毒：属性检定劣势'));
});

test('未中毒时擒抱只掷一次骰子', () => {
  const battle = setup();
  const result = grapple(battle, { attackerId: 'hero', targetId: 'foe' }, { random: sequence(0.9, 0.2) });
  assert.equal(result.outcome.attackerNatural, 19);
  assert.ok(!logs(result.battle).includes('属性检定劣势'));
});

test('目标中毒时它的对抗检定带劣势', () => {
  const battle = setup();
  const poisoned = applyPoison(battle, 'foe', { random: sequence(0) }).battle;
  // 攻击方一次 10，目标两次 19 与 3，取 3
  const result = shove(poisoned, { attackerId: 'hero', targetId: 'foe', effect: 'prone' }, { random: sequence(0.45, 0.9, 0.1) });
  assert.equal(result.outcome.targetNatural, 3);
  assert.ok(logs(result.battle).includes('中毒：属性检定劣势'));
});

test('中毒的被擒抱者挣脱时同样劣势，并在日志里标出', () => {
  const battle = setup();
  const grappled = grapple(battle, { attackerId: 'hero', targetId: 'foe' }, { random: sequence(0.9, 0.1) }).battle;
  const poisoned = applyPoison(grappled, 'foe', { random: sequence(0) }).battle;
  const next = endTurn(poisoned, { random: sequence(0.5) });
  const result = escapeGrapple(next, 'foe', { random: sequence(0.9, 0.1) });
  assert.equal(result.outcome.attackerNatural, 3);
  assert.ok(logs(result.battle).includes('中毒：属性检定劣势'));
});
