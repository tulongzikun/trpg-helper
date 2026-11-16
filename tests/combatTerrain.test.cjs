const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { configureGrid, difficultCells, isDifficultCell, moveActorToCell, startCombat, toggleDifficultCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;

function setup(count = 2) {
  const battle = addMonsters(emptyStore(), card, { newBattleName: '地形测试', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const [first, second] = battle.actors.map(actor => actor.id);
  const started = startCombat(battle, { [first]: 20, [second]: 10 });
  const grid = configureGrid(started, { width: 8, height: 6, cellFt: 5 });
  return { grid, first, second };
}

test('可以标记与取消困难地形', () => {
  const { grid } = setup();
  const marked = toggleDifficultCell(grid, 2, 3);
  assert.deepEqual(difficultCells(marked), [{ x: 2, y: 3 }]);
  assert.equal(isDifficultCell(marked, 2, 3), true);
  assert.match(marked.combat.log.at(-1).text, /\(2, 3\) 标为困难地形/);
  const unmarked = toggleDifficultCell(marked, 2, 3);
  assert.deepEqual(difficultCells(unmarked), []);
  assert.equal(isDifficultCell(unmarked, 2, 3), false);
  assert.match(unmarked.combat.log.at(-1).text, /取消 \(2, 3\) 的困难地形/);
});

test('困难地形需要先启用方格且坐标合法', () => {
  const { grid } = setup();
  const noGrid = configureGrid(grid, null);
  assert.throws(() => toggleDifficultCell(noGrid, 0, 0), /请先启用方格战场。/);
  assert.throws(() => toggleDifficultCell(grid, 1.5, 0), /格子坐标须为整数。/);
  assert.throws(() => toggleDifficultCell(grid, 8, 0), /目标格子超出战场范围。/);
  assert.throws(() => toggleDifficultCell(grid, 0, 6), /目标格子超出战场范围。/);
});

test('进入困难地形时移动消耗翻倍', () => {
  const { grid, first } = setup();
  const marked = toggleDifficultCell(grid, 1, 0);
  const placed = moveActorToCell(marked, first, 0, 0);
  const moved = moveActorToCell(placed, first, 1, 0);
  const actor = moved.actors.find(item => item.id === first);
  assert.equal(actor.combat.movementUsed, 10);
  assert.match(moved.combat.log.at(-1).text, /困难地形使消耗翻倍/);
});

test('普通地形保持每格 5 尺消耗', () => {
  const { grid, first } = setup();
  const placed = moveActorToCell(grid, first, 0, 0);
  const moved = moveActorToCell(placed, first, 2, 0);
  assert.equal(moved.actors.find(item => item.id === first).combat.movementUsed, 10);
});

test('关闭方格或缩小方格会清理困难地形', () => {
  const { grid } = setup();
  let marked = toggleDifficultCell(grid, 7, 5);
  marked = toggleDifficultCell(marked, 1, 1);
  const shrunk = configureGrid(marked, { width: 4, height: 4, cellFt: 5 });
  assert.deepEqual(difficultCells(shrunk), [{ x: 1, y: 1 }]);
  const closed = configureGrid(shrunk, null);
  assert.deepEqual(difficultCells(closed), []);
});
