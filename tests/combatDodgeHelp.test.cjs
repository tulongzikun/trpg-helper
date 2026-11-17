const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, dodge, endTurn, help, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (name) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: `char-${name}`, revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name, species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: { equipment: '长剑' },
  },
});

function setup(friends = 1) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '闪避协助测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = store.battles[0];
  for (let index = 0; index < friends; index += 1) {
    const added = addCharacter({ ...store, battles: [battle] }, hero(`同伴${index + 1}`), { battleId: battle.id, side: '友方' }, ids());
    battle = added.store.battles[0];
  }
  const monsters = battle.actors.filter(actor => actor.side === '敌方');
  const friends2 = battle.actors.filter(actor => actor.side === '友方');
  const order = {};
  friends2.forEach((actor, index) => { order[actor.id] = 20 - index; });
  monsters.forEach((actor, index) => { order[actor.id] = 5 - index; });
  return { battle: startCombat(battle, order), friends: friends2, monsters };
}

const strike = (attacker, target, extra = {}) => ({
  attackerId: attacker.id, targetId: target.id, attackBonus: 5, damageExpression: '1d6', damageType: '钝击',
  range: 'melee', distanceFt: 5, ...extra,
});

test('闪避让针对该单位的攻击检定具有劣势', () => {
  const { battle, friends, monsters } = setup();
  const hero1 = friends[0];
  const dodged = dodge(battle, hero1.id);
  const monsterTurn = endTurn(dodged);
  const result = attack(monsterTurn, strike(monsters[0], hero1), { random: sequence(0.9, 0.1), makeId: ids() });
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.equal(result.outcome.natural, 3);
  assert.equal(result.outcome.hit, false);
  assert.match(String(result.battle.combat.log.at(-1).detail), /目标在使用闪避/);
});

test('闪避在自己下个回合开始时失效', () => {
  const { battle, friends } = setup();
  const hero1 = friends[0];
  const dodged = dodge(battle, hero1.id);
  assert.equal(dodged.actors.find(actor => actor.id === hero1.id).combat.dodging, true);
  const afterRound = endTurn(endTurn(dodged));
  assert.equal(afterRound.actors.find(actor => actor.id === hero1.id).combat.dodging, false);
  assert.ok(afterRound.combat.log.some(item => item.text.includes('使用闪避')));
});

test('协助让受协助单位的下一次攻击具有优势', () => {
  const { battle, friends, monsters } = setup(2);
  const [hero1, hero2] = friends;
  const helped = help(battle, hero1.id, hero2.id);
  const result = attack(endTurn(helped), strike(hero2, monsters[0], { attackBonus: 30 }), { random: sequence(0.1, 0.9), makeId: ids() });
  assert.equal(result.outcome.mode, 'advantage');
  assert.equal(result.outcome.natural, 19);
  assert.equal(result.outcome.hit, true);
  assert.match(String(result.battle.combat.log.at(-1).detail), /得到协助/);
});

test('协助用掉后清除，不会无限优势', () => {
  const { battle, friends, monsters } = setup(2);
  const [hero1, hero2] = friends;
  const helped = help(battle, hero1.id, hero2.id);
  const one = attack(endTurn(helped), strike(hero2, monsters[0], { attackBonus: 30 }), { random: sequence(0.1, 0.9), makeId: ids() });
  assert.equal(one.battle.actors.find(actor => actor.id === hero2.id).combat.helpedAttack, false);
  const two = attack(endTurn(endTurn(endTurn(one.battle))), strike(hero2, monsters[0], { attackBonus: 30 }), { random: sequence(0.1, 0.9), makeId: ids() });
  assert.equal(two.outcome.mode, 'normal');
});

test('协助要求同阵营且不能协助自己', () => {
  const { battle, friends, monsters } = setup(2);
  const [hero1, hero2] = friends;
  assert.throws(() => help(battle, hero1.id, hero1.id), /不能协助自己。/);
  assert.throws(() => help(battle, hero1.id, monsters[0].id), /只能协助同阵营的单位。/);
});

test('非当前回合或动作已用完时不能闪避或协助', () => {
  const { battle, friends, monsters } = setup(2);
  const [hero1, hero2] = friends;
  assert.throws(() => dodge(battle, monsters[0].id), /只有当前回合的单位可以闪避。/);
  assert.throws(() => help(battle, monsters[0].id, hero2.id), /只有当前回合的单位可以协助。/);
  const afterDodge = dodge(battle, hero1.id);
  assert.throws(() => dodge(afterDodge, hero1.id), /该单位本回合已经使用过动作。/);
  assert.throws(() => help(afterDodge, hero1.id, hero2.id), /该单位本回合已经使用过动作。/);
});
