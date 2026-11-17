const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter, configureGrid } = require('../apps/web/src/battle.ts');
const { attack, configureGrid: grid, currentActorId, endTurn, moveActorToCell, recklessAttack, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (characterClass, level) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-reckless', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '蛮子', species: '人类', characterClass, level,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 15, speedFt: 30,
    actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺',
    notes: '', details: { equipment: '长剑' },
  },
});

function setup(characterClass, level) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '鲁莽攻击', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(characterClass, level), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  let started = startCombat(withHero, initiatives);
  const friend = started.actors.find(actor => actor.side === '友方');
  let monster = started.actors.find(actor => actor.side === '敌方');
  started = grid(started, { width: 10, height: 10, cellFt: 5 });
  started = moveActorToCell(started, friend.id, 1, 1);
  started = moveActorToCell(started, monster.id, 2, 1);
  return { battle: started, friend, monster };
}

test('鲁莽攻击写入状态并记日志', () => {
  const { battle, friend } = setup('野蛮人', 2);
  const result = recklessAttack(battle, friend.id);
  assert.equal(result.actors.find(actor => actor.id === friend.id).combat.reckless, true);
  assert.match(result.combat.log.at(-1).text, /使用鲁莽攻击/);
});

test('鲁莽攻击使自己的攻击检定获得优势', () => {
  const { battle, friend, monster } = setup('野蛮人', 2);
  const reckless = recklessAttack(battle, friend.id);
  const result = attack(reckless, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', weaponId: 'weapon:长剑' }, { random: sequence(0.1, 0.9) });
  assert.equal(result.outcome.natural, 19);
  assert.equal(result.outcome.hit, true);
  assert.match(result.battle.combat.log.at(-1).detail, /鲁莽攻击：攻击检定优势/);
});

test('对处于鲁莽攻击的单位攻击同样具有优势', () => {
  const { battle, friend, monster } = setup('野蛮人', 2);
  const reckless = recklessAttack(battle, friend.id);
  const monsterTurn = endTurn(reckless);
  assert.equal(currentActorId(monsterTurn), monster.id);
  const result = attack(monsterTurn, { attackerId: monster.id, targetId: friend.id, attackBonus: 4, damageExpression: '1d6+2', damageType: '挥砍', range: 'melee' }, { random: sequence(0.1, 0.9) });
  assert.equal(result.outcome.natural, 19);
  assert.match(result.battle.combat.log.at(-1).detail, /目标处于鲁莽攻击：攻击检定优势/);
});

test('鲁莽攻击持续到自己的下个回合开始', () => {
  const { battle, friend, monster } = setup('野蛮人', 2);
  const reckless = recklessAttack(battle, friend.id);
  const afterMonster = endTurn(reckless);
  assert.equal(afterMonster.actors.find(actor => actor.id === friend.id).combat.reckless, true);
  const backToFriend = endTurn(afterMonster);
  assert.equal(currentActorId(backToFriend), friend.id);
  assert.equal(backToFriend.actors.find(actor => actor.id === friend.id).combat.reckless, false);
});

test('非野蛮人或等级不足时拒绝', () => {
  const { battle, friend } = setup('战士', 5);
  assert.throws(() => recklessAttack(battle, friend.id), /只有 2 级以上的野蛮人可以使用鲁莽攻击/);
});

test('非当前回合的单位不能使用鲁莽攻击', () => {
  const { battle, friend, monster } = setup('野蛮人', 2);
  const monsterTurn = endTurn(battle);
  assert.equal(currentActorId(monsterTurn), monster.id);
  assert.throws(() => recklessAttack(monsterTurn, friend.id), /只有当前回合的单位可以使用鲁莽攻击/);
});
