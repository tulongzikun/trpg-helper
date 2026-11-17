const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, fleeBattle, surrender } = require('../apps/web/src/combat.ts');
const { initiativeOrder, battleReport } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `ord-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '先攻备注', side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const hero = battle.actors[0];
  hero.name = '英雄';
  const foe = { ...structuredClone(hero), id: 'foe-1', name: '敌人', side: '敌方' };
  foe.combat = undefined;
  battle.actors.push(foe);
  battle = structuredClone(startCombat(battle, { [hero.id]: 20, 'foe-1': 10 }));
  return { battle, heroId: hero.id };
}

test('在场单位的先攻行没有备注', () => {
  const { battle } = setup();
  assert.ok(initiativeOrder(battle).every(item => item.note === ''));
});

test('撤离单位标注已撤离', () => {
  const { battle, heroId } = setup();
  const fled = fleeBattle(battle, heroId);
  const row = initiativeOrder(fled).find(item => item.name === '英雄');
  assert.equal(row.note, '已撤离');
  assert.match(battleReport(fled), /英雄（先攻 20）[^\n]*已撤离/);
});

test('投降单位标注已投降', () => {
  const { battle, heroId } = setup();
  const yielded = surrender(battle, heroId);
  assert.equal(initiativeOrder(yielded).find(item => item.name === '英雄').note, '已投降');
});

test('当前行动者与备注同时出现', () => {
  const { battle, heroId } = setup();
  const fled = fleeBattle(battle, heroId);
  const row = initiativeOrder(fled).find(item => item.name === '英雄');
  assert.equal(row.current, true);
  assert.match(battleReport(fled), /← 当前行动者 · 已撤离/);
});
