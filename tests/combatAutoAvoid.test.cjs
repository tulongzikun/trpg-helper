const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { castGrease, configureGrid, startCombat } = require('../apps/web/src/combat.ts');
const { autoAct } = require('../apps/web/src/combatAuto.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot() {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '艾拉', species: '人类', characterClass: '游侠', level: 5,
      abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 8 },
      maxHp: 40, armorClass: 15, speedFt: 30,
      actions: '短弓：+7 命中，1d8+3 穿刺伤害，射程 80/320 尺', notes: '',
      details: { equipment: '短弓' },
    },
  };
}

function place(battle, heroAt, foeAt) {
  return {
    ...battle,
    actors: battle.actors.map(actor => (actor.side === '友方'
      ? { ...actor, position: heroAt }
      : { ...actor, position: foeAt })),
  };
}

function setup() {
  const base = addMonsters(emptyStore(), card, { newBattleName: '绕开', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [foe.id]: 10 });
  const gridded = configureGrid(started, { width: 10, height: 10, cellFt: 5 });
  return { battle: gridded, hero, foe };
}

test('自动行动会绕开油污格', () => {
  const { battle, hero } = setup();
  const placed = place(battle, { x: 1, y: 1 }, { x: 9, y: 9 });
  const greased = castGrease(placed, hero.id, [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 2 }], { random: () => 0.5 });
  const ready = {
    ...greased,
    actors: greased.actors.map(actor => (actor.id === hero.id
      ? { ...actor, combat: { ...actor.combat, actionUsed: false, movementUsed: 0 } }
      : actor)),
  };
  const result = autoAct(ready, hero.id, { random: sequence(0.9, 0.5, 0.5) });
  const moved = result.battle.actors.find(actor => actor.id === hero.id);
  assert.ok(moved.position, '英雄应当移动过');
  assert.notDeepEqual(moved.position, { x: 2, y: 1 });
  assert.notDeepEqual(moved.position, { x: 3, y: 1 });
  assert.notDeepEqual(moved.position, { x: 1, y: 2 });
});

test('没有别的安全格时仍会行动', () => {
  const { battle, hero } = setup();
  const placed = place(battle, { x: 1, y: 1 }, { x: 9, y: 9 });
  const greased = castGrease(placed, hero.id, [{ x: 2, y: 1 }, { x: 3, y: 1 }], { random: () => 0.5 });
  const ready = {
    ...greased,
    actors: greased.actors.map(actor => (actor.id === hero.id
      ? { ...actor, combat: { ...actor.combat, actionUsed: false, movementUsed: 0 } }
      : actor)),
  };
  const result = autoAct(ready, hero.id, { random: sequence(0.9, 0.5, 0.5) });
  assert.ok(result.kind, '自动行动应当给出一个动作类型');
});
