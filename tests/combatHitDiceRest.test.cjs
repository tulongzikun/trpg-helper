const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, shortRest, takeLongRest, hitDiceRemaining } = require('../apps/web/src/combat.ts');
const { effectsOf } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `hd-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-hd', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '雷恩', species: '人类', characterClass: '战士', level: 6,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 52, armorClass: 17, speedFt: 30, actions: '长剑：+7 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup(currentHp = 20) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '生命骰', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const added = addCharacter(store, hero, { battleId: store.battles[0].id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const heroId = battle.actors.find(actor => actor.name === '雷恩').id;
  const initiatives = {};
  battle.actors.forEach((actor) => { initiatives[actor.id] = actor.id === heroId ? 20 : 10; });
  const started = startCombat(battle, initiatives);
  return { battle: { ...started, actors: started.actors.map(actor => actor.id === heroId ? { ...actor, currentHp } : actor) }, heroId };
}

test('短休后剩余生命骰写进状态', () => {
  const { battle, heroId } = setup();
  const result = shortRest(battle, heroId, 2, { random: () => 0 });
  const character = result.battle.actors.find(actor => actor.id === heroId);
  assert.equal(hitDiceRemaining(character), 4);
});

test('长休恢复全部生命骰', () => {
  const { battle, heroId } = setup();
  const rested = shortRest(battle, heroId, 3, { random: () => 0 }).battle;
  assert.equal(hitDiceRemaining(rested.actors.find(actor => actor.id === heroId)), 3);
  const after = takeLongRest(rested);
  assert.equal(hitDiceRemaining(after.actors.find(actor => actor.id === heroId)), 6);
});

test('战报状态列出已消耗的生命骰', () => {
  const { battle, heroId } = setup();
  const rested = shortRest(battle, heroId, 2, { random: () => 0 }).battle;
  const character = rested.actors.find(actor => actor.id === heroId);
  assert.ok(effectsOf(character).includes('生命骰 4/6'));
});

test('没有消耗过生命骰时不写这一项', () => {
  const { battle, heroId } = setup();
  const character = battle.actors.find(actor => actor.id === heroId);
  assert.equal(effectsOf(character).some(text => text.startsWith('生命骰')), false);
});

test('长休把已消耗的生命骰清零记录', () => {
  const { battle, heroId } = setup();
  const rested = takeLongRest(shortRest(battle, heroId, 1, { random: () => 0 }).battle);
  const character = rested.actors.find(actor => actor.id === heroId);
  assert.equal(character.combat.hitDice, undefined);
  assert.equal(hitDiceRemaining(character), 6);
});
