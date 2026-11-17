const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, castEntangle, entangleAt, endConcentration, takeLongRest, endTurn, moveActorToCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `entangle-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-entangle', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '萝拉', species: '人类', characterClass: '德鲁伊', level: 3,
    abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 10 },
    maxHp: 28, armorClass: 14, speedFt: 30, actions: '木杖：+3 命中，1d6+1 钝击伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '纠缠', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 12, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const caster = next.actors.find(actor => actor.side === '友方');
  const foe = next.actors.find(actor => actor.side === '敌方');
  caster.position = { x: 0, y: 0 };
  foe.position = { x: 2, y: 0 };
  return { battle: next, caster, foe };
}

const logs = battle => battle.combat.log.map(item => item.text).join('\n');
const cells = [{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 2, y: 1 }];

test('纠缠术记录格子、专注，并对区域内单位做力量豁免', () => {
  const { battle, caster, foe } = setup();
  const next = castEntangle(battle, caster.id, cells, { random: sequence(0.01) });
  assert.equal(next.entangle.length, 3);
  assert.equal(next.entangleBy, caster.id);
  assert.equal(entangleAt(next, 2, 0), true);
  assert.equal(entangleAt(next, 0, 0), false);
  const casterState = next.actors.find(actor => actor.id === caster.id).combat;
  assert.equal(casterState.actionUsed, true);
  assert.equal(casterState.concentration.spell, '纠缠术');
  const foeState = next.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(foeState.entangled, true);
  assert.ok(foeState.conditions.includes('束缚'));
  assert.match(logs(next), /被藤蔓缠住/);
});

test('豁免成功则不受束缚', () => {
  const { battle, caster, foe } = setup();
  const next = castEntangle(battle, caster.id, cells, { random: sequence(0.99) });
  const foeState = next.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(foeState.entangled, undefined);
  assert.equal(foeState.conditions.includes('束缚'), false);
});

test('藤蔓格让移动消耗翻倍', () => {
  const { battle, caster } = setup();
  const next = castEntangle(battle, caster.id, cells, { random: sequence(0.99) });
  const moved = moveActorToCell(next, caster.id, 2, 1, { random: sequence(0.99) });
  const state = moved.actors.find(actor => actor.id === caster.id).combat;
  // 斜向 2 格 → 10 尺 × 2（藤蔓）= 20 尺
  assert.equal(state.movementUsed, 20);
  assert.match(logs(moved), /藤蔓使消耗翻倍/);
});

test('被束缚的单位无法移动', () => {
  const { battle, caster, foe } = setup();
  const next = castEntangle(battle, caster.id, cells, { random: sequence(0.01) });
  const foeTurn = endTurn(next, { random: sequence(0.01) });
  assert.equal(foeTurn.actors.find(actor => actor.id === foe.id).combat.entangled, true);
  assert.throws(() => moveActorToCell(foeTurn, foe.id, 4, 0, { random: sequence(0.99) }), /束缚/);
});

test('回合开始再豁免成功即挣脱', () => {
  const { battle, caster, foe } = setup();
  const next = castEntangle(battle, caster.id, cells, { random: sequence(0.01) });
  const first = endTurn(next, { random: sequence(0.99) });
  const foeState = first.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(foeState.entangled, undefined);
  assert.equal(foeState.conditions.includes('束缚'), false);
  assert.match(logs(first), /挣脱了藤蔓的缠绕/);
});

test('结束专注与长休都会清除藤蔓', () => {
  const { battle, caster, foe } = setup();
  const next = castEntangle(battle, caster.id, cells, { random: sequence(0.01) });
  const ended = endConcentration(next, caster.id);
  assert.equal(ended.entangle, undefined);
  assert.equal(ended.actors.find(actor => actor.id === foe.id).combat.entangled, undefined);
  assert.match(logs(ended), /藤蔓枯萎了/);

  const ready = structuredClone(ended);
  ready.actors.find(actor => actor.id === caster.id).combat.actionUsed = false;
  const again = castEntangle(ready, caster.id, cells, { random: sequence(0.01) });
  const rested = takeLongRest(again);
  assert.equal(rested.entangle, undefined);
  assert.equal(rested.entangleBy, undefined);
});

test('拒绝无方格、空格、坐标非法、超 16 格与动作已用', () => {
  const { battle, caster } = setup();
  assert.throws(() => castEntangle({ ...battle, grid: undefined }, caster.id, cells), /请先启用方格战场/);
  assert.throws(() => castEntangle(battle, caster.id, []), /请选择纠缠术覆盖的格子/);
  assert.throws(() => castEntangle(battle, caster.id, [{ x: 1.5, y: 0 }]), /格子坐标须为整数/);
  assert.throws(() => castEntangle(battle, caster.id, [{ x: 40, y: 0 }]), /超出战场范围/);
  const many = Array.from({ length: 17 }, (_, index) => ({ x: index % 12, y: Math.floor(index / 12) }));
  assert.throws(() => castEntangle(battle, caster.id, many), /最多覆盖 16 格/);
  const used = castEntangle(battle, caster.id, cells, { random: sequence(0.99) });
  assert.throws(() => castEntangle(used, caster.id, cells, { random: sequence(0.99) }), /已经使用过动作/);
});
