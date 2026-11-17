const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, attack, healActor, damageActor } = require('../apps/web/src/combat.ts');
const { battleStatistics, sideStatistics, statsText } = require('../apps/web/src/combatStats.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `stats-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-stats', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '阿德里安', species: '人类', characterClass: '战士', level: 4,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 40, armorClass: 15, speedFt: 30, actions: '长剑：+6 命中，1d8+3 挥砍伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '统计', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 12, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = startCombat(next, initiatives);
  next = structuredClone(next);
  const attacker = next.actors.find(actor => actor.side === '友方');
  const target = next.actors.find(actor => actor.side === '敌方');
  attacker.position = { x: 0, y: 0 };
  target.position = { x: 1, y: 0 };
  return { battle: next, attacker, target };
}

const swing = { attackBonus: 8, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee' };

test('命中记录攻击次数与造成的伤害', () => {
  const { battle, attacker, target } = setup();
  const result = attack(battle, { attackerId: attacker.id, targetId: target.id, ...swing }, { random: sequence(0.5, 0.5) });
  const stats = battleStatistics(result.battle);
  const row = stats.rows.find(item => item.id === attacker.id);
  assert.equal(row.attacks, 1);
  assert.equal(row.hits, 1);
  assert.equal(row.crits, 0);
  assert.equal(row.accuracy, 1);
  assert.equal(row.damageDealt, result.outcome.damage);
  assert.equal(stats.round, result.battle.combat.round);
});

test('未命中只累加攻击次数与失误', () => {
  const { battle, attacker, target } = setup();
  const miss = attack(battle, { attackerId: attacker.id, targetId: target.id, ...swing }, { random: sequence(0.05) });
  const stats = battleStatistics(miss.battle);
  const row = stats.rows.find(item => item.id === attacker.id);
  assert.equal(row.attacks, 1);
  assert.equal(row.hits, 0);
  assert.equal(row.accuracy, 0);
  assert.equal(row.damageDealt, 0);
});

test('重击计入重击数并统计进伤害', () => {
  const { battle, attacker, target } = setup();
  const crit = attack(battle, { attackerId: attacker.id, targetId: target.id, ...swing }, { random: sequence(0.99, 0.5, 0.5) });
  const stats = battleStatistics(crit.battle);
  const row = stats.rows.find(item => item.id === attacker.id);
  assert.equal(row.crits, 1);
  assert.equal(row.damageDealt, crit.outcome.damage);
});

test('受到的伤害与治疗分别记账', () => {
  const { battle, attacker, target } = setup();
  const hurt = damageActor(battle, target.id, 7, '火焰').battle;
  const statsHurt = battleStatistics(hurt);
  assert.equal(statsHurt.rows.find(item => item.id === target.id).damageTaken, 7);
  const healed = healActor(hurt, target.id, 4);
  const statsHealed = battleStatistics(healed);
  const row = statsHealed.rows.find(item => item.id === target.id);
  assert.equal(row.healing, 4);
  assert.equal(row.damageTaken, 7);
  assert.equal(attacker.currentHp, attacker.maxHp);
});

test('总表按输出伤害排序并汇总双方数据', () => {
  const { battle, attacker, target } = setup();
  const hit = attack(battle, { attackerId: attacker.id, targetId: target.id, ...swing }, { random: sequence(0.5, 0.5) }).battle;
  const stats = battleStatistics(hit);
  assert.equal(stats.rows[0].id, attacker.id);
  assert.equal(stats.totals.attacks, 1);
  assert.equal(stats.totals.hits, 1);
  assert.equal(stats.totals.damageDealt, stats.rows[0].damageDealt);
  const allied = sideStatistics(hit, '友方');
  const hostile = sideStatistics(hit, '敌方');
  assert.equal(allied.damageDealt, stats.totals.damageDealt);
  assert.equal(hostile.attacks, 0);
  assert.equal(hostile.damageTaken, stats.totals.damageDealt);
});

test('摘要文案在没有攻击时提示，之后给出轮次与命中率', () => {
  const { battle, attacker, target } = setup();
  assert.match(statsText(battle), /还没有攻击记录/);
  const hit = attack(battle, { attackerId: attacker.id, targetId: target.id, ...swing }, { random: sequence(0.5, 0.5) }).battle;
  const text = statsText(hit);
  assert.match(text, /^第 1 轮 · 1 次攻击 · 命中 1（100%）/);
  assert.match(text, /造成 \d+ 点伤害/);
});
