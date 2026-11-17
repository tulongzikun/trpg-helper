const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { castBless, damageActor, endConcentration, startCombat, startConcentration } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `focus-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-focus', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '牧师', level: 5,
    abilities: { str: 12, dex: 14, con: 14, int: 10, wis: 16, cha: 10 },
    maxHp: 36, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

const ally = { ...hero, characterId: 'char-focus-ally', sheet: { ...hero.sheet, name: '布兰' } };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '专注', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  let withAllies = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids()).store;
  withAllies = addCharacter(withAllies, ally, { battleId: battle.id, side: '友方' }, ids()).store;
  const current = withAllies.battles[0];
  const initiatives = {};
  current.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 - index : 10 - index; });
  const started = startCombat(current, initiatives);
  const friends = started.actors.filter(actor => actor.side === '友方');
  return { battle: started, caster: friends[0], friend: friends[1] };
}

function blessedBattle() {
  const { battle, caster, friend } = setup();
  const next = castBless(battle, caster.id, [friend.id]);
  assert.equal(next.actors.find(item => item.id === friend.id).combat.blessedBy, caster.id);
  return { battle: next, caster, friend };
}

test('施法者结束专注会立刻清除祝福', () => {
  const { battle, caster, friend } = blessedBattle();
  const ended = endConcentration(battle, caster.id);
  const state = ended.actors.find(item => item.id === friend.id).combat;
  assert.equal(state.blessed, undefined);
  assert.equal(state.blessedBy, undefined);
  assert.ok(ended.combat.log.some(line => line.text.includes('祝福术结束了')));
});

test('专注检定失败会清除祝福', () => {
  const { battle, caster, friend } = blessedBattle();
  const hurt = damageActor(battle, caster.id, 12, '挥砍', { random: sequence(0.0) });
  assert.equal(hurt.battle.actors.find(item => item.id === caster.id).combat.concentration, undefined);
  assert.equal(hurt.battle.actors.find(item => item.id === friend.id).combat.blessed, undefined);
});

test('施法者死亡会清除祝福', () => {
  const { battle, caster, friend } = blessedBattle();
  const slain = damageActor(battle, caster.id, 200, '挥砍', { random: sequence(0.5) });
  assert.equal(slain.battle.actors.find(item => item.id === caster.id).combat.status, 'dead');
  assert.equal(slain.battle.actors.find(item => item.id === friend.id).combat.blessed, undefined);
});

test('改用其他专注法术会清除旧祝福', () => {
  const { battle, caster, friend } = blessedBattle();
  const switched = startConcentration(battle, caster.id, '灼热光辉');
  const state = switched.actors.find(item => item.id === friend.id).combat;
  assert.equal(state.blessed, undefined);
  assert.ok(switched.combat.log.some(line => line.text.includes('祝福术结束了')));
});
