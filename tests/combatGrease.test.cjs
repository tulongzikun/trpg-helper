const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { castGrease, configureGrid, endTurn, greaseAt, moveActorToCell, setFlying, startCombat, tickTurnStart } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `grease-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-grease', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '法师', level: 5,
    abilities: { str: 10, dex: 12, con: 12, int: 16, wis: 12, cha: 10 },
    maxHp: 30, armorClass: 14, speedFt: 30, actions: '短杖：+3 命中，1d6+1 钝击伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '油污', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  let next = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids()).store;
  next = addCharacter(next, { ...hero, characterId: 'char-grease-ally', sheet: { ...hero.sheet, name: '布兰' } }, { battleId: battle.id, side: '友方' }, ids()).store;
  const current = configureGrid(next.battles[0], { width: 10, height: 10, cellFt: 5 });
  const initiatives = {};
  current.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 - index : 10 - index; });
  let started = startCombat(current, initiatives);
  const friends = started.actors.filter(actor => actor.side === '友方');
  const enemy = started.actors.find(actor => actor.side === '敌方');
  started = moveActorToCell(started, friends[0].id, 1, 1);
  started = moveActorToCell(started, friends[1].id, 1, 3);
  started = moveActorToCell(started, enemy.id, 6, 6);
  return { battle: started, caster: friends[0], ally: friends[1] };
}

function turnTo(battle, actorId) {
  let current = battle;
  for (let guard = 0; guard < 20; guard++) {
    const combat = current.combat;
    if (!combat) break;
    if (combat.order[combat.turnIndex] === actorId) return current;
    current = endTurn(current);
  }
  throw new Error('没有轮到 ' + actorId);
}

test('油腻术消耗动作并记录覆盖的格子', () => {
  const { battle, caster } = setup();
  const next = castGrease(battle, caster.id, [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 2, y: 1 }]);
  assert.equal(next.grease.length, 2);
  assert.equal(greaseAt(next, 2, 1), true);
  assert.equal(greaseAt(next, 5, 5), false);
  assert.equal(next.actors.find(item => item.id === caster.id).combat.actionUsed, true);
  assert.ok(next.combat.log.some(line => line.text.includes('施放油腻术')));
});

test('进入油污格豁免失败会倒地', () => {
  const { battle, caster, ally } = setup();
  const greased = castGrease(battle, caster.id, [{ x: 2, y: 3 }]);
  const turn = turnTo(greased, ally.id);
  const moved = moveActorToCell(turn, ally.id, 2, 3, { random: sequence(0) });
  assert.ok(moved.actors.find(item => item.id === ally.id).combat.conditions.includes('倒地'));
  assert.ok(moved.combat.log.some(line => line.text.includes('在油污上滑倒')));
});

test('进入油污格豁免成功不会倒地', () => {
  const { battle, caster, ally } = setup();
  const greased = castGrease(battle, caster.id, [{ x: 2, y: 3 }]);
  const turn = turnTo(greased, ally.id);
  const moved = moveActorToCell(turn, ally.id, 2, 3, { random: sequence(0.99) });
  assert.ok(!moved.actors.find(item => item.id === ally.id).combat.conditions.includes('倒地'));
  assert.ok(moved.combat.log.some(line => line.text.includes('稳住了脚')));
});

test('飞行单位不受油污影响', () => {
  const { battle, caster, ally } = setup();
  const greased = castGrease(battle, caster.id, [{ x: 2, y: 3 }]);
  const flying = setFlying(greased, ally.id, true);
  const turn = turnTo(flying, ally.id);
  const moved = moveActorToCell(turn, ally.id, 2, 3, { random: sequence(0) });
  assert.ok(!moved.actors.find(item => item.id === ally.id).combat.conditions.includes('倒地'));
});

test('回合开始时站在油污上豁免失败会倒地', () => {
  const { battle, caster, ally } = setup();
  const greased = castGrease(battle, caster.id, [{ x: 1, y: 3 }]);
  const turn = turnTo(greased, ally.id);
  const slipped = tickTurnStart(turn, { random: sequence(0) });
  assert.ok(slipped.actors.find(item => item.id === ally.id).combat.conditions.includes('倒地'));
});

test('油腻术会拒绝无方格、空格子与超限格子', () => {
  const { battle, caster } = setup();
  assert.throws(() => castGrease({ ...battle, grid: undefined }, caster.id, [{ x: 1, y: 1 }]), /请先启用方格战场/);
  assert.throws(() => castGrease(battle, caster.id, []), /请选择油腻术覆盖的格子/);
  assert.throws(() => castGrease(battle, caster.id, [{ x: 99, y: 1 }]), /超出战场范围/);
  const many = Array.from({ length: 13 }, (_, index) => ({ x: index % 10, y: Math.floor(index / 10) }));
  assert.throws(() => castGrease(battle, caster.id, many), /最多覆盖 12 格/);
});
