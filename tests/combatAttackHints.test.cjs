const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, attackHints, setWeather } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `hint-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-hint', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '罗宾', species: '人类', characterClass: '游侠', level: 3,
    abilities: { str: 12, dex: 16, con: 12, int: 10, wis: 14, cha: 10 },
    maxHp: 26, armorClass: 15, speedFt: 30, actions: '长弓：+7 命中，1d8+3 穿刺伤害，远程 150 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '提示', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 12, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const attacker = next.actors.find(actor => actor.side === '友方');
  const foes = next.actors.filter(actor => actor.side === '敌方');
  attacker.position = { x: 0, y: 0 };
  foes[0].position = { x: 1, y: 0 };
  foes[1].position = { x: 3, y: 0 };
  return { battle: next, attacker, blocker: foes[0], target: foes[1] };
}

const has = (hints, keyword) => hints.some(hint => hint.includes(keyword));

test('空旷战场没有任何提示', () => {
  const { battle, attacker, target } = setup();
  const empty = structuredClone(battle);
  empty.actors.find(actor => actor.id !== target.id && actor.side === '敌方').position = { x: 0, y: 5 };
  // 目标改为贴身格：距离 5 尺不越界，才谈得上「没有提示」
  empty.actors.find(actor => actor.id === target.id).position = { x: 0, y: 1 };
  assert.deepEqual(attackHints(empty, attacker.id, target.id, 'ranged'), []);
  assert.deepEqual(attackHints(empty, attacker.id, target.id, 'melee'), []);
});

test('墙体挡视线时给出远程拒绝提示', () => {
  const { battle, attacker, target } = setup();
  const walled = structuredClone(battle);
  walled.actors.find(actor => actor.id !== target.id && actor.side === '敌方').position = { x: 0, y: 5 };
  walled.walls = [{ x: 2, y: 0 }];
  const hints = attackHints(walled, attacker.id, target.id, 'ranged');
  assert.ok(has(hints, '视线被墙体阻挡'));
  assert.equal(attackHints(walled, attacker.id, target.id, 'melee').some(hint => hint.includes('视线')), false);
});

test('连线中间的单位提示生物掩体', () => {
  const { battle, attacker, blocker, target } = setup();
  const hints = attackHints(battle, attacker.id, target.id, 'ranged');
  assert.ok(has(hints, '生物掩体'));
  assert.ok(has(hints, blocker.name));
  assert.ok(has(hints, 'AC +2'));
  assert.equal(has(attackHints(battle, attacker.id, target.id, 'melee'), '生物掩体'), false);
});

test('高差 10 尺以上给出高地优势或仰射劣势', () => {
  const { battle, attacker, target } = setup();
  const high = structuredClone(battle);
  high.actors.find(actor => actor.id === attacker.id).elevation = 20;
  assert.ok(has(attackHints(high, attacker.id, target.id, 'ranged'), '高地优势'));

  const low = structuredClone(battle);
  low.actors.find(actor => actor.id === attacker.id).elevation = 0;
  low.actors.find(actor => actor.id === target.id).elevation = 25;
  assert.ok(has(attackHints(low, attacker.id, target.id, 'ranged'), '仰射'));

  const near = structuredClone(battle);
  near.actors.find(actor => actor.id === attacker.id).elevation = 5;
  near.actors.find(actor => actor.id === target.id).elevation = 10;
  assert.equal(has(attackHints(near, attacker.id, target.id, 'ranged'), '高地'), false);
});

test('魔法黑暗与云雾只有在单方面遮蔽时才提示', () => {
  const { battle, attacker, target } = setup();
  const dark = structuredClone(battle);
  dark.darkness = [{ x: 3, y: 0 }];
  assert.ok(has(attackHints(dark, attacker.id, target.id, 'ranged'), '魔法黑暗'));

  const both = structuredClone(battle);
  both.darkness = [{ x: 3, y: 0 }, { x: 0, y: 0 }];
  assert.equal(has(attackHints(both, attacker.id, target.id, 'ranged'), '魔法黑暗'), false);

  const foggy = structuredClone(battle);
  foggy.fog = [{ x: 3, y: 0 }];
  assert.ok(has(attackHints(foggy, attacker.id, target.id, 'ranged'), '云雾遮蔽'));
});

test('近战超出触及范围时给出提示', () => {
  const { battle, attacker, target } = setup();
  const hints = attackHints(battle, attacker.id, target.id, 'melee');
  assert.ok(has(hints, '超出近战触及范围（5 尺）'));
  assert.ok(has(hints, '距离 15 尺'));

  const close = structuredClone(battle);
  close.actors.find(actor => actor.id === target.id).position = { x: 0, y: 1 };
  assert.equal(attackHints(close, attacker.id, target.id, 'melee').some(hint => hint.includes('超出近战触及范围')), false);
});

test('天气只影响远程提示', () => {
  const { battle, attacker, target } = setup();
  const rainy = setWeather(structuredClone(battle), 'rain');
  const hints = attackHints(rainy, attacker.id, target.id, 'ranged');
  assert.ok(has(hints, '暴雨'));
  assert.equal(has(attackHints(rainy, attacker.id, target.id, 'melee'), '暴雨'), false);
});
