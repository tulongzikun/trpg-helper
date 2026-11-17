const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, blessTargets, castBless, castShieldReaction, currentActorId, endTurn, savingThrow, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `bless-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-bless', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '牧师', level: 5,
    abilities: { str: 12, dex: 14, con: 14, int: 10, wis: 16, cha: 10 },
    maxHp: 36, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

const ally = { ...hero, characterId: 'char-bless-ally', sheet: { ...hero.sheet, name: '布兰' } };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '祝福', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  let withAllies = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids()).store;
  withAllies = addCharacter(withAllies, ally, { battleId: battle.id, side: '友方' }, ids()).store;
  const current = withAllies.battles[0];
  const initiatives = {};
  current.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 - index : 10 - index; });
  const started = startCombat(current, initiatives);
  const friends = started.actors.filter(actor => actor.side === '友方');
  const enemy = started.actors.find(actor => actor.side === '敌方');
  return { battle: started, caster: friends[0], friend: friends[1], enemy };
}

/** 一直结束回合，直到轮到指定单位行动。 */
function turnTo(battle, actorId) {
  let current = battle;
  for (let guard = 0; guard < 12 && currentActorId(current) !== actorId; guard += 1) {
    current = endTurn(current, { random: sequence(0.5) });
  }
  assert.equal(currentActorId(current), actorId);
  return current;
}

test('祝福目标只包含 30 尺内的友方', () => {
  const { battle, caster, friend, enemy } = setup();
  const targets = blessTargets(battle, caster.id);
  assert.deepEqual(targets.map(item => item.id), [friend.id]);
  assert.ok(!targets.some(item => item.id === enemy.id || item.id === caster.id));
});

test('施放祝福术消耗动作并写入专注与轮数', () => {
  const { battle, caster, friend } = setup();
  const blessedBattle = castBless(battle, caster.id, [friend.id]);
  const casterState = blessedBattle.actors.find(item => item.id === caster.id).combat;
  assert.equal(casterState.actionUsed, true);
  assert.equal(casterState.concentration.spell, '祝福术');
  assert.equal(blessedBattle.actors.find(item => item.id === friend.id).combat.blessed, 10);
  assert.ok(blessedBattle.combat.log.at(-1).text.includes('祝福术'));
  assert.throws(() => castBless(blessedBattle, caster.id, [friend.id]), /已经使用过动作/);
  assert.throws(() => castBless(battle, caster.id, ['missing']), /未找到/);
});

test('祝福术的目标数量与在场校验', () => {
  const { battle, caster, friend } = setup();
  assert.throws(() => castBless(battle, caster.id, []), /请选择祝福的目标/);
  assert.equal(friend.id.length > 0, true);
  assert.throws(() => castBless(battle, caster.id, ['a', 'b', 'c', 'd']), /最多影响 3 名单位/);
});

test('受祝福单位的攻击检定获得 +1d4', () => {
  const { battle, caster, friend, enemy } = setup();
  const blessedBattle = castBless(battle, caster.id, [friend.id]);
  const ready = turnTo(blessedBattle, friend.id);
  const outcome = attack(ready, {
    attackerId: friend.id, targetId: enemy.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍',
  }, { random: sequence(0.5, 0.6, 0.5, 0.5) }).outcome;
  assert.equal(outcome.natural, 11);
  assert.equal(outcome.total, 11 + 5 + 3);
  assert.ok(outcome.notes.some(note => note.includes('祝福：攻击检定 +3')));
});

test('受祝福单位的豁免获得 +1d4', () => {
  const { battle, caster, friend } = setup();
  const blessedBattle = castBless(battle, caster.id, [friend.id]);
  const outcome = savingThrow(blessedBattle, { actorId: friend.id, ability: 'con', dc: 15, bonus: 4 }, { random: sequence(0.6, 0.5) }).outcome;
  assert.equal(outcome.bless, 3);
  assert.equal(outcome.total, outcome.natural + 4 + 3);
  assert.ok(outcome.notes.some(note => note.includes('祝福：豁免 +3')));
});

test('护盾术消耗反应，AC +5 并在自己下个回合开始时失效', () => {
  const { battle, friend, enemy } = setup();
  const shieldReady = turnTo(battle, friend.id);
  const shielded = castShieldReaction(shieldReady, friend.id);
  assert.equal(shielded.actors.find(item => item.id === friend.id).combat.shield, 5);
  assert.throws(() => castShieldReaction(shielded, friend.id), /已经使用过反应/);
  const foeTurn = turnTo(shielded, enemy.id);
  const plainFoeTurn = turnTo(battle, enemy.id);
  const against = attack(foeTurn, {
    attackerId: enemy.id, targetId: friend.id, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍',
  }, { random: sequence(0.5, 0.5) }).outcome;
  const plain = attack(plainFoeTurn, {
    attackerId: enemy.id, targetId: friend.id, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍',
  }, { random: sequence(0.5, 0.5) }).outcome;
  assert.equal(against.targetAc, plain.targetAc + 5);
  let later = foeTurn;
  for (let step = 0; step < 3; step += 1) later = endTurn(later, { random: sequence(0.5) });
  assert.equal(later.actors.find(item => item.id === friend.id).combat.shield, undefined);
});
