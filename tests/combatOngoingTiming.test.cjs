const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { addOngoingEffect, endTurn, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup(count = 2) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '持续时机', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const order = {};
  let initiative = 20;
  for (const actor of battle.actors) order[actor.id] = initiative--;
  return { battle: startCombat(battle, order), first: battle.actors[0], second: battle.actors[1] };
}

test('回合结束的持续伤害只在 endTurn 结算时生效', () => {
  const { battle, first } = setup();
  const added = addOngoingEffect(battle, first.id, { name: '灼烧', damageExpression: '1d6', damageType: '火焰', timing: 'end' }, { makeId: ids() }).battle;
  const hp = added.actors.find(actor => actor.id === first.id).currentHp;
  const next = endTurn(added, { random: sequence(0.5), makeId: ids() });
  assert.equal(next.actors.find(actor => actor.id === first.id).currentHp, hp - 4, '1d6 掷出 4');
  assert.ok(next.combat.log.some(line => /回合结束：「灼烧」/.test(line.text)));
});

test('默认的回合开始效果不在结束时结算', () => {
  const { battle, first, second } = setup();
  const added = addOngoingEffect(battle, first.id, { name: '中毒', damageExpression: '1d4', damageType: '毒素' }, { makeId: ids() }).battle;
  const hp = added.actors.find(actor => actor.id === first.id).currentHp;
  const next = endTurn(added, { random: sequence(0.5), makeId: ids() });
  assert.equal(next.actors.find(actor => actor.id === first.id).currentHp, hp, '离开回合不结算开始时机效果');
  assert.equal(next.actors.find(actor => actor.id === first.id).combat.ongoing.length, 1, '效果仍在');
  assert.notEqual(next.combat.order[next.combat.turnIndex], first.id, '已轮到其他单位');
  assert.equal(next.combat.order[next.combat.turnIndex], second.id);
});

test('回合结束型效果可以带豁免并在成功时移除', () => {
  const { battle, first } = setup();
  const added = addOngoingEffect(battle, first.id, { name: '缠绕', damageExpression: '1d6', damageType: '钝击', timing: 'end', saveEnds: { ability: 'str', dc: 10 } }, { makeId: ids() }).battle;
  const hp = added.actors.find(actor => actor.id === first.id).currentHp;
  const next = endTurn(added, { random: sequence(0.99, 0.5), makeId: ids() });
  assert.equal(next.actors.find(actor => actor.id === first.id).currentHp, hp, '豁免成功不受伤');
  assert.equal(next.actors.find(actor => actor.id === first.id).combat.ongoing.length, 0, '效果被移除');
  assert.ok(next.combat.log.some(line => /通过力量豁免，结束「缠绕」/.test(line.text)));
});

test('同时存在两种时机的效果时各结算各的', () => {
  const { battle, first } = setup();
  let added = addOngoingEffect(battle, first.id, { name: '灼烧', damageExpression: '1d6', damageType: '火焰', timing: 'end' }, { makeId: ids() }).battle;
  added = addOngoingEffect(added, first.id, { name: '酸液', damageExpression: '1d4', damageType: '酸蚀' }, { makeId: ids() }).battle;
  const before = added.actors.find(actor => actor.id === first.id).currentHp;
  const next = endTurn(added, { random: sequence(0.5), makeId: ids() });
  const actor = next.actors.find(item => item.id === first.id);
  assert.equal(actor.currentHp, before - 4, '只有结束时机效果在 endTurn 结算');
  assert.equal(actor.combat.ongoing.length, 2, '两个效果都还在');
});

test('非法结算时机被拒绝', () => {
  const { battle, first } = setup();
  assert.throws(() => addOngoingEffect(battle, first.id, { name: '错误', damageExpression: '1d6', damageType: '火焰', timing: 'middle' }, { makeId: ids() }), /持续效果的结算时机无效。/);
});
