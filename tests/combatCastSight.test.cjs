const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addAura } = require('../apps/web/src/battle.ts');
const { startCombat, castHoldPerson, castCommand, castCharmPerson, castBlindness, castDeafness, castPolymorph, moveActorToCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `sight-${++counter}`;

function setup(withWall) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '视线施法', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const caster = { ...base.actors[0], id: 'caster-1', name: '法师', side: '友方' };
  const foe = { ...base.actors[0], id: 'foe-1', name: '哥布林', side: '敌方' };
  let battle = {
    ...base,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: [
      { ...caster, position: { x: 0, y: 0 } },
      { ...foe, position: { x: 4, y: 0 } },
    ],
    walls: withWall ? [{ x: 2, y: 0 }] : [],
  };
  battle = startCombat(battle, { 'caster-1': 20, 'foe-1': 10 });
  return battle;
}

test('墙体挡住连线时不能对目标施法定身术', () => {
  const battle = setup(true);
  assert.throws(() => castHoldPerson(battle, 'caster-1', 'foe-1'), /视线被墙体阻挡，无法对该目标施法。/);
});

test('墙体挡住时命令术同样被拒', () => {
  const battle = setup(true);
  assert.throws(() => castCommand(battle, 'caster-1', 'foe-1', 'drop'), /视线被墙体阻挡，无法对该目标施法。/);
});

test('墙体挡住时魅惑、致盲、耳聋、变形术都被拒', () => {
  const battle = setup(true);
  assert.throws(() => castCharmPerson(battle, 'caster-1', 'foe-1'), /视线被墙体阻挡/);
  assert.throws(() => castBlindness(battle, 'caster-1', 'foe-1'), /视线被墙体阻挡/);
  assert.throws(() => castDeafness(battle, 'caster-1', 'foe-1'), /视线被墙体阻挡/);
  assert.throws(() => castPolymorph(battle, 'caster-1', 'foe-1'), /视线被墙体阻挡/);
});

test('没有墙体时可以正常施法', () => {
  const battle = setup(false);
  const next = castHoldPerson(battle, 'caster-1', 'foe-1');
  assert.ok(next.combat.log.some(item => item.text.includes('定身术')));
});

test('没有方格或没有位置时不检查视线', () => {
  const battle = setup(false);
  const bare = { ...battle, grid: undefined, walls: [] };
  const next = castHoldPerson(bare, 'caster-1', 'foe-1', { random: () => 0.05 });
  assert.equal(next.actors.find(item => item.id === 'foe-1').combat.paralyzed, 10);
});
