const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, setActorHp, setExhaustion, rollDeathSave } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `dead-${++counter}`;
const seq = values => () => values.shift() ?? 0.5;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-exh-death', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '力竭死亡豁免', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  const started = startCombat(withHero, initiatives);
  const friend = started.actors.find(actor => actor.side === '友方');
  return { battle: setActorHp(started, friend.id, 0), heroId: friend.id };
}

const textsOf = battle => (battle.combat?.log ?? []).map(item => item.text);

test('没有力竭时 d20(12) 算成功', () => {
  const { battle, heroId } = setup();
  const rolled = rollDeathSave(battle, heroId, { random: seq([0.55]) });
  assert.equal(rolled.outcome.successes, 1);
  assert.ok(textsOf(rolled.battle).some(text => /d20\(12\) = 12/.test(text)));
});

test('力竭 2 级会把 d20(12) 压到 8 而失败', () => {
  const { battle, heroId } = setup();
  const tired = setExhaustion(battle, heroId, 2);
  const rolled = rollDeathSave(tired, heroId, { random: seq([0.55]) });
  assert.equal(rolled.outcome.failures, 1);
  assert.equal(rolled.outcome.successes, 0);
  assert.ok(textsOf(rolled.battle).some(text => /d20\(12\) - 4（力竭）= 8/.test(text)));
});

test('力竭罚值让原本刚好及格的 10 变成失败', () => {
  const { battle, heroId } = setup();
  const plain = rollDeathSave(structuredClone(battle), heroId, { random: seq([0.45]) });
  assert.equal(plain.outcome.successes, 1);
  const tired = setExhaustion(battle, heroId, 1);
  const rolled = rollDeathSave(tired, heroId, { random: seq([0.45]) });
  assert.equal(rolled.outcome.failures, 1);
});

test('掷出 20 仍然直接复苏，不受力竭影响', () => {
  const { battle, heroId } = setup();
  const tired = setExhaustion(battle, heroId, 4);
  const rolled = rollDeathSave(tired, heroId, { random: seq([0.99]) });
  assert.equal(rolled.outcome.revived, true);
  assert.equal(rolled.battle.actors.find(actor => actor.id === heroId).currentHp, 1);
});

test('掷出 1 仍记两次失败，即使有力竭', () => {
  const { battle, heroId } = setup();
  const tired = setExhaustion(battle, heroId, 3);
  const rolled = rollDeathSave(tired, heroId, { random: seq([0.0]) });
  assert.equal(rolled.outcome.failures, 2);
});
