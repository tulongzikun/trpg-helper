const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, reachCells, actorReach } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `reachcells-${++counter}`;

const hero = equipment => ({
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-reach-cells',
  revision: 1,
  publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '哨兵',
    species: '人类',
    characterClass: '战士',
    level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40,
    armorClass: 16,
    speedFt: 30,
    actions: '',
    notes: '',
    details: { equipment },
  },
});

function setup(equipment, cell) {
  let store = addMonsters(emptyStore(), card, { newBattleName: '触及格', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero(equipment), { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 10, height: 10, cellFt: 5 });
  battle = startCombat(battle, Object.fromEntries(battle.actors.map((actor, index) => [actor.id, 20 - index])));
  const guard = battle.actors.find(actor => actor.side === '友方');
  battle.actors.find(actor => actor.id === guard.id).position = cell;
  return { battle, guardId: guard.id };
}

test('5 尺武器覆盖相邻八格', () => {
  const { battle, guardId } = setup('长剑', { x: 4, y: 4 });
  const cells = reachCells(battle, guardId);
  assert.equal(actorReach(battle.actors.find(actor => actor.id === guardId)), 5);
  assert.equal(cells.length, 9);
  assert.ok(cells.some(cell => cell.x === 3 && cell.y === 3));
  assert.equal(cells.some(cell => cell.x === 2 && cell.y === 4), false);
});

test('长武器覆盖 10 尺半径（25 格）', () => {
  const { battle, guardId } = setup('戟', { x: 5, y: 5 });
  const cells = reachCells(battle, guardId);
  assert.equal(actorReach(battle.actors.find(actor => actor.id === guardId)), 10);
  assert.equal(cells.length, 25);
  assert.ok(cells.some(cell => cell.x === 5 && cell.y === 7));
  assert.equal(cells.some(cell => cell.x === 5 && cell.y === 8), false);
});

test('触及范围在棋盘边缘被裁剪', () => {
  const { battle, guardId } = setup('戟', { x: 0, y: 0 });
  const cells = reachCells(battle, guardId);
  assert.ok(cells.every(cell => cell.x >= 0 && cell.y >= 0));
  assert.equal(cells.length, 9);
});

test('没有方格或没有位置时返回空数组', () => {
  const { battle, guardId } = setup('长剑', { x: 1, y: 1 });
  assert.deepEqual(reachCells({ ...battle, grid: undefined }, guardId), []);
  const noPosition = structuredClone(battle);
  delete noPosition.actors.find(actor => actor.id === guardId).position;
  assert.deepEqual(reachCells(noPosition, guardId), []);
});
