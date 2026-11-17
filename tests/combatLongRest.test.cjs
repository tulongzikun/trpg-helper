const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { currentActorId, recoverClassResources, startCombat, takeLongRest } = require('../apps/web/src/combat.ts');
const { castSpell, setSpellSlots } = require('../apps/web/src/combatSpells.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-rest', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '法师', level: 5,
    abilities: { str: 14, dex: 14, con: 14, int: 16, wis: 12, cha: 8 },
    maxHp: 32, armorClass: 14, speedFt: 30, actions: '长剑：+4 命中，1d8+2 挥砍伤害，触及 5 尺', notes: '', details: { equipment: '长剑' },
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '长休', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

test('长休把法术位恢复到记录时的上限', () => {
  const { battle, friend, monster } = setup();
  let current = setSpellSlots(battle, friend.id, [3, 2]);
  const cast = castSpell(current, { casterId: friend.id, spell: '燃烧之手', level: 1, save: { ability: 'dex', dc: 14, targetIds: [monster.id], damageExpression: '2d6', damageType: '火焰' } }, { random: sequence(0.5, 0.5) });
  current = cast.battle;
  assert.deepEqual(current.actors.find(actor => actor.id === friend.id).combat.spellSlots, [2, 2]);
  const rested = takeLongRest(current);
  assert.deepEqual(rested.actors.find(actor => actor.id === friend.id).combat.spellSlots, [3, 2]);
});

test('长休重置动作如潮、回气与弹药', () => {
  const { battle, friend } = setup();
  const dirty = structuredClone(battle);
  const state = dirty.actors.find(actor => actor.id === friend.id).combat;
  state.actionSurgeUsed = 1;
  state.secondWindUsed = true;
  state.ammo = 3;
  state.actionUsed = true;
  const rested = takeLongRest(dirty);
  const after = rested.actors.find(actor => actor.id === friend.id).combat;
  assert.equal(after.actionSurgeUsed, 0);
  assert.equal(after.secondWindUsed, false);
  assert.equal(after.actionUsed, false);
  assert.equal(after.ammo, undefined);
});

test('长休清除专注与每回合状态', () => {
  const { battle, friend } = setup();
  const dirty = structuredClone(battle);
  const state = dirty.actors.find(actor => actor.id === friend.id).combat;
  state.concentration = { spell: '祝福术' };
  state.dodging = true;
  state.reckless = true;
  state.hidden = true;
  state.ready = { action: '攻击', trigger: '敌人靠近' };
  state.speedPenaltyFt = 10;
  const rested = takeLongRest(dirty);
  const after = rested.actors.find(actor => actor.id === friend.id).combat;
  assert.equal(after.concentration, undefined);
  assert.equal(after.dodging, false);
  assert.equal(after.reckless, false);
  assert.equal(after.hidden, false);
  assert.equal(after.ready, undefined);
  assert.equal(after.speedPenaltyFt, undefined);
});

test('长休不改变生命值', () => {
  const { battle, friend } = setup();
  const dirty = structuredClone(battle);
  const actor = dirty.actors.find(item => item.id === friend.id);
  actor.currentHp = 11;
  const rested = takeLongRest(dirty);
  assert.equal(rested.actors.find(item => item.id === friend.id).currentHp, 11);
  assert.ok(rested.combat.log.at(-1).text.includes('长休'));
});

test('短休只恢复动作与职业资源，不恢复法术位', () => {
  const { battle, friend } = setup();
  let current = setSpellSlots(battle, friend.id, [2]);
  current = castSpell(current, { casterId: friend.id, spell: '魔法飞弹', level: 1, attack: { targetId: current.actors.find(actor => actor.side === '敌方').id, attackBonus: 7, damageExpression: '1d4+1', damageType: '力场' } }, { random: sequence(0.5, 0.5) }).battle;
  const short = recoverClassResources(current);
  assert.deepEqual(short.actors.find(actor => actor.id === friend.id).combat.spellSlots, [1]);
});
