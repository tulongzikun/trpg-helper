const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { castWeb, configureGrid, endTurn, escapeWeb, moveActorToCell, setFlying, startCombat, tickTurnStart, webAt } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `web-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-web', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '法师', level: 5,
    abilities: { str: 10, dex: 12, con: 12, int: 16, wis: 12, cha: 10 },
    maxHp: 30, armorClass: 14, speedFt: 30, actions: '短杖：+3 命中，1d6+1 钝击伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '蛛网', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let next = addCharacter(store, hero, { battleId: store.battles[0].id, side: '友方' }, ids()).store;
  next = addCharacter(next, { ...hero, characterId: 'char-web-ally', sheet: { ...hero.sheet, name: '布兰' } }, { battleId: store.battles[0].id, side: '友方' }, ids()).store;
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

test('蛛网术消耗动作并记录覆盖的格子', () => {
  const { battle, caster } = setup();
  const next = castWeb(battle, caster.id, [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }]);
  assert.equal(next.webs.length, 2);
  assert.equal(webAt(next, 2, 2), true);
  assert.equal(webAt(next, 5, 5), false);
  assert.equal(next.actors.find(item => item.id === caster.id).combat.actionUsed, true);
  assert.ok(next.combat.log.some(line => line.text.includes('施放蛛网术')));
});

test('进入蛛网失败会被束缚且无法再移动', () => {
  const { battle, caster, ally } = setup();
  const webbed = castWeb(battle, caster.id, [{ x: 2, y: 3 }]);
  const turn = turnTo(webbed, ally.id);
  const moved = moveActorToCell(turn, ally.id, 2, 3, { random: sequence(0) });
  assert.ok(moved.actors.find(item => item.id === ally.id).combat.conditions.includes('束缚'));
  assert.ok(moved.combat.log.some(line => line.text.includes('被蛛网缠住')));
  assert.throws(() => moveActorToCell(moved, ally.id, 3, 3, { random: sequence(0.5) }), /束缚的单位无法移动/);
});

test('进入蛛网豁免成功不束缚，但移动消耗翻倍', () => {
  const { battle, caster, ally } = setup();
  const webbed = castWeb(battle, caster.id, [{ x: 2, y: 3 }]);
  const turn = turnTo(webbed, ally.id);
  const moved = moveActorToCell(turn, ally.id, 2, 3, { random: sequence(0.99) });
  const state = moved.actors.find(item => item.id === ally.id).combat;
  assert.ok(!state.conditions.includes('束缚'));
  assert.equal(state.movementUsed, 10);
  assert.ok(moved.combat.log.some(line => line.text.includes('稳住身形')));
});

test('飞行单位不受蛛网影响', () => {
  const { battle, caster, ally } = setup();
  const webbed = castWeb(battle, caster.id, [{ x: 2, y: 3 }]);
  const flying = setFlying(webbed, ally.id, true);
  const turn = turnTo(flying, ally.id);
  const moved = moveActorToCell(turn, ally.id, 2, 3, { random: sequence(0) });
  assert.ok(!moved.actors.find(item => item.id === ally.id).combat.conditions.includes('束缚'));
});

test('回合开始时停在蛛网上失败会被束缚', () => {
  const { battle, caster, ally } = setup();
  const webbed = castWeb(battle, caster.id, [{ x: 1, y: 3 }]);
  const turn = turnTo(webbed, ally.id);
  const stuck = tickTurnStart(turn, { random: sequence(0) });
  assert.ok(stuck.actors.find(item => item.id === ally.id).combat.conditions.includes('束缚'));
});

test('挣脱蛛网：失败保留束缚，成功解除', () => {
  const { battle, caster, ally } = setup();
  const webbed = castWeb(battle, caster.id, [{ x: 2, y: 3 }]);
  const turn = turnTo(webbed, ally.id);
  const stuckBattle = moveActorToCell(turn, ally.id, 2, 3, { random: sequence(0) });
  const failed = escapeWeb(stuckBattle, ally.id, { random: sequence(0) });
  assert.ok(failed.battle.actors.find(item => item.id === ally.id).combat.conditions.includes('束缚'));
  const nextTurn = turnTo(endTurn(failed.battle), ally.id);
  const escaped = escapeWeb(nextTurn, ally.id, { random: sequence(0.99) });
  assert.ok(!escaped.battle.actors.find(item => item.id === ally.id).combat.conditions.includes('束缚'));
  assert.equal(escaped.outcome.success, true);
});
