const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { actorDistance, actorSpeed, attack, cellDistance, configureGrid, currentActorId, moveActorToCell, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.9; };

function setup(count = 2) {
  const battle = addMonsters(emptyStore(), card, { newBattleName: '方格测试', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const [first, second] = battle.actors.map(actor => actor.id);
  const started = startCombat(battle, { [first]: 20, [second]: 10 });
  return { started, first, second };
}

test('方格距离按斜向一格计算', () => {
  assert.equal(cellDistance({ x: 0, y: 0 }, { x: 2, y: 1 }), 2);
  assert.equal(cellDistance({ x: 3, y: 3 }, { x: 3, y: 3 }), 0);
});

test('可以启用方格战场并记录日志', () => {
  const { started } = setup();
  const battle = configureGrid(started, { width: 8, height: 6, cellFt: 5 });
  assert.deepEqual(battle.grid, { width: 8, height: 6, cellFt: 5 });
  assert.match(battle.combat.log.at(-1).text, /方格战场设为 8×6，每格 5 尺/);
  assert.throws(() => configureGrid(started, { width: 0, height: 6, cellFt: 5 }), /方格宽度须为 1 至 60 的整数。/);
  assert.throws(() => configureGrid(started, { width: 8, height: 61, cellFt: 5 }), /方格高度须为 1 至 60 的整数。/);
  assert.throws(() => configureGrid(started, { width: 8, height: 6, cellFt: 40 }), /每格尺数须为 5 至 30 的整数。/);
});

test('缩小方格会清掉超出范围的单位位置', () => {
  const { started, first, second } = setup();
  let battle = configureGrid(started, { width: 10, height: 10, cellFt: 5 });
  battle = moveActorToCell(battle, first, 0, 0);
  battle = moveActorToCell(battle, second, 9, 9);
  const shrunk = configureGrid(battle, { width: 4, height: 4, cellFt: 5 });
  const second2 = shrunk.actors.find(actor => actor.id === second);
  assert.equal(shrunk.actors.find(actor => actor.id === first).position.x, 0);
  assert.equal(second2.position, undefined);
});

test('未放置的单位可以放到空岛，占用格与越界会被拒绝', () => {
  const { started, first, second } = setup();
  let battle = configureGrid(started, { width: 6, height: 6, cellFt: 5 });
  battle = moveActorToCell(battle, first, 1, 1);
  assert.match(battle.combat.log.at(-1).text, /放置在 \(1, 1\)/);
  battle = moveActorToCell(battle, second, 2, 2);
  assert.throws(() => moveActorToCell(battle, second, 1, 1), /该格已有单位：/);
  assert.throws(() => moveActorToCell(battle, second, 6, 2), /目标格子超出战场范围。/);
  assert.throws(() => moveActorToCell(battle, second, 2.5, 2), /格子坐标须为整数。/);
});

test('没有方格时不能放置单位', () => {
  const { started, first } = setup();
  assert.throws(() => moveActorToCell(started, first, 0, 0), /请先启用方格战场。/);
});

test('移动按格数扣减移动力，超出速度会被拒绝', () => {
  const { started, first } = setup();
  const speed = actorSpeed(started.actors.find(actor => actor.id === first));
  let battle = configureGrid(started, { width: 60, height: 2, cellFt: 5 });
  battle = moveActorToCell(battle, first, 0, 0);
  const moved = moveActorToCell(battle, first, 2, 0);
  assert.equal(moved.actors.find(actor => actor.id === first).position.x, 2);
  assert.equal(moved.actors.find(actor => actor.id === first).combat.movementUsed, 10);
  if (speed <= 10) return;
  const far = Math.ceil((speed + 5) / 5);
  assert.throws(() => moveActorToCell(battle, first, far, 0), /移动距离超出速度上限/);
});

test('近战攻击超出触及范围会被拒绝，方格距离进入日志', () => {
  const { started, first, second } = setup();
  let battle = configureGrid(started, { width: 10, height: 10, cellFt: 5 });
  battle = moveActorToCell(battle, first, 0, 0);
  battle = moveActorToCell(battle, second, 2, 0);
  assert.equal(actorDistance(battle, first, second), 10);
  assert.throws(() => attack(battle, { attackerId: first, targetId: second, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍', range: 'melee' }, { random: sequence() }), /超出近战触及范围/);
  const hit = attack(battle, { attackerId: first, targetId: second, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍', range: 'melee', reachFt: 10 }, { random: sequence(), makeId: ids() }).battle;
  assert.match(hit.combat.log.at(-1).detail, /方格距离 10 尺/);
});

test('远程攻击在方格距离内可用，关闭方格会清除位置', () => {
  const { started, first, second } = setup();
  let battle = configureGrid(started, { width: 30, height: 2, cellFt: 5 });
  battle = moveActorToCell(battle, first, 0, 0);
  battle = moveActorToCell(battle, second, 12, 0);
  assert.equal(actorDistance(battle, first, second), 60);
  const shot = attack(battle, { attackerId: currentActorId(battle), targetId: currentActorId(battle) === first ? second : first, attackBonus: 5, damageExpression: '1d6', damageType: '穿刺', range: 'ranged' }, { random: sequence() });
  assert.equal(shot.outcome.mode, 'normal');
  const closed = configureGrid(battle, null);
  assert.equal(closed.grid, undefined);
  assert.equal(closed.actors.every(actor => actor.position === undefined), true);
  assert.match(closed.combat.log.at(-1).text, /关闭方格战场/);
});
