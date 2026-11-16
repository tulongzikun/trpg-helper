const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { attack, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const battle = addMonsters(emptyStore(), card, { newBattleName: '掩体测试', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const [first, second] = battle.actors.map(actor => actor.id);
  const started = startCombat(battle, { [first]: 20, [second]: 10 });
  const attacker = started.actors.find(actor => actor.id === first);
  const target = started.actors.find(actor => actor.id === second);
  return { started, first, second, targetAc: target.template.armorClass, attackBonus: attacker.template.attackBonus ?? 5 };
}

test('掩体会提高目标 AC 并写入日志', () => {
  const { started, first, second, targetAc } = setup();
  const shot = attack(started, { attackerId: first, targetId: second, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍', cover: '半掩体' }, { random: sequence(), makeId: ids() });
  assert.equal(shot.outcome.targetAc, targetAc + 2);
  assert.match(shot.battle.combat.log.at(-1).detail, /半掩体（AC \+2）/);
  const heavy = attack(started, { attackerId: first, targetId: second, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍', cover: '四分之三掩体' }, { random: sequence(), makeId: ids() });
  assert.equal(heavy.outcome.targetAc, targetAc + 5);
});

test('四分之三掩体可以让临界命中变为未命中', () => {
  const { started, first, second, targetAc } = setup();
  const natural = 11;
  const bonus = targetAc + 2 - natural;
  const open = attack(started, { attackerId: first, targetId: second, attackBonus: bonus, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.5), makeId: ids() });
  assert.equal(open.outcome.hit, true);
  const covered = attack(started, { attackerId: first, targetId: second, attackBonus: bonus, damageExpression: '1d6', damageType: '挥砍', cover: '四分之三掩体' }, { random: sequence(0.5), makeId: ids() });
  assert.equal(covered.outcome.hit, false);
  assert.equal(covered.outcome.damage, 0);
});

test('无效的掩体取值会被拒绝', () => {
  const { started, first, second } = setup();
  assert.throws(() => attack(started, { attackerId: first, targetId: second, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍', cover: '半遮蔽' }, { random: sequence() }), /掩体取值无效。/);
});
