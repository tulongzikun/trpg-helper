const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, configureGrid, moveActorToCell, opportunityAttack, declineOpportunity, resolveAllPrompts,
} = require('../apps/web/src/combat.ts');
const { battleCsv } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `csv-prompt-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-csv-prompt',
  revision: 1,
  publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '守卫',
    species: '人类',
    characterClass: '战士',
    level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40,
    armorClass: 16,
    speedFt: 30,
    actions: '',
    details: { equipment: '长剑' },
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '提示列', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 14, height: 8, cellFt: 5 });
  const guard = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = structuredClone(startCombat(battle, { [guard.id]: 10, [foe.id]: 20 }));
  battle.actors.find(actor => actor.id === guard.id).position = { x: 1, y: 1 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: 2, y: 1 };
  return { battle, guardId: guard.id, foeId: foe.id };
}

function rows(csv) {
  return csv.replace(/^\uFEFF/, '').split('\r\n').filter(Boolean).map(line => line.split(','));
}

test('表头最后一列是反应提示', () => {
  const { battle } = setup();
  const header = rows(battleCsv(battle))[0];
  assert.equal(header.at(-1), '反应提示');
  assert.equal(header.length, 15);
});

test('结算过的单位写结算数', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const shot = opportunityAttack(moved, guardId, {}, { random: () => 0.9 });
  const row = rows(battleCsv(shot.battle)).find(cells => cells[0] === '守卫');
  assert.equal(row.at(-1), '1/0/0');
});

test('跳过与放弃分别计入后两段', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const declined = declineOpportunity(moved, guardId);
  const withSkip = structuredClone(declined);
  withSkip.combat.promptHistory.push({
    kind: 'opportunity', reactorId: guardId, targetId: foeId,
    outcome: 'skipped', reason: '该单位本回合已经使用过反应。', round: 1,
  });
  const row = rows(battleCsv(withSkip)).find(cells => cells[0] === '守卫');
  assert.equal(row.at(-1), '0/1/1');
});

test('没有提示的单位留空，合计行也留空', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const resolved = resolveAllPrompts(moved).battle;
  const table = rows(battleCsv(resolved));
  const foeRow = table.slice(1).find(cells => cells[0] !== '守卫' && cells[0] !== '合计');
  assert.equal(foeRow.at(-1), '');
  assert.equal(table.at(-1).at(-1), '');
});
