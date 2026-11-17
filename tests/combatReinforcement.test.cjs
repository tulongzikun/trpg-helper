const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { addReinforcement, configureGrid, currentActorId, endTurn, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;

function setup(count = 2) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '增援测试', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const [first, second] = battle.actors.map(actor => actor.id);
  const started = startCombat(battle, { [first]: 18, [second]: 12 });
  return { battle: started, first, second };
}

test('未开始战斗或数据无效时拒绝加入增援', () => {
  const store = addMonsters(emptyStore(), card, { newBattleName: '增援测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  assert.throws(() => addReinforcement(store.battles[0], card, { side: '敌方' }), /请先开始战斗再加入增援。/);
  const { battle } = setup(1);
  const unnamed = { entry, block: { ...card.block, name: '' } };
  assert.throws(() => addReinforcement(battle, unnamed, { side: '敌方' }), /请填写增援单位的名称。/);
  assert.throws(() => addReinforcement(battle, card, { side: '敌方', initiative: 99 }), /先攻值须为 -20 至 60 的整数。/);
  const broken = structuredClone(card);
  broken.block.hitPoints.average = 0;
  assert.throws(() => addReinforcement(battle, broken, { side: '敌方' }), /增援单位的生命值无效。/);
});

test('增援按先攻插入序列且当前行动者保持不变', () => {
  const { battle, first } = setup(2);
  assert.equal(currentActorId(battle), first);
  const result = addReinforcement(battle, card, { side: '敌方', initiative: 25, name: '哥布林援军' });
  const next = result.battle;
  assert.equal(next.combat.order[0], result.actorId, '先攻 25 排在首位');
  assert.equal(next.combat.order.length, 3);
  assert.equal(currentActorId(next), first, '当前行动者仍是原来那一位');
  assert.equal(result.initiative, 25);
  const actor = next.actors.find(item => item.id === result.actorId);
  assert.equal(actor.currentHp, actor.maxHp);
  assert.equal(actor.combat.initiative, 25);
  assert.equal(actor.combat.actionUsed, false);
  assert.match(next.combat.log.at(-1).text, /哥布林援军 以先攻 25 加入战斗。/);
});

test('先攻低于全场时追加到序列末尾且不打断当前回合', () => {
  const { battle, first } = setup(2);
  const result = addReinforcement(battle, card, { side: '中立', initiative: -5, name: '迟到的雇佣兵' });
  const next = result.battle;
  assert.equal(next.combat.order.at(-1), result.actorId);
  assert.equal(next.combat.turnIndex, 0);
  assert.equal(currentActorId(next), first);
});

test('增援加入后按序列正常轮到它行动', () => {
  const { battle } = setup(1);
  const result = addReinforcement(battle, card, { side: '敌方', initiative: 30, name: '援军' });
  const moved = endTurn(result.battle, { makeId: ids() });
  assert.equal(currentActorId(moved), result.actorId, '先攻最高的增援在下一回合首先行动');
  assert.equal(moved.actors.find(actor => actor.id === result.actorId).combat.actionUsed, false);
});

test('指定位置时校验方格与占用', () => {
  const { battle } = setup(1);
  assert.throws(() => addReinforcement(battle, card, { side: '敌方', position: { x: 1, y: 1 } }), /请先启用方格战场。/);
  const grid = configureGrid(battle, { width: 6, height: 6, cellFt: 5 });
  const first = addReinforcement(grid, card, { side: '敌方', position: { x: 1, y: 1 }, name: '甲' });
  assert.deepEqual(first.battle.actors.find(actor => actor.id === first.actorId).position, { x: 1, y: 1 });
  assert.throws(() => addReinforcement(first.battle, card, { side: '敌方', position: { x: 1, y: 1 } }), /该格已有单位：甲。/);
  assert.throws(() => addReinforcement(first.battle, card, { side: '敌方', position: { x: 9, y: 1 } }), /目标格子超出战场范围。/);
});

test('未指定先攻时自动掷骰并写入', () => {
  const { battle } = setup(1);
  const result = addReinforcement(battle, card, { side: '敌方', name: '自动先攻' }, { random: () => 0.5 });
  assert.equal(result.initiative, 13, 'd20 掷出 11 加先攻加值 2');
  assert.equal(result.battle.actors.find(actor => actor.id === result.actorId).combat.initiative, 13);
});


