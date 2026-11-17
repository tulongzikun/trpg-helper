const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { buildCover, coverAt, destroyCover, configureGrid, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `demolish-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-demolish', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '格罗姆', species: '半兽人', characterClass: '野蛮人', level: 4,
    abilities: { str: 16, dex: 12, con: 16, int: 8, wis: 10, cha: 10 },
    maxHp: 44, armorClass: 14, speedFt: 30, actions: '巨斧：+5 命中，1d12+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '破障', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  let next = configureGrid(added.store.battles[0], { width: 10, height: 10, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = startCombat(next, initiatives);
  const heroActor = next.actors.find(actor => actor.side === '友方');
  const foe = next.actors.find(actor => actor.side === '敌方');
  next = structuredClone(next);
  next.actors.find(actor => actor.id === heroActor.id).position = { x: 0, y: 0 };
  next.actors.find(actor => actor.id === foe.id).position = { x: 6, y: 0 };
  return { battle: next, hero: heroActor, foe };
}

const logs = battle => battle.combat.log.map(line => line.text).join('\n');
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };
const withCover = (battle, heroId, cells) => {
  const built = buildCover(battle, heroId, cells);
  const ready = structuredClone(built);
  ready.actors.find(actor => actor.id === heroId).combat.actionUsed = false;
  return ready;
};

test('成功摧毁相邻的掩体并消耗动作', () => {
  const { battle, hero } = setup();
  const ready = withCover(battle, hero.id, [{ x: 1, y: 0 }]);
  const result = destroyCover(ready, hero.id, { x: 1, y: 0 }, { random: sequence(0.9) });
  assert.equal(result.outcome.success, true);
  assert.equal(coverAt(result.battle, 1, 0), false);
  assert.equal(result.battle.actors.find(actor => actor.id === hero.id).combat.actionUsed, true);
  assert.ok(logs(result.battle).includes('摧毁了'));
});

test('检定失败时掩体保留并留下失败日志', () => {
  const { battle, hero } = setup();
  const ready = withCover(battle, hero.id, [{ x: 1, y: 0 }]);
  const result = destroyCover(ready, hero.id, { x: 1, y: 0 }, { random: sequence(0.05) });
  assert.equal(result.outcome.success, false);
  assert.equal(coverAt(result.battle, 1, 0), true);
  assert.ok(logs(result.battle).includes('没能撼动'));
});

test('该格没有掩体时会被拒绝', () => {
  const { battle, hero } = setup();
  assert.throws(() => destroyCover(battle, hero.id, { x: 2, y: 2 }), /该格没有可摧毁的掩体/);
});

test('只能摧毁相邻格子的掩体', () => {
  const { battle, hero } = setup();
  const ready = withCover(battle, hero.id, [{ x: 5, y: 5 }]);
  assert.throws(() => destroyCover(ready, hero.id, { x: 5, y: 5 }, { random: sequence(0.9) }), /只能摧毁相邻格子的掩体/);
});

test('非当前回合、已用动作与未启用方格都会被拒绝', () => {
  const { battle, hero, foe } = setup();
  const ready = withCover(battle, hero.id, [{ x: 1, y: 0 }]);
  assert.throws(() => destroyCover(ready, foe.id, { x: 1, y: 0 }), /只有当前回合的单位可以摧毁掩体/);
  const spent = structuredClone(ready);
  spent.actors.find(actor => actor.id === hero.id).combat.actionUsed = true;
  assert.throws(() => destroyCover(spent, hero.id, { x: 1, y: 0 }), /本回合已经使用过动作/);
  assert.throws(() => destroyCover({ ...ready, grid: undefined }, hero.id, { x: 1, y: 0 }), /请先启用方格战场/);
});

test('摧毁后该格不再是掩体，也不再提供掩体加值', () => {
  const { battle, hero } = setup();
  const ready = withCover(battle, hero.id, [{ x: 1, y: 0 }, { x: 1, y: 1 }]);
  const result = destroyCover(ready, hero.id, { x: 1, y: 0 }, { random: sequence(0.9) });
  assert.equal(result.battle.cover.length, 1);
  assert.equal(coverAt(result.battle, 1, 0), false);
  assert.equal(coverAt(result.battle, 1, 1), true);
});
