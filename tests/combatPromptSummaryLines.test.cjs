const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, configureGrid, moveActorToCell, opportunityAttack, declineOpportunity, resolveAllPrompts,
} = require('../apps/web/src/combat.ts');
const { promptSummaryLines } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `summary-lines-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-summary-lines',
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
  let store = addMonsters(emptyStore(), card, { newBattleName: '摘要行', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

test('没有历史时不产出任何行', () => {
  const { battle } = setup();
  assert.deepEqual(promptSummaryLines(battle), []);
});

test('结算后只有汇总与按人两行', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const shot = opportunityAttack(moved, guardId, {}, { random: () => 0.9 });
  const lines = promptSummaryLines(shot.battle);
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^共 1 条（借机攻击 1、准备动作 0）；已结算 1$/);
  assert.equal(lines[1], '守卫：结算 1');
});

test('有跳过时插进原因那一行', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const guard = moved.actors.find(actor => actor.id === guardId);
  guard.combat.reactionUsed = true;
  const bulk = resolveAllPrompts(moved).battle;
  const lines = promptSummaryLines(bulk);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /被跳过 1/);
  assert.match(lines[1], /^跳过原因：/);
  assert.equal(lines[2], '守卫：跳过 1');
});

test('放弃也会出现在按人那一行', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const declined = declineOpportunity(moved, guardId);
  const lines = promptSummaryLines(declined);
  assert.deepEqual(lines.at(-1), '守卫：放弃 1');
});
