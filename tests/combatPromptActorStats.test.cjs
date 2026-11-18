const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, configureGrid, moveActorToCell, opportunityAttack, declineOpportunity,
  resolveAllPrompts, promptActorStats,
} = require('../apps/web/src/combat.ts');
const { battleReport, promptActorLines } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `actor-stats-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-actor-stats',
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
  let store = addMonsters(emptyStore(), card, { newBattleName: '按人统计', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

test('没有历史时返回空数组', () => {
  const { battle } = setup();
  assert.deepEqual(promptActorStats(battle), []);
  assert.deepEqual(promptActorLines(battle), []);
});

test('按反应方归并结算次数', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const shot = opportunityAttack(moved, guardId, {}, { random: () => 0.9 });
  const rows = promptActorStats(shot.battle);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actorId, guardId);
  assert.equal(rows[0].resolved, 1);
  assert.equal(rows[0].total, 1);
  assert.equal(rows[0].name, '守卫');
});

test('同一反应方结算与跳过分别计数', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const shot = opportunityAttack(moved, guardId, {}, { random: () => 0.9 });
  const withHistory = structuredClone(shot.battle);
  withHistory.combat.promptHistory.push({
    kind: 'opportunity', reactorId: guardId, targetId: foeId,
    outcome: 'skipped', reason: '该单位本回合已经使用过反应。', round: withHistory.combat.round,
  });
  const [row] = promptActorStats(withHistory);
  assert.equal(row.resolved, 1);
  assert.equal(row.skipped, 1);
  assert.equal(row.total, 2);
  assert.equal(promptActorLines(withHistory)[0], '守卫：结算 1、跳过 1');
});

test('行按处理总数降序', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const declined = declineOpportunity(moved, guardId);
  const both = structuredClone(declined);
  both.combat.promptHistory.push(
    { kind: 'opportunity', reactorId: guardId, targetId: foeId, outcome: 'resolved', round: 1 },
    { kind: 'opportunity', reactorId: foeId, targetId: guardId, outcome: 'resolved', round: 1 },
  );
  const rows = promptActorStats(both);
  assert.equal(rows[0].actorId, guardId);
  assert.equal(rows[0].total, 2);
  assert.equal(rows[1].total, 1);
});

test('战报按人列出并放在逐条明细之前', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const shot = opportunityAttack(moved, guardId, {}, { random: () => 0.9 });
  const report = battleReport(shot.battle);
  const summary = report.indexOf('- 共 ');
  const perActor = report.indexOf('- 守卫：结算 1');
  const detail = report.indexOf('- 第 1 轮 · 守卫 借机攻击');
  assert.ok(summary >= 0 && perActor > summary && detail > perActor);
});
