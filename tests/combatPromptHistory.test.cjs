const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, configureGrid, moveActorToCell, pendingOpportunities, opportunityAttack,
  declineOpportunity, undoLastPrompt, resolveAllPrompts, clearPrompts, promptHistory,
} = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `prompt-history-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-prompt-history',
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
    notes: '',
    details: { equipment: '长剑' },
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '提示历史', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

test('结算借机攻击会记入历史', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const shot = opportunityAttack(moved, guardId, {}, { random: () => 0.9 });
  const [row] = promptHistory(shot.battle);
  assert.equal(row.kind, 'opportunity');
  assert.equal(row.outcome, 'resolved');
  assert.equal(row.reactorId, guardId);
  assert.equal(row.targetId, foeId);
});

test('放弃与撤回分别记入历史', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const declined = declineOpportunity(moved, moved.actors.find(actor => actor.side === '友方').id);
  assert.equal(promptHistory(declined).at(-1).outcome, 'declined');
  const undone = undoLastPrompt(moveActorToCell(battle, foeId, 4, 1));
  assert.equal(promptHistory(undone).at(-1).outcome, 'undone');
});

test('一键结算跳过时记录原因', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const guard = moved.actors.find(actor => actor.side === '友方');
  guard.combat.reactionUsed = true;
  const bulk = resolveAllPrompts(moved);
  const [row] = promptHistory(bulk.battle);
  assert.equal(row.outcome, 'skipped');
  assert.match(row.reason, /已经使用过反应/);
});

test('清空提示不会写历史', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const cleared = clearPrompts(moved);
  assert.equal(promptHistory(cleared).length, 0);
  assert.equal(pendingOpportunities(cleared).length, 0);
});

test('历史按顺序追加并带上轮次', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const first = opportunityAttack(moved, guardId, {}, { random: () => 0.9 });
  const declined = declineOpportunity(moveActorToCell(battle, foeId, 4, 1), guardId);
  const rows = promptHistory(declined);
  assert.equal(rows.length, 1);
  assert.equal(promptHistory(first.battle).length, 1);
  assert.equal(rows[0].round, declined.combat.round);
});
