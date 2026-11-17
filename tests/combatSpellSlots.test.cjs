const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, currentActorId } = require('../apps/web/src/combat.ts');
const { castSpell, setSpellSlots } = require('../apps/web/src/combatSpells.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-caster', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '法师学徒', species: '人类', characterClass: '法师', level: 5,
    abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
    maxHp: 30, armorClass: 12, speedFt: 30, actions: '', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '法术位', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  const started = startCombat(withHero, initiatives);
  const friend = started.actors.find(actor => actor.side === '友方');
  const monster = started.actors.find(actor => actor.side === '敌方');
  assert.equal(currentActorId(started), friend.id);
  return { battle: started, friend, monster };
}

const cast = (battle, friend, monster, level, deps) => castSpell(battle, {
  casterId: friend.id,
  spell: '火球术',
  level,
  save: { ability: 'dex', dc: 15, targetIds: [monster.id], damageExpression: '2d6', damageType: '火焰' },
}, deps);

test('记录法术位后施法会扣除对应环位', () => {
  const { battle, friend, monster } = setup();
  const prepared = setSpellSlots(battle, friend.id, [3, 2]);
  assert.deepEqual(prepared.actors.find(actor => actor.id === friend.id).combat.spellSlots, [3, 2]);
  const result = cast(prepared, friend, monster, 1, { random: sequence(0.5, 0.5) });
  assert.deepEqual(result.battle.actors.find(actor => actor.id === friend.id).combat.spellSlots, [2, 2]);
  assert.ok(result.battle.combat.log.some(item => item.text.includes('消耗 1 个 1 环法术位，剩余 2 个')));
});

test('法术位耗尽时拒绝施法', () => {
  const { battle, friend, monster } = setup();
  const prepared = setSpellSlots(battle, friend.id, [0, 1]);
  assert.throws(() => cast(prepared, friend, monster, 1, { random: sequence(0.5, 0.5) }), /1 环法术位已经用完/);
});

test('戏法不消耗法术位', () => {
  const { battle, friend, monster } = setup();
  const prepared = setSpellSlots(battle, friend.id, [2]);
  const result = cast(prepared, friend, monster, 0, { random: sequence(0.5, 0.5) });
  assert.deepEqual(result.battle.actors.find(actor => actor.id === friend.id).combat.spellSlots, [2]);
  assert.equal(result.battle.combat.log.some(item => item.text.includes('消耗 1 个')), false);
});

test('未记录法术位时不追踪也不报错', () => {
  const { battle, friend, monster } = setup();
  const result = cast(battle, friend, monster, 1, { random: sequence(0.5, 0.5) });
  assert.equal(result.battle.actors.find(actor => actor.id === friend.id).combat.spellSlots, undefined);
});

test('法术位输入校验与清空', () => {
  const { battle, friend } = setup();
  assert.throws(() => setSpellSlots(battle, friend.id, [1, -1]), /法术位须为/);
  assert.throws(() => setSpellSlots(battle, friend.id, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), /法术位须为/);
  const prepared = setSpellSlots(battle, friend.id, [2, 1]);
  const cleared = setSpellSlots(prepared, friend.id, []);
  assert.deepEqual(cleared.actors.find(actor => actor.id === friend.id).combat.spellSlots, undefined);
  assert.ok(cleared.combat.log.some(item => item.text.includes('清除')));
});
