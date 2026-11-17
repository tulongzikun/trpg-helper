const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, attack, toggleWallCell, hasLineOfSight } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `los-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-los', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '罗恩', species: '人类', characterClass: '游侠', level: 3,
    abilities: { str: 12, dex: 16, con: 12, int: 10, wis: 13, cha: 10 },
    maxHp: 28, armorClass: 14, speedFt: 30, actions: '长弓：+7 命中，1d8+3 穿刺伤害，远程 150 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '视线', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 12, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const archer = next.actors.find(actor => actor.side === '友方');
  const foe = next.actors.find(actor => actor.side === '敌方');
  archer.position = { x: 0, y: 0 };
  foe.position = { x: 4, y: 0 };
  return { battle: next, archer, foe };
}

const shot = { attackBonus: 7, damageExpression: '1d8+3', damageType: '穿刺', range: 'ranged' };

test('无遮挡时远程攻击正常结算', () => {
  const { battle, archer, foe } = setup();
  const result = attack(battle, { attackerId: archer.id, targetId: foe.id, ...shot }, { random: sequence(0.9, 0.5) });
  assert.equal(result.outcome.hit, true);
});

test('墙体挡住连线时远程攻击被拒绝', () => {
  const { battle, archer, foe } = setup();
  const walled = toggleWallCell(battle, 2, 0);
  assert.equal(hasLineOfSight(walled, archer.position, foe.position), false);
  assert.throws(
    () => attack(walled, { attackerId: archer.id, targetId: foe.id, ...shot }, { random: sequence(0.9, 0.5) }),
    /视线被墙体阻挡，无法进行远程攻击。/,
  );
});

test('近战攻击不受视线规则限制', () => {
  const { battle, archer, foe } = setup();
  const walled = toggleWallCell(battle, 2, 0);
  const adjacent = structuredClone(walled);
  adjacent.actors.find(item => item.id === archer.id).position = { x: 3, y: 0 };
  const result = attack(adjacent, { attackerId: archer.id, targetId: foe.id, attackBonus: 7, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee' }, { random: sequence(0.9, 0.5) });
  assert.equal(result.outcome.hit, true);
});

test('绕开墙体后远程攻击恢复', () => {
  const { battle, archer, foe } = setup();
  const walled = toggleWallCell(battle, 2, 0);
  const moved = structuredClone(walled);
  moved.actors.find(item => item.id === archer.id).position = { x: 0, y: 3 };
  moved.actors.find(item => item.id === foe.id).position = { x: 4, y: 3 };
  const result = attack(moved, { attackerId: archer.id, targetId: foe.id, ...shot }, { random: sequence(0.9, 0.5) });
  assert.equal(result.outcome.hit, true);
});

test('多道墙体叠加后依旧阻断，拆掉即恢复', () => {
  const { battle, archer, foe } = setup();
  let next = toggleWallCell(battle, 2, 0);
  next = toggleWallCell(next, 3, 0);
  assert.throws(() => attack(next, { attackerId: archer.id, targetId: foe.id, ...shot }, { random: sequence(0.9, 0.5) }), /视线被墙体阻挡/);
  const cleared = toggleWallCell(next, 2, 0);
  const cleared2 = toggleWallCell(cleared, 3, 0);
  const result = attack(cleared2, { attackerId: archer.id, targetId: foe.id, ...shot }, { random: sequence(0.9, 0.5) });
  assert.equal(result.outcome.hit, true);
});

test('没有方格战场时不检查视线', () => {
  const { battle, archer, foe } = setup();
  const freeform = structuredClone(battle);
  delete freeform.grid;
  freeform.actors.find(item => item.id === archer.id).position = undefined;
  freeform.actors.find(item => item.id === foe.id).position = undefined;
  const result = attack(freeform, { attackerId: archer.id, targetId: foe.id, ...shot }, { random: sequence(0.9, 0.5) });
  assert.equal(result.outcome.hit, true);
});
