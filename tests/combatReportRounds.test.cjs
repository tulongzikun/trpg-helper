const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, endTurn } = require('../apps/web/src/combat.ts');
const { battleReport } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `round-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-round', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '罗兰', species: '人类', characterClass: '战士', level: 3,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 30, armorClass: 17, speedFt: 30, actions: '长剑：+7 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '分轮战报', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const added = addCharacter(store, hero, { battleId: store.battles[0].id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const heroId = battle.actors.find(actor => actor.name === '罗兰').id;
  const foeId = battle.actors.find(actor => actor.side === '敌方').id;
  const initiatives = {};
  battle.actors.forEach((actor) => { initiatives[actor.id] = actor.id === heroId ? 20 : 10; });
  return { battle: startCombat(battle, initiatives), heroId, foeId };
}

test('单轮战斗不插入轮次小节', () => {
  const { battle } = setup();
  const report = battleReport(battle);
  assert.equal(report.includes('#### 第 1 轮'), false);
});

test('跨轮后战报按轮次分段', () => {
  const { battle } = setup();
  let next = endTurn(battle);
  next = endTurn(next);
  const report = battleReport(next);
  assert.ok(report.includes('#### 第 2 轮'), '缺少第二轮小节');
});

test('轮次小节出现在对应记录之前', () => {
  const { battle } = setup();
  let next = endTurn(battle);
  next = endTurn(next);
  const report = battleReport(next);
  const headerIndex = report.indexOf('#### 第 2 轮');
  const secondRoundEntry = report.indexOf('第 2 轮', headerIndex + 1) >= 0;
  assert.ok(headerIndex > 0);
  assert.ok(secondRoundEntry, '小节后应当跟着第二轮的记录');
});

test('没有记录时只写占位且没有轮次小节', () => {
  const { battle } = setup();
  const empty = { ...battle, combat: { ...battle.combat, log: [] } };
  const report = battleReport(empty);
  assert.ok(report.includes('（暂无记录）'));
  assert.equal(report.includes('#### 第'), false);
});
