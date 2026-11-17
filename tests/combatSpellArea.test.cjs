const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, moveActorToCell, setActorHp, startCombat } = require('../apps/web/src/combat.ts');
const { spellAreaTargets } = require('../apps/web/src/combatSpells.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;

function snapshot() {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '米娅', species: '人类', characterClass: '法师', level: 5,
      abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
      maxHp: 30, armorClass: 13, speedFt: 30, actions: '火焰弹：+7 命中，1d10 火焰伤害，射程 120 尺', notes: '',
      details: { equipment: '短弓' },
    },
  };
}

function setup() {
  const base = addMonsters(emptyStore(), card, { newBattleName: '范围', side: '敌方', count: 4 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const withAlly = addCharacter({ version: 1, battles: [base] }, snapshot(), { battleId: base.id, side: '友方' }, ids());
  const battle = withAlly.store.battles[0];
  const caster = battle.actors.find(actor => actor.side === '友方');
  const monsters = battle.actors.filter(actor => actor.side === '敌方');
  const initiatives = { [caster.id]: 20 };
  monsters.forEach((monster, index) => { initiatives[monster.id] = 10 - index; });
  const started = startCombat(battle, initiatives);
  let grid = configureGrid(started, { width: 12, height: 12, cellFt: 5 });
  grid = moveActorToCell(grid, caster.id, 0, 0);
  grid = moveActorToCell(grid, monsters[0].id, 1, 0);
  grid = moveActorToCell(grid, monsters[1].id, 2, 2);
  grid = moveActorToCell(grid, monsters[2].id, 4, 0);
  grid = moveActorToCell(grid, monsters[3].id, 6, 0);
  return { battle: grid, caster, monsters };
}

const near = (ids, monsters, indexes) => indexes.map(index => monsters[index].id).sort();

test('球形范围按距离包含目标（含友军）', () => {
  const { battle, caster, monsters } = setup();
  const ids = spellAreaTargets(battle, caster.id, 'sphere', 20);
  assert.deepEqual([...ids].sort(), near(ids, monsters, [0, 1, 2]).sort());
});

test('立方范围按切比雪夫距离判定', () => {
  const { battle, caster, monsters } = setup();
  const ids = spellAreaTargets(battle, caster.id, 'cube', 15);
  assert.deepEqual([...ids].sort(), near(ids, monsters, [0, 1]).sort());
});

test('线形范围只覆盖朝向上的单位', () => {
  const { battle, caster, monsters } = setup();
  const ids = spellAreaTargets(battle, caster.id, 'line', 30, { x: 1, y: 0 });
  assert.deepEqual([...ids].sort(), near(ids, monsters, [0, 2, 3]).sort());
});

test('锥形范围覆盖 45 度内且不越过长度', () => {
  const { battle, caster, monsters } = setup();
  const ids = spellAreaTargets(battle, caster.id, 'cone', 30, { x: 1, y: 0 });
  assert.ok(ids.includes(monsters[0].id), '正前方应包含');
  assert.ok(ids.includes(monsters[1].id), '45 度边缘应包含');
  assert.ok(ids.includes(monsters[2].id), '同一直线上应包含');
  const narrow = spellAreaTargets(battle, caster.id, 'cone', 15, { x: 1, y: 0 });
  assert.ok(!narrow.includes(monsters[2].id), '超出长度的不应包含');
});

test('不包含施法者本人，也不包含已阵亡单位', () => {
  const { battle, caster, monsters } = setup();
  const dead = setActorHp(battle, monsters[0].id, 0);
  const ids = spellAreaTargets(dead, caster.id, 'sphere', 30);
  assert.ok(!ids.includes(caster.id));
  assert.ok(!ids.includes(monsters[0].id));
  assert.ok(ids.includes(monsters[1].id));
});

test('缺方格、尺寸非法与缺方向时报错', () => {
  const { battle, caster, monsters } = setup();
  assert.throws(() => spellAreaTargets({ ...battle, grid: undefined }, caster.id, 'sphere', 20), /请先启用方格战场/);
  assert.throws(() => spellAreaTargets(battle, caster.id, 'sphere', 7), /范围尺寸须为 5 至 120 尺的整数/);
  assert.throws(() => spellAreaTargets(battle, caster.id, 'cube', 200), /范围尺寸须为 5 至 120 尺的整数/);
  let lonely = battle;
  monsters.forEach(monster => { lonely = setActorHp(lonely, monster.id, 0); });
  assert.throws(() => spellAreaTargets(lonely, caster.id, 'cone', 15), /需要一个方向/);
});
