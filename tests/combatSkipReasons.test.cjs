const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, configureGrid, moveActorToCell, resolveAllPrompts, promptSkipReasons,
} = require('../apps/web/src/combat.ts');
const { battleReport, promptSkipText } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `skip-reason-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-skip-reason',
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
  let store = addMonsters(emptyStore(), card, { newBattleName: '跳过原因', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

// 一场战斗里只够「离开触及」一次，所以每条用例各起一场，再把历史拼起来观察归类。
function skippedBattle(kind) {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const guard = moved.actors.find(actor => actor.id === guardId);
  if (kind === 'reaction') guard.combat.reactionUsed = true;
  if (kind === 'blind') guard.combat.conditions.push('目盲');
  return { battle: resolveAllPrompts(moved).battle, guardId, foeId };
}

function mergeHistory(battles) {
  const merged = structuredClone(battles[0]);
  merged.combat.promptHistory = battles.flatMap(item => item.combat.promptHistory ?? []);
  return merged;
}

test('没有跳过时返回空数组与空文案', () => {
  const { battle } = setup();
  assert.deepEqual(promptSkipReasons(battle), []);
  assert.equal(promptSkipText(battle), '');
});

test('同一条原因会被归类计数', () => {
  const merged = mergeHistory([skippedBattle('reaction').battle, skippedBattle('reaction').battle]);
  const rows = promptSkipReasons(merged);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 2);
  assert.match(rows[0].reason, /已经使用过反应/);
});

test('不同原因分别成行并按次数降序', () => {
  const merged = mergeHistory([
    skippedBattle('reaction').battle,
    skippedBattle('reaction').battle,
    skippedBattle('blind').battle,
  ]);
  const rows = promptSkipReasons(merged);
  assert.equal(rows.length, 2);
  assert.match(rows[0].reason, /已经使用过反应/);
  assert.equal(rows[0].count, 2);
  assert.match(rows[1].reason, /看不见/);
});

test('战报带跳过原因汇总', () => {
  const skipped = skippedBattle('reaction').battle;
  const report = battleReport(skipped);
  assert.match(report, /- 跳过原因：.+已经使用过反应.+1 条/);
  assert.match(promptSkipText(skipped), /跳过原因：/);
});
