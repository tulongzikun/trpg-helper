const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, damageActor, fleeBattle } = require('../apps/web/src/combat.ts');
const { battleReport } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `rep-out-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-rep-out', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '凯尔', species: '人类', characterClass: '战士', level: 3,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 32, armorClass: 17, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '结果判定', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const withHero = addCharacter(store, hero, { battleId: store.battles[0].id, side: '友方' }, ids());
  const battle = withHero.store.battles[0];
  const initiatives = {};
  battle.actors.forEach((actor) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10; });
  return startCombat(battle, initiatives);
}

test('进行中的战斗在战报里标为进行中', () => {
  assert.match(battleReport(setup()), /- 结果：战斗进行中。/);
});

test('敌方全灭后战报标为胜利', () => {
  let battle = setup();
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = damageActor(battle, foe.id, 200, '挥砍').battle;
  assert.match(battleReport(battle), /- 结果：战斗结束：敌方已全部倒下。/);
});

test('敌方撤离后同样算胜利', () => {
  let battle = setup();
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = fleeBattle(battle, foe.id);
  assert.match(battleReport(battle), /敌方已全部倒下/);
});

test('友方全灭后标为失败', () => {
  let battle = setup();
  const ally = battle.actors.find(actor => actor.side === '友方');
  battle = damageActor(battle, ally.id, 200, '挥砍').battle;
  assert.match(battleReport(battle), /- 结果：战斗结束：友方已全部倒下。/);
});

test('结果行紧跟状态行，单位表列头不变', () => {
  const text = battleReport(setup());
  const statusIndex = text.indexOf('- 状态：');
  const resultIndex = text.indexOf('- 结果：');
  assert.ok(statusIndex >= 0 && resultIndex > statusIndex);
  assert.ok(resultIndex - statusIndex < 80, '结果行应紧挨状态行');
  assert.ok(text.includes('| 单位 | 阵营 | 生命 | 状态 | 条件 | 专注 |'));
});
