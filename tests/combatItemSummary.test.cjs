const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, addItem, addUnidentifiedItem, identifyItem } = require('../apps/web/src/combat.ts');
const { settlementText, settleBattle } = require('../apps/web/src/combatSettlement.ts');
const { battleTranscript } = require('../apps/web/src/battleTransfer.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `it-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '物品摘要', side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const hero = { ...base.actors[0], id: 'hero', name: '艾拉' };
  return startCombat({ ...base, actors: [hero] }, { hero: 10 });
}

test('战报里的物品带出未鉴定标记', () => {
  let battle = addItem(setup(), 'hero', '治疗药水', 2, '2d4+2', ids());
  battle = addUnidentifiedItem(battle, 'hero', '神秘药水', 1, '2d4+2', ids());
  const text = battleTranscript(battle);
  assert.match(text, /治疗药水×2/);
  assert.match(text, /神秘药水×1（未鉴定）/);
});

test('结算摘要统计物品与未鉴定数量', () => {
  let battle = addItem(setup(), 'hero', '治疗药水', 2, '2d4+2', ids());
  battle = addUnidentifiedItem(battle, 'hero', '神秘药水', 1, '2d4+2', ids());
  const settlement = settleBattle(battle);
  assert.deepEqual(settlement.actors[0].items, { total: 2, unidentified: 1 });
  assert.match(settlementText(battle), /物品 2 种（1 未鉴定）/);
});

test('鉴定后结算文本不再标未鉴定', () => {
  let battle = addUnidentifiedItem(setup(), 'hero', '神秘药水', 1, '2d4+2', ids());
  battle = identifyItem(battle, 'hero', '神秘药水', ids());
  const settlement = settleBattle(battle);
  assert.equal(settlement.actors[0].items.unidentified, 0);
  assert.match(settlementText(battle), /物品 1 种$/m);
});

test('没有物品时不出现物品片段', () => {
  const battle = setup();
  assert.equal(settleBattle(battle).actors[0].items.total, 0);
  assert.doesNotMatch(settlementText(battle), /物品/);
  assert.doesNotMatch(battleTranscript(battle), /物品：/);
});
