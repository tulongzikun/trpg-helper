const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, rerollInitiative, currentActorId } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup(count = 2) {
  const battle = addMonsters(emptyStore(), card, { newBattleName: '重掷先攻', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const hero = { ...battle.actors[0], id: 'hero', name: '艾拉', side: '友方' };
  const withHero = { ...battle, actors: [hero, ...battle.actors] };
  const initiatives = Object.fromEntries(withHero.actors.map((item, index) => [item.id, item.id === 'hero' ? 20 : index]));
  return startCombat(withHero, initiatives);
}

test('重掷先攻会为所有在场单位重新生成先攻并按高低排序', () => {
  const battle = setup();
  const current = currentActorId(battle);
  const after = rerollInitiative(battle, { random: sequence(0.9, 0.1, 0.5) });
  const values = after.combat.order.map(id => after.actors.find(item => item.id === id).combat.initiative);
  assert.deepEqual(values, values.slice().sort((left, right) => right - left));
  assert.equal(values.length, battle.actors.filter(item => item.combat).length);
  assert.equal(currentActorId(after), current);
});

test('重掷后当前行动者保持不变，先攻栏顺序随之改变', () => {
  const battle = setup();
  const current = currentActorId(battle);
  const after = rerollInitiative(battle, { random: sequence(0.0, 0.95, 0.5) });
  assert.equal(currentActorId(after), current);
  assert.notDeepEqual(after.combat.order, battle.combat.order);
});

test('重掷会写入一条日志', () => {
  const battle = setup();
  const after = rerollInitiative(battle, { random: sequence(0.5, 0.5, 0.5) });
  assert.match(after.combat.log.at(-1).text, /^重新掷先攻：/);
});

test('阵亡单位不参与重掷', () => {
  const battle = setup();
  const dead = { ...battle, actors: battle.actors.map(item => item.id === battle.actors[1].id ? { ...item, combat: { ...item.combat, status: 'dead', initiative: 9 } } : item) };
  const after = rerollInitiative(dead, { random: sequence(0.5, 0.5, 0.5) });
  const still = after.actors.find(item => item.id === battle.actors[1].id);
  assert.equal(still.combat.initiative, 9);
});

test('未开始战斗时无法重掷', () => {
  const battle = addMonsters(emptyStore(), card, { newBattleName: '未开始', side: '敌方', count: 1 }, ids()).store.battles[0];
  assert.throws(() => rerollInitiative(battle), /战斗尚未开始。/);
});
