const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, attackSequence } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup(count = 2) {
  const battle = addMonsters(emptyStore(), card, { newBattleName: '分散攻击', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const hero = { ...battle.actors[0], id: 'hero', name: '艾拉', side: '友方', characterSnapshot: { schemaVersion: 'manual-character-snapshot/v1', name: '艾拉', sheet: { name: '艾拉', characterClass: '战士', level: 5, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }, details: { fighterCalculator: { characterClass: '战士' } }, actions: '', details2: {} } } };
  const withHero = { ...battle, actors: [hero, ...battle.actors] };
  const initiatives = Object.fromEntries(withHero.actors.map((item, index) => [item.id, item.id === 'hero' ? 20 : index]));
  const started = startCombat(withHero, initiatives);
  const monsters = started.actors.filter(item => item.side === '敌方').map(item => item.id);
  return { battle: started, hero: 'hero', monster: monsters };
}

test('攻击次数超过目标数时按顺序轮流分配', () => {
  const { battle, hero, monster } = setup(2);
  const result = attackSequence(battle, { attackerId: hero, targetId: monster[0], targets: [monster[0], monster[1]], attacks: 2, attackBonus: 5, damageExpression: '1d6+2', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5, 0.5) });
  assert.equal(result.outcomes.length, 2);
  const after = result.battle.actors.filter(item => monster.includes(item.id));
  assert.ok(after.every(item => item.currentHp < item.maxHp));
  assert.match(result.battle.combat.log.at(-1).text, /完成攻击动作：2 次攻击/);
});

test('单个目标时行为与原来一致', () => {
  const { battle, hero, monster } = setup(2);
  const result = attackSequence(battle, { attackerId: hero, targetId: monster[0], attacks: 2, attackBonus: 5, damageExpression: '1d6+2', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5, 0.5) });
  assert.equal(result.outcomes.length, 2);
  assert.ok(result.outcomes.every(item => item.targetHp <= 40));
});

test('目标重复时报错', () => {
  const { battle, hero, monster } = setup(2);
  assert.throws(() => attackSequence(battle, { attackerId: hero, targetId: monster[0], targets: [monster[0], monster[0]], attacks: 2, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }), /连续攻击的目标不能重复。/);
});

test('把自己列为目标时报错', () => {
  const { battle, hero, monster } = setup(2);
  assert.throws(() => attackSequence(battle, { attackerId: hero, targetId: monster[0], targets: [monster[0], hero], attacks: 2, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }), /不能攻击自己。/);
});

test('目标被打死后剩余攻击转向其他目标', () => {
  const { battle, hero, monster } = setup(2);
  const weak = { ...battle, actors: battle.actors.map(item => item.id === monster[0] ? { ...item, currentHp: 1 } : item) };
  const result = attackSequence(weak, { attackerId: hero, targetId: monster[0], targets: [monster[0], monster[1]], attacks: 2, attackBonus: 5, damageExpression: '1d6+2', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5, 0.5) });
  assert.equal(result.outcomes.length, 2);
  const second = result.outcomes[1];
  assert.ok(second.targetHp < 40);
});

test('附赠动作不能连续攻击多个目标', () => {
  const { battle, hero, monster } = setup(2);
  assert.throws(() => attackSequence(battle, { attackerId: hero, targetId: monster[0], targets: [monster[0], monster[1]], attacks: 2, cost: 'bonus', attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }), /只有使用动作的攻击才能连续攻击多个目标。/);
});
