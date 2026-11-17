const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter, configureGrid } = require('../apps/web/src/battle.ts');
const { abilityCheck, attack, configureGrid: grid, moveActorToCell, savingThrow, setExhaustion, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-exhaustion', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, saveProficiencies: ['con'],
    actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: { equipment: '长剑' },
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '力竭', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

const strike = (battle, friend, monster, deps) => attack(battle, {
  attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee',
}, deps);

test('力竭 2 级使攻击检定 -4', () => {
  const { battle, friend, monster } = setup();
  const tough = { ...battle, actors: battle.actors.map(item => item.id === monster.id ? { ...item, template: { ...item.template, armorClass: 15 } } : item) };
  const fresh = strike(tough, friend, monster, { random: sequence(0.5) });
  assert.equal(fresh.outcome.natural, 11);
  assert.equal(fresh.outcome.total, 16);
  assert.equal(fresh.outcome.hit, true);
  const tired = strike(setExhaustion(tough, friend.id, 2), friend, monster, { random: sequence(0.5) });
  assert.equal(tired.outcome.total, 12);
  assert.equal(tired.outcome.hit, false);
});

test('力竭 1 级使豁免 -2', () => {
  const { battle, friend } = setup();
  const plain = savingThrow(battle, { actorId: friend.id, ability: 'con', dc: 16 }, { random: sequence(0.55) });
  const tired = savingThrow(setExhaustion(battle, friend.id, 1), { actorId: friend.id, ability: 'con', dc: 16 }, { random: sequence(0.55) });
  assert.equal(plain.outcome.total - tired.outcome.total, 2);
});

test('力竭使属性检定 -2 每级', () => {
  const { battle, friend } = setup();
  const plain = abilityCheck(battle, { actorId: friend.id, ability: 'str', skill: '运动', dc: 10 }, { random: sequence(0.55) });
  const tired = abilityCheck(setExhaustion(battle, friend.id, 2), { actorId: friend.id, ability: 'str', skill: '运动', dc: 10 }, { random: sequence(0.55) });
  assert.equal(plain.outcome.total - tired.outcome.total, 4);
});

test('力竭每级降低 5 尺速度', () => {
  const { battle, friend } = setup();
  const tired = setExhaustion(battle, friend.id, 2);
  const placed = moveActorToCell(grid(tired, { width: 12, height: 8, cellFt: 5 }), friend.id, 1, 1);
  assert.throws(() => moveActorToCell(placed, friend.id, 6, 1), /移动距离超出速度上限（20 尺）/);
  assert.ok(moveActorToCell(placed, friend.id, 4, 1));
});

test('力竭 0 级清除且非法值被拒绝', () => {
  const { battle, friend } = setup();
  const tired = setExhaustion(battle, friend.id, 3);
  assert.ok(tired.combat.log.at(-1).text.includes('力竭等级为 3'));
  const cleared = setExhaustion(tired, friend.id, 0);
  assert.equal(cleared.actors.find(actor => actor.id === friend.id).combat.exhaustion, undefined);
  assert.ok(cleared.combat.log.at(-1).text.includes('力竭解除'));
  assert.throws(() => setExhaustion(battle, friend.id, 7), /力竭等级须为 0 至 6 的整数/);
});
