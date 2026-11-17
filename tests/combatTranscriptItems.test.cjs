const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, addItem, saveAttackPreset } = require('../apps/web/src/combat.ts');
const { battleTranscript } = require('../apps/web/src/battleTransfer.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `tr-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '战报', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const foe = { ...base.actors[0], id: 'foe', name: '雾影兽', currentHp: 40, maxHp: 40 };
  const hero = { ...foe, id: 'hero', name: '艾拉', side: '友方' };
  return startCombat({ ...base, actors: [hero, foe] }, { hero: 20, foe: 10 });
}

test('战报列出单位身上的物品', () => {
  let battle = setup();
  battle = addItem(battle, 'hero', '治疗药水', 2, '2d4+2', ids());
  const text = battleTranscript(battle);
  assert.match(text, /物品：治疗药水×2/);
});

test('没有物品时不输出物品字段', () => {
  const text = battleTranscript(setup());
  assert.ok(!text.includes('物品：'));
});

test('战报列出常用攻击及其来源与目标', () => {
  let battle = setup();
  battle = saveAttackPreset(battle, { name: '巨剑猛砍', attackerId: 'hero', targetId: 'foe', attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee' }, ids()).battle;
  const text = battleTranscript(battle);
  assert.match(text, /## 常用攻击/);
  assert.match(text, /「巨剑猛砍」：艾拉 → 雾影兽，\+5，1d8\+3 挥砍，近战/);
});

test('没有常用攻击时不输出该段', () => {
  const text = battleTranscript(setup());
  assert.ok(!text.includes('## 常用攻击'));
});
