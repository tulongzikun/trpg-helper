const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, shortRest, hitDiceRemaining } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `short-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-short', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '凯尔', species: '人类', characterClass: '战士', level: 10,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 70, armorClass: 17, speedFt: 30, actions: '长剑：+7 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup(currentHp = 40) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '短休', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const added = addCharacter(store, hero, { battleId: store.battles[0].id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const heroId = battle.actors.find(actor => actor.name === '凯尔').id;
  const foeId = battle.actors.find(actor => actor.side === '敌方').id;
  const initiatives = {};
  battle.actors.forEach((actor) => { initiatives[actor.id] = actor.id === heroId ? 20 : 10; });
  const started = startCombat(battle, initiatives);
  const wounded = {
    ...started,
    actors: started.actors.map(actor => actor.id === heroId ? { ...actor, currentHp } : actor),
  };
  return { battle: wounded, heroId, foeId };
}

const lowRoll = () => 0;

test('花费一个生命骰按骰面加体质调整值恢复', () => {
  const { battle, heroId } = setup(40);
  const result = shortRest(battle, heroId, 1, { random: lowRoll });
  const character = result.battle.actors.find(actor => actor.id === heroId);
  assert.equal(result.rolls[0], 1);
  assert.equal(result.healed, 3);
  assert.equal(character.currentHp, 43);
  assert.equal(hitDiceRemaining(character), 9);
});

test('一次花多个生命骰逐颗累加', () => {
  const { battle, heroId } = setup(40);
  const result = shortRest(battle, heroId, 3, { random: lowRoll });
  assert.equal(result.rolls.length, 3);
  assert.equal(result.healed, 9);
  assert.equal(hitDiceRemaining(result.battle.actors.find(actor => actor.id === heroId)), 7);
});

test('恢复不超过生命上限', () => {
  const { battle, heroId } = setup(68);
  const result = shortRest(battle, heroId, 2, { random: lowRoll });
  assert.equal(result.healed, 2);
  assert.equal(result.battle.actors.find(actor => actor.id === heroId).currentHp, 70);
});

test('生命骰不足时报错', () => {
  const { battle, heroId } = setup(40);
  assert.throws(() => shortRest(battle, heroId, 11, { random: lowRoll }), /生命骰不足（剩余 10 个）。/);
});

test('数量不合法时报错', () => {
  const { battle, heroId } = setup(40);
  assert.throws(() => shortRest(battle, heroId, 0, { random: lowRoll }), /花费的生命骰数量必须是正整数。/);
  assert.throws(() => shortRest(battle, heroId, 1.5, { random: lowRoll }), /花费的生命骰数量必须是正整数。/);
});

test('倒地的单位短休后站起来', () => {
  const { battle, heroId } = setup(0);
  const down = {
    ...battle,
    actors: battle.actors.map(actor => actor.id === heroId
      ? { ...actor, currentHp: 0, combat: { ...actor.combat, status: 'down', conditions: [...actor.combat.conditions, '倒地'] } }
      : actor),
  };
  const result = shortRest(down, heroId, 1, { random: lowRoll });
  const character = result.battle.actors.find(actor => actor.id === heroId);
  assert.equal(character.combat.status, 'active');
  assert.equal(character.currentHp, 3);
  assert.equal(character.combat.conditions.includes('倒地'), false);
});
