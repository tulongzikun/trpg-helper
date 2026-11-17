const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `nonlethal-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-nonlethal', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '格罗姆', species: '半兽人', characterClass: '野蛮人', level: 4,
    abilities: { str: 16, dex: 12, con: 16, int: 8, wis: 10, cha: 10 },
    maxHp: 44, armorClass: 14, speedFt: 30, actions: '巨斧：+5 命中，1d12+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '击晕', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  let next = configureGrid(added.store.battles[0], { width: 10, height: 10, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = startCombat(next, initiatives);
  next = structuredClone(next);
  const heroActor = next.actors.find(actor => actor.side === '友方');
  const foe = next.actors.find(actor => actor.side === '敌方');
  heroActor.position = { x: 0, y: 0 };
  foe.position = { x: 1, y: 0 };
  foe.currentHp = 3;
  return { battle: next, hero: heroActor, foe };
}

const logs = battle => battle.combat.log.map(line => line.text).join('\n');
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };
const strike = (battle, heroId, foeId, extra = {}) => attack(battle, {
  attackerId: heroId, targetId: foeId, attackBonus: 5, damageExpression: '1d12+3', damageType: '挥砍', ...extra,
}, { random: sequence(0.99, 0.9, 0.9, 0.9) });

test('非致命命中把目标打成昏迷而非死亡', () => {
  const { battle, hero, foe } = setup();
  const result = strike(battle, hero.id, foe.id, { nonLethal: true });
  const state = result.battle.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(result.outcome.hit, true);
  assert.equal(state.status, 'down');
  assert.equal(state.stable, true);
  assert.match(logs(result.battle), /被非致命攻击打晕/);
});

test('同等伤害下致命攻击直接造成死亡', () => {
  const { battle, hero, foe } = setup();
  const result = strike(battle, hero.id, foe.id);
  const state = result.battle.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.status, 'dead');
  assert.doesNotMatch(logs(result.battle), /被非致命攻击打晕/);
});

test('远程攻击不允许选择非致命', () => {
  const { battle, hero, foe } = setup();
  assert.throws(() => attack(battle, {
    attackerId: hero.id, targetId: foe.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '穿刺',
    range: 'ranged', distanceFt: 60, nonLethal: true,
  }, { random: sequence(0.99) }), /只有近战攻击可以选择非致命。/);
});

test('未打空生命值时非致命攻击不改变目标状态', () => {
  const { battle, hero, foe } = setup();
  const ready = structuredClone(battle);
  ready.actors.find(actor => actor.id === foe.id).currentHp = 40;
  const result = strike(ready, hero.id, foe.id, { nonLethal: true });
  const state = result.battle.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.status, 'active');
  assert.equal(state.stable, undefined);
  assert.doesNotMatch(logs(result.battle), /被非致命攻击打晕/);
});

test('战报详情标注非致命攻击', () => {
  const { battle, hero, foe } = setup();
  const result = strike(battle, hero.id, foe.id, { nonLethal: true });
  const detail = result.battle.combat.log.at(-1).detail ?? '';
  assert.match(detail, /非致命：命中后使目标昏迷而非死亡/);
});

test('对已昏迷的非致命目标继续攻击不累积死亡豁免失败', () => {
  const { battle, hero, foe } = setup();
  const first = strike(battle, hero.id, foe.id, { nonLethal: true });
  const ready = structuredClone(first.battle);
  ready.actors.find(actor => actor.id === hero.id).combat.actionUsed = false;
  const second = strike(ready, hero.id, foe.id, { nonLethal: true });
  const state = second.battle.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(state.status, 'down');
  assert.equal(state.deathSaves.failures, 0);
  assert.equal(state.stable, true);
});
