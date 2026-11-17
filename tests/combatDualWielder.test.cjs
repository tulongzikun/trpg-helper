const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, offhandAttack, setDualWielder, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-dual', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, saveProficiencies: [],
    actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: { equipment: '长剑' },
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '双持', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

const swing = (battle, friend, monster, random) => attack(battle, {
  attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee',
}, { random });

test('双持战斗者让 AC +1，把原本的命中变成未命中', () => {
  const { battle, friend, monster } = setup();
  const prone = { ...battle, actors: battle.actors.map(item => item.id === monster.id ? { ...item, template: { ...item.template, armorClass: 16 } } : item) };
  const plain = swing(prone, friend, monster, sequence(0.5));
  assert.equal(plain.outcome.total, 16);
  assert.equal(plain.outcome.hit, true);
  const guarded = setDualWielder(prone, monster.id, true);
  const blocked = swing(guarded, friend, monster, sequence(0.5));
  assert.equal(blocked.outcome.hit, false);
});

test('双持战斗者允许用非轻型武器进行副手攻击', () => {
  const { battle, friend, monster } = setup();
  const afterAction = swing(battle, friend, monster, sequence(0.9, 0.5));
  assert.throws(() => offhandAttack(afterAction.battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', weaponId: 'weapon:长剑' }), /只有轻型武器可以进行副手攻击/);
  const granted = setDualWielder(afterAction.battle, friend.id, true);
  const off = offhandAttack(granted, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', weaponId: 'weapon:长剑' }, { random: sequence(0.9, 0.5) });
  assert.equal(off.outcome.hit, true);
});

test('关闭后加值与副手资格一并消失', () => {
  const { battle, friend } = setup();
  const on = setDualWielder(battle, friend.id, true);
  assert.equal(on.actors.find(actor => actor.id === friend.id).combat.dualWielder, true);
  const off = setDualWielder(on, friend.id, false);
  assert.equal(off.actors.find(actor => actor.id === friend.id).combat.dualWielder, undefined);
});

test('切换会写入日志', () => {
  const { battle, friend } = setup();
  const on = setDualWielder(battle, friend.id, true);
  assert.ok(on.combat.log.at(-1).text.includes('双持战斗者'));
  assert.ok(setDualWielder(on, friend.id, false).combat.log.at(-1).text.includes('不再享受'));
});

test('开关对单位没有额外限制：1 级也允许（专长与等级无关）', () => {
  const { battle, friend } = setup();
  assert.ok(setDualWielder(battle, friend.id, true).actors.find(actor => actor.id === friend.id).combat.dualWielder);
});
