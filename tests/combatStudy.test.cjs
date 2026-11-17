const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, studyTarget, currentActorId } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const battle = addMonsters(emptyStore(), card, { newBattleName: '观察', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const hero = { ...battle.actors[0], id: 'hero', name: '艾拉', side: '友方' };
  const withHero = { ...battle, actors: [hero, ...battle.actors] };
  const initiatives = Object.fromEntries(withHero.actors.map((item, index) => [item.id, item.id === 'hero' ? 20 : 1]));
  const started = startCombat(withHero, initiatives);
  const enemy = started.actors.find(item => item.side === '敌方');
  return { battle: started, enemy };
}

test('观察成功会标记目标并列出防护信息', () => {
  const { battle, enemy } = setup();
  const result = studyTarget(battle, 'hero', enemy.id, { random: sequence(0.9) });
  assert.equal(result.success, true);
  const line = result.battle.combat.log.at(-1);
  assert.match(line.text, /观察 .* 成功（调查 DC 10）。/);
  assert.match(line.detail, /AC \d+/);
  assert.match(line.detail, /HP \d+\/\d+/);
  assert.equal(result.battle.actors.find(item => item.id === enemy.id).combat.revealed, true);
});

test('观察失败不会标记目标，但仍消耗动作', () => {
  const { battle, enemy } = setup();
  const result = studyTarget(battle, 'hero', enemy.id, { random: sequence(0.0) });
  assert.equal(result.success, false);
  assert.match(result.battle.combat.log.at(-1).text, /观察 .* 失败（调查 DC 10）。/);
  assert.equal(result.battle.actors.find(item => item.id === enemy.id).combat.revealed, undefined);
  assert.equal(result.battle.actors.find(item => item.id === 'hero').combat.actionUsed, true);
});

test('同一回合不能观察两次', () => {
  const { battle, enemy } = setup();
  const once = studyTarget(battle, 'hero', enemy.id, { random: sequence(0.9) }).battle;
  assert.throws(() => studyTarget(once, 'hero', enemy.id, { random: sequence(0.9) }), /该单位本回合已经使用过动作。/);
});

test('不能观察自己，也不能观察死亡单位', () => {
  const { battle, enemy } = setup();
  assert.throws(() => studyTarget(battle, 'hero', 'hero'), /不能观察自己。/);
  const dead = { ...battle, actors: battle.actors.map(item => item.id === enemy.id ? { ...item, combat: { ...item.combat, status: 'dead' } } : item) };
  assert.throws(() => studyTarget(dead, 'hero', enemy.id), /无法观察已经死亡的单位。/);
});

test('非当前回合的单位不能观察', () => {
  const { battle, enemy } = setup();
  assert.throws(() => studyTarget(battle, enemy.id, 'hero'), /只有当前回合的单位可以观察。/);
});
