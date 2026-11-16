const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, startConcentration, endConcentration, markSummon, dismissSummon, damageActor, endTurn, summonsOf } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup(count = 2) {
  const battle = addMonsters(emptyStore(), card, { newBattleName: '召唤测试', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const started = startCombat(battle, {});
  const [owner, other] = started.actors.map(actor => actor.id);
  return { started, owner, other };
}

test('只有维持专注的单位可以召唤单位', () => {
  const { started, owner, other } = setup();
  assert.throws(() => markSummon(started, other, { ownerId: owner }), /只有维持专注的单位可以召唤单位。/);
});

test('标记召唤物会写入来源法术、持续轮数并记录日志', () => {
  const { started, owner, other } = setup();
  const focused = startConcentration(started, owner, '召唤林地妖精');
  const marked = markSummon(focused, other, { ownerId: owner, rounds: 3 }, { makeId: ids() });
  const summon = marked.actors.find(actor => actor.id === other);
  assert.equal(summon.summon.ownerId, owner);
  assert.equal(summon.summon.spell, '召唤林地妖精');
  assert.equal(summon.summon.rounds, 3);
  assert.equal(summonsOf(marked, owner).length, 1);
  assert.match(marked.combat.log.at(-1).text, /成为 .* 的召唤物/);
});

test('结束专注会让召唤物消散', () => {
  const { started, owner, other } = setup();
  const marked = markSummon(startConcentration(started, owner, '召唤林地妖精'), other, { ownerId: owner });
  const ended = endConcentration(marked, owner);
  assert.equal(ended.actors.some(actor => actor.id === other), false);
  assert.match(ended.combat.log.map(item => item.text).join(' '), /消散了/);
});

test('施法者被打倒时召唤物立即消散', () => {
  const { started, owner, other } = setup();
  const marked = markSummon(startConcentration(started, owner, '召唤林地妖精'), other, { ownerId: owner });
  const hurt = damageActor(marked, owner, 999, '钝击', { random: sequence(0.1), makeId: ids() }).battle;
  assert.equal(hurt.actors.some(actor => actor.id === other), false);
  assert.match(hurt.combat.log.map(item => item.text).join(' '), /消散了/);
});

test('持续轮数从施法者回合开始递减，归零即消散', () => {
  const { started, owner, other } = setup();
  let battle = markSummon(startConcentration(started, owner, '召唤林地妖精'), other, { ownerId: owner, rounds: 1 });
  battle = endTurn(battle, { makeId: ids() });
  assert.equal(battle.actors.some(actor => actor.id === other), true);
  battle = endTurn(battle, { makeId: ids() });
  assert.equal(battle.actors.some(actor => actor.id === other), false);
  assert.match(battle.combat.log.map(item => item.text).join(' '), /召唤持续时间结束/);
});

test('可以解除召唤并保留单位，重复解除会报错', () => {
  const { started, owner, other } = setup();
  const marked = markSummon(startConcentration(started, owner, '召唤林地妖精'), other, { ownerId: owner });
  const released = dismissSummon(marked, other);
  assert.equal(released.actors.find(actor => actor.id === other).summon, undefined);
  assert.equal(released.actors.length, marked.actors.length);
  assert.throws(() => dismissSummon(released, other), /该单位不是召唤物。/);
});

test('不能把自己标记为自己的召唤物，死亡单位也不能成为召唤物', () => {
  const { started, owner, other } = setup();
  const focused = startConcentration(started, owner, '召唤林地妖精');
  assert.throws(() => markSummon(focused, owner, { ownerId: owner }), /不能把单位标记为自己的召唤物。/);
  const dead = damageActor(focused, other, 999, '钝击').battle;
  assert.throws(() => markSummon(dead, other, { ownerId: owner }), /已经死亡的单位不能成为召唤物。/);
});

test('持续轮数必须为 1 至 99 的整数', () => {
  const { started, owner, other } = setup();
  const focused = startConcentration(started, owner, '召唤林地妖精');
  assert.throws(() => markSummon(focused, other, { ownerId: owner, rounds: 0 }), /召唤持续轮数须为 1 至 99 的整数。/);
  assert.throws(() => markSummon(focused, other, { ownerId: owner, rounds: 100 }), /召唤持续轮数须为 1 至 99 的整数。/);
});
