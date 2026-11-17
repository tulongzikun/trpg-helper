const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, attack, damageActor, setWeather } = require('../apps/web/src/combat.ts');
const { battleStatistics, sideStatistics, damageTypeShares, typeText } = require('../apps/web/src/combatStats.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `dtype-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-dtype', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '塞拉', species: '人类', characterClass: '战士', level: 3,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 36, armorClass: 15, speedFt: 30, actions: '长剑：+6 命中，1d8+3 挥砍伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '类型', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 12, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const attacker = next.actors.find(actor => actor.side === '友方');
  const target = next.actors.find(actor => actor.side === '敌方');
  attacker.position = { x: 0, y: 0 };
  target.position = { x: 1, y: 0 };
  return { battle: next, attacker, target };
}

const swing = { attackBonus: 8, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee' };

test('承受伤害按类型分别累计', () => {
  const { battle, target } = setup();
  let next = damageActor(battle, target.id, 7, '火焰').battle;
  next = damageActor(next, target.id, 4, '火焰').battle;
  next = damageActor(next, target.id, 5, '穿刺').battle;
  const row = battleStatistics(next).rows.find(item => item.id === target.id);
  assert.deepEqual(row.damageByType, { 火焰: 11, 穿刺: 5 });
  assert.equal(row.damageTaken, 16);
});

test('抗性减伤后的实际数值记账', () => {
  const { battle, target } = setup();
  const rainy = setWeather(battle, 'rain');
  const next = damageActor(rainy, target.id, 10, '火焰').battle;
  const row = battleStatistics(next).rows.find(item => item.id === target.id);
  assert.equal(row.damageByType.火焰, 5);
  assert.equal(row.damageTaken, 5);
});

test('攻击伤害也按攻击伤害类型计入', () => {
  const { battle, attacker, target } = setup();
  const result = attack(battle, { attackerId: attacker.id, targetId: target.id, ...swing }, { random: sequence(0.5, 0.5) });
  const row = battleStatistics(result.battle).rows.find(item => item.id === target.id);
  assert.equal(row.damageByType.挥砍, result.outcome.damage);
  const dealtRow = battleStatistics(result.battle).rows.find(item => item.id === attacker.id);
  assert.equal(dealtRow.damageByType.挥砍, undefined);
});

test('类型占比降序并保留两位小数', () => {
  const { battle, target } = setup();
  let next = damageActor(battle, target.id, 30, '火焰').battle;
  next = damageActor(next, target.id, 10, '挥砍').battle;
  const shares = damageTypeShares(next);
  assert.equal(shares.length, 2);
  assert.equal(shares[0].type, '火焰');
  assert.equal(shares[0].amount, 30);
  assert.equal(shares[0].share, 0.75);
  assert.equal(shares[1].type, '挥砍');
  assert.equal(shares[1].share, 0.25);
});

test('超出上限的类型合并为「其他」', () => {
  const { battle, target } = setup();
  let next = battle;
  for (const [type, amount] of [['火焰', 10], ['挥砍', 8], ['穿刺', 6], ['钝击', 4], ['毒素', 2]]) {
    next = damageActor(next, target.id, amount, type).battle;
  }
  const shares = damageTypeShares(next, 3);
  assert.equal(shares.length, 3);
  assert.equal(shares[2].type, '其他');
  assert.equal(shares[2].amount, 12);
  assert.equal(shares[0].type, '火焰');
});

test('摘要文案在无伤害时提示，之后列出主要类型', () => {
  const { battle, target } = setup();
  assert.match(typeText(battle), /尚无伤害记录/);
  const next = damageActor(battle, target.id, 20, '火焰').battle;
  const text = typeText(next);
  assert.match(text, /^伤害构成：火焰 20（100%）$/);
});

test('阵营汇总与总表都带类型分布', () => {
  const { battle, target } = setup();
  const next = damageActor(battle, target.id, 9, '闪电').battle;
  const stats = battleStatistics(next);
  assert.deepEqual(stats.totals.damageByType, { 闪电: 9 });
  assert.deepEqual(sideStatistics(next, '敌方').damageByType, { 闪电: 9 });
  assert.deepEqual(sideStatistics(next, '友方').damageByType, {});
});
