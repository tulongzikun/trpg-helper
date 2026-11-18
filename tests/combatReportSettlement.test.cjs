const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid } = require('../apps/web/src/combat.ts');
const { battleReport } = require('../apps/web/src/combatReport.ts');
const { settlementText } = require('../apps/web/src/combatSettlement.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `rsettle-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-settle',
  revision: 1,
  publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '队长',
    species: '人类',
    characterClass: '战士',
    level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40,
    armorClass: 16,
    speedFt: 30,
    actions: '',
    notes: '',
    details: { equipment: '长剑' },
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '结算战报', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 10, height: 10, cellFt: 5 });
  battle = startCombat(battle, Object.fromEntries(battle.actors.map((actor, index) => [actor.id, 20 - index])));
  return battle;
}

test('战报包含结算小节', () => {
  const battle = setup();
  assert.match(battleReport(battle), /^## 结算$/m);
});

test('结算小节内容与 settlementText 一致', () => {
  const battle = setup();
  const report = battleReport(battle);
  const text = settlementText(battle).trimEnd();
  assert.ok(report.includes(text));
});

test('结算小节位于统计之后、战报之前', () => {
  const battle = setup();
  const report = battleReport(battle);
  const stats = report.indexOf('## 统计');
  const settlement = report.indexOf('## 结算');
  const log = report.indexOf('## 战报');
  assert.ok(stats >= 0 && settlement > stats && log > settlement);
});

test('结算小节写明经验与单位生命', () => {
  const battle = setup();
  const report = battleReport(battle);
  const hero = battle.actors.find(actor => actor.side === '友方');
  assert.match(report, /点经验/);
  assert.ok(report.includes(`- 队长（友方） · ${hero.currentHp}/${hero.maxHp} HP`));
});
