const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, moraleCheck, surrender, fleeBattle, lootCorpse } = require('../apps/web/src/combat.ts');
const { defeatedActors } = require('../apps/web/src/encounterReward.ts');
const { battleOutcome } = require('../apps/web/src/combatOutcome.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `morale-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-morale', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '西格', species: '人类', characterClass: '战士', level: 3,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 32, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup(count = 2) {
  let store = addMonsters(emptyStore(), card, { newBattleName: '士气', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 10, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const ally = next.actors.find(actor => actor.side === '友方');
  const foes = next.actors.filter(actor => actor.side === '敌方');
  ally.position = { x: 0, y: 0 };
  foes.forEach((foe, index) => { foe.position = { x: 1 + index, y: 0 }; });
  return { battle: next, ally, foes };
}

const logs = battle => battle.combat.log.map(item => item.text).join('\n');

test('士气检定失败则放下武器投降', () => {
  const { battle, foes } = setup();
  const next = moraleCheck(battle, foes[0].id, { random: sequence(0.01) });
  const state = next.actors.find(actor => actor.id === foes[0].id).combat;
  assert.equal(state.surrendered, true);
  assert.match(logs(next), /士气崩溃/);
  assert.match(logs(next), /投降/);
});

test('士气检定成功则稳住阵脚，不改变状态', () => {
  const { battle, foes } = setup();
  const next = moraleCheck(battle, foes[0].id, { random: sequence(0.99) });
  const state = next.actors.find(actor => actor.id === foes[0].id).combat;
  assert.equal(state.surrendered, undefined);
  assert.equal(state.status, 'active');
  assert.match(logs(next), /稳住了士气/);
});

test('自定义 DC 生效', () => {
  const { battle, foes } = setup();
  const weak = moraleCheck(battle, foes[0].id, { random: sequence(0.5) }, 5);
  assert.equal(weak.actors.find(actor => actor.id === foes[0].id).combat.surrendered, undefined);
  const harsh = moraleCheck(battle, foes[0].id, { random: sequence(0.5) }, 25);
  assert.equal(harsh.actors.find(actor => actor.id === foes[0].id).combat.surrendered, true);
});

test('已投降、已撤离与倒地的单位不做士气检定', () => {
  const { battle, foes } = setup();
  const gave = surrender(battle, foes[0].id);
  assert.throws(() => moraleCheck(gave, foes[0].id), /已经退出战斗的单位不需要士气检定/);
  const fled = fleeBattle(battle, foes[0].id);
  assert.throws(() => moraleCheck(fled, foes[0].id), /已经退出战斗的单位不需要士气检定/);
  const downed = structuredClone(battle);
  downed.actors.find(actor => actor.id === foes[0].id).combat.status = 'down';
  assert.throws(() => moraleCheck(downed, foes[0].id), /只有在场的单位需要做士气检定/);
});

test('因士气投降的单位计入击败经验并可被搜刮', () => {
  const { battle, ally, foes } = setup();
  const next = moraleCheck(battle, foes[0].id, { random: sequence(0.01) });
  const defeated = defeatedActors(next).map(actor => actor.id);
  assert.deepEqual(defeated, [foes[0].id]);
  const nearby = structuredClone(next);
  nearby.actors.find(actor => actor.id === ally.id).position = { x: 1, y: 0 };
  const captive = nearby.actors.find(actor => actor.id === foes[0].id);
  captive.position = { x: 1, y: 1 };
  captive.combat.items = [{ name: '弯刀', quantity: 1 }];
  const looted = lootCorpse(nearby, ally.id, foes[0].id);
  assert.deepEqual(looted.looted, ['弯刀']);
  assert.match(logs(looted.battle), /搜刮/);
});

test('敌方全体士气崩溃判为胜利', () => {
  const { battle, foes } = setup();
  let next = moraleCheck(battle, foes[0].id, { random: sequence(0.01) });
  next = moraleCheck(next, foes[1].id, { random: sequence(0.01) });
  assert.equal(battleOutcome(next), 'victory');
});
