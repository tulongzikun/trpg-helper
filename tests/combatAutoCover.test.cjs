const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, coverFromWalls, moveActorToCell, startCombat, toggleWallCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };
const character = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: { name: '艾拉', species: '人类', characterClass: '游侠', level: 5, abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }, maxHp: 40, armorClass: 16, speedFt: 30, actions: '短弓：+7 命中，1d8+3 穿刺伤害，射程 80/320 尺', notes: '' },
};

function setup(walls = []) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '掩体测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, character, { battleId: battle.id, side: '友方' }, ids()).store.battles[0];
  const archer = added.actors.find(actor => actor.side === '友方');
  const monster = added.actors.find(actor => actor.side !== '友方');
  let grid = startCombat(added, { [archer.id]: 20, [monster.id]: 10 });
  grid = configureGrid(grid, { width: 10, height: 10, cellFt: 5 });
  grid = moveActorToCell(grid, archer.id, 0, 0);
  grid = moveActorToCell(grid, monster.id, 5, 0);
  for (const [x, y] of walls) grid = toggleWallCell(grid, x, y);
  return { grid, archer, monster };
}

const attackAt = (battle, archer, monster, extra = {}) => attack(battle, {
  attackerId: archer.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '穿刺', range: 'ranged', ...extra,
}, { makeId: ids(), random: sequence(0.5, 0.5) });

test('没有墙体时自动判定为无掩体', () => {
  const { grid, archer, monster } = setup();
  assert.equal(coverFromWalls(grid, { x: 0, y: 0 }, { x: 5, y: 0 }), '无');
  const { battle, outcome } = attackAt(grid, archer, monster, { autoCover: true });
  assert.equal(outcome.targetAc, monster.template.armorClass);
  assert.equal(/掩体/.test(battle.combat.log.at(-1).detail), false);
});

test('射击线旁有一道墙时自动判定为半掩体并提高 AC', () => {
  const { grid, archer, monster } = setup([[2, 1]]);
  assert.equal(coverFromWalls(grid, { x: 0, y: 0 }, { x: 5, y: 0 }), '半掩体');
  const { battle, outcome } = attackAt(grid, archer, monster, { autoCover: true });
  assert.equal(outcome.targetAc, monster.template.armorClass + 2);
  assert.match(battle.combat.log.at(-1).detail, /半掩体（AC \+2）/);
});

test('被两道墙夹住的射击线自动判定为四分之三掩体', () => {
  const { grid, archer, monster } = setup([[2, 1], [3, 1]]);
  assert.equal(coverFromWalls(grid, { x: 0, y: 0 }, { x: 5, y: 0 }), '四分之三掩体');
  const { outcome } = attackAt(grid, archer, monster, { autoCover: true });
  assert.equal(outcome.targetAc, monster.template.armorClass + 5);
});

test('显式掩体覆盖自动判定，关闭开关后回到无掩体', () => {
  const { grid, archer, monster } = setup([[2, 1], [3, 1]]);
  const explicit = attackAt(grid, archer, monster, { autoCover: true, cover: '无' });
  assert.equal(explicit.outcome.targetAc, monster.template.armorClass);
  const manual = attackAt(grid, archer, monster, { cover: '半掩体' });
  assert.equal(manual.outcome.targetAc, monster.template.armorClass + 2);
  const off = attackAt(grid, archer, monster, { autoCover: false });
  assert.equal(off.outcome.targetAc, monster.template.armorClass);
});


