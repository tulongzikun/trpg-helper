const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, endTurn, parry, setDefensiveDuelist, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-parry', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 15, speedFt: 30, saveProficiencies: [],
    actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: { equipment: '长剑' },
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '格挡', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  const started = startCombat(withHero, initiatives);
  const friend = started.actors.find(actor => actor.side === '友方');
  const monster = started.actors.find(actor => actor.side === '敌方');
  return { battle: started, friend, monster };
}

const strikeMonster = (battle, friend, monster, random) => attack(battle, {
  attackerId: monster.id, targetId: friend.id, attackBonus: 5, damageExpression: '1d6+1', damageType: '挥砍', range: 'melee',
}, { random });

test('格挡让 AC 加上熟练加值，把命中变成未命中', () => {
  const { battle, friend, monster } = setup();
  const forced = { battle: { ...battle, combat: { ...battle.combat, turnIndex: battle.combat.order.indexOf(monster.id) } }, friend, monster };
  const plain = strikeMonster(forced.battle, friend, monster, sequence(0.5));
  assert.equal(plain.outcome.total, 16);
  assert.equal(plain.outcome.hit, true);
  const guarded = setDefensiveDuelist(forced.battle, friend.id, true);
  const parried = parry(guarded, friend.id);
  const blocked = strikeMonster(parried, friend, monster, sequence(0.5));
  assert.equal(blocked.outcome.hit, false);
});

test('格挡消耗反应，重复使用被拒绝', () => {
  const { battle, friend } = setup();
  const parried = parry(setDefensiveDuelist(battle, friend.id, true), friend.id);
  assert.equal(parried.actors.find(actor => actor.id === friend.id).combat.reactionUsed, true);
  assert.throws(() => parry(parried, friend.id), /已经使用过反应/);
});

test('没有专长或没有近战武器时不能格挡', () => {
  const { battle, friend } = setup();
  assert.throws(() => parry(battle, friend.id), /只有持有防守决斗专长/);
});

test('下个回合开始时清空格挡加值', () => {
  const { battle, friend } = setup();
  const parried = parry(setDefensiveDuelist(battle, friend.id, true), friend.id);
  const after = endTurn(endTurn(parried));
  assert.equal(after.actors.find(actor => actor.id === friend.id).combat.parryBonus, undefined);
});

test('关闭专长会同时清掉正在生效的加值', () => {
  const { battle, friend } = setup();
  const parried = parry(setDefensiveDuelist(battle, friend.id, true), friend.id);
  const off = setDefensiveDuelist(parried, friend.id, false);
  const state = off.actors.find(actor => actor.id === friend.id).combat;
  assert.equal(state.defensiveDuelist, undefined);
  assert.equal(state.parryBonus, undefined);
});
