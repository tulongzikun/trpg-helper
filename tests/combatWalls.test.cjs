const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, hasLineOfSight, isWallCell, moveActorToCell, startCombat, toggleWallCell, wallCells } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.9; };

function setup(count = 2) {
  const battle = addMonsters(emptyStore(), card, { newBattleName: '墙体测试', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const [first, second] = battle.actors.map(actor => actor.id);
  const started = startCombat(battle, { [first]: 20, [second]: 10 });
  const grid = configureGrid(started, { width: 8, height: 6, cellFt: 5 });
  return { grid, first, second };
}

test('可以设置与拆除墙体', () => {
  const { grid } = setup();
  const marked = toggleWallCell(grid, 3, 2);
  assert.deepEqual(wallCells(marked), [{ x: 3, y: 2 }]);
  assert.equal(isWallCell(marked, 3, 2), true);
  assert.match(marked.combat.log.at(-1).text, /\(3, 2\) 设为墙体/);
  const removed = toggleWallCell(marked, 3, 2);
  assert.deepEqual(wallCells(removed), []);
  assert.match(removed.combat.log.at(-1).text, /拆除 \(3, 2\) 的墙体/);
});

test('墙体不能压在单位上，且需要先启用方格', () => {
  const { grid, first } = setup();
  const placed = moveActorToCell(grid, first, 2, 2);
  assert.throws(() => toggleWallCell(placed, 2, 2), /该格已有单位：雾影兽，无法设为墙体。/);
  const noGrid = configureGrid(grid, null);
  assert.throws(() => toggleWallCell(noGrid, 0, 0), /请先启用方格战场。/);
  assert.throws(() => toggleWallCell(grid, 1.5, 0), /格子坐标须为整数。/);
  assert.throws(() => toggleWallCell(grid, 8, 0), /目标格子超出战场范围。/);
});

test('单位不能移动到墙体格子', () => {
  const { grid, first } = setup();
  const withWall = toggleWallCell(grid, 1, 1);
  assert.throws(() => moveActorToCell(withWall, first, 1, 1), /不能移动到墙体格子。/);
});

test('移动路径穿过墙体时被拒绝', () => {
  const { grid, first } = setup();
  let battle = toggleWallCell(grid, 1, 0);
  battle = moveActorToCell(battle, first, 0, 0);
  assert.throws(() => moveActorToCell(battle, first, 2, 0), /移动路径被墙体阻挡。/);
  const around = moveActorToCell(battle, first, 0, 2);
  assert.deepEqual(around.actors.find(item => item.id === first).position, { x: 0, y: 2 });
});

test('视线被墙体阻挡时无法远程攻击', () => {
  const { grid, first } = setup();
  let battle = toggleWallCell(grid, 1, 0);
  battle = moveActorToCell(battle, first, 0, 0);
  battle = moveActorToCell(battle, battle.actors[1].id, 3, 0);
  const options = { attackerId: first, targetId: battle.actors[1].id, attackBonus: 5, damageExpression: '1d6+3', damageType: '穿刺', range: 'ranged' };
  assert.throws(() => attack(battle, options, { random: sequence(0.9, 0.5), makeId: ids() }), /视线被墙体阻挡，无法进行远程攻击。/);
  const clear = toggleWallCell(battle, 1, 0);
  const shot = attack(clear, options, { random: sequence(0.9, 0.5), makeId: ids() });
  assert.equal(shot.outcome.hit, true);
});

test('近战不受墙体视线影响，关闭与缩小方格会清理墙体', () => {
  const { grid, first } = setup();
  let battle = toggleWallCell(grid, 1, 0);
  battle = toggleWallCell(battle, 7, 5);
  battle = moveActorToCell(battle, first, 0, 0);
  battle = moveActorToCell(battle, battle.actors[1].id, 0, 1);
  const melee = attack(battle, { attackerId: first, targetId: battle.actors[1].id, attackBonus: 5, damageExpression: '1d6+3', damageType: '挥砍', range: 'melee' }, { random: sequence(0.9, 0.5), makeId: ids() });
  assert.equal(melee.outcome.hit, true);
  assert.equal(hasLineOfSight(battle, { x: 0, y: 0 }, { x: 0, y: 1 }), true);
  const shrunk = configureGrid(battle, { width: 4, height: 4, cellFt: 5 });
  assert.deepEqual(wallCells(shrunk), [{ x: 1, y: 0 }]);
  const closed = configureGrid(shrunk, null);
  assert.deepEqual(wallCells(closed), []);
});
