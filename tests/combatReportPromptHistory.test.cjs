const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, configureGrid, moveActorToCell, opportunityAttack, declineOpportunity,
  promptStatistics,
} = require('../apps/web/src/combat.ts');
const { battleReport, promptStatsText, promptHistoryLines } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `report-prompt-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-report-prompt',
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
  let store = addMonsters(emptyStore(), card, { newBattleName: '提示战报', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

test('没有历史时战报不出现反应提示小节', () => {
  const { battle } = setup();
  assert.doesNotMatch(battleReport(battle), /## 反应提示/);
  assert.equal(promptStatsText(battle), '还没有处理过反应提示。');
});

test('统计按结果分类', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const shot = opportunityAttack(moved, guardId, {}, { random: () => 0.9 });
  const stats = promptStatistics(shot.battle);
  assert.equal(stats.total, 1);
  assert.equal(stats.resolved, 1);
  assert.equal(stats.opportunity, 1);
  assert.equal(stats.ready, 0);
});

test('战报小节带汇总与逐条明细', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const shot = opportunityAttack(moved, guardId, {}, { random: () => 0.9 });
  const report = battleReport(shot.battle);
  assert.match(report, /## 反应提示/);
  assert.match(report, /共 1 条（借机攻击 1、准备动作 0）/);
  assert.match(report, /守卫 借机攻击 → .+：已结算/);
});

test('放弃的提示计入统计并写进明细', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const declined = declineOpportunity(moved, guardId);
  const lines = promptHistoryLines(declined);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /已放弃/);
  const report = battleReport(declined);
  assert.match(report, /已放弃 1/);
});

test('小节在结算之后、战报之前', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const shot = opportunityAttack(moved, guardId, {}, { random: () => 0.9 });
  const report = battleReport(shot.battle);
  const settlement = report.indexOf('## 结算');
  const prompts = report.indexOf('## 反应提示');
  const log = report.indexOf('## 战报');
  assert.ok(settlement >= 0 && prompts > settlement && log > prompts);
});
