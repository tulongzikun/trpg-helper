const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat } = require('../apps/web/src/combat.ts');
const { battleCsv } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `csv-effects-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '状态导出', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const foe = battle.actors[0];
  foe.position = { x: 0, y: 0 };
  battle = structuredClone(startCombat(battle, { [foe.id]: 20 }));
  return { battle, foeId: foe.id };
}

function lines(csv) {
  return csv.replace(/^\uFEFF/, '').split('\r\n').filter(Boolean).map(line => line.split(','));
}

test('CSV 表头最后一列是状态效果', () => {
  const { battle } = setup();
  const header = lines(battleCsv(battle))[0];
  assert.equal(header.at(-1), '状态效果');
  assert.equal(header.length, 13);
});

test('有状态的单位在状态效果列里带轮数', () => {
  const { battle, foeId } = setup();
  const cloned = structuredClone(battle);
  const foe = cloned.actors.find(actor => actor.id === foeId);
  foe.combat.blessed = 10;
  foe.combat.entangled = true;
  const row = lines(battleCsv(cloned)).find(cells => cells[0] === foe.name);
  assert.equal(row.at(-1), '被藤蔓缠住；祝福（10 轮）');
});

test('没有状态的单位该列留空', () => {
  const { battle } = setup();
  const row = lines(battleCsv(battle)).find(cells => cells[0] === battle.actors[0].name);
  assert.equal(row.at(-1), '');
});

test('合计行的状态效果列留空', () => {
  const { battle } = setup();
  const totals = lines(battleCsv(battle)).at(-1);
  assert.equal(totals[0], '合计');
  assert.equal(totals.at(-1), '');
  assert.equal(totals.length, 13);
});
