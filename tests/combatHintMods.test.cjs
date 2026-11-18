const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attackHints, configureGrid, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;

function snapshot() {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '艾拉', species: '人类', characterClass: '战士', level: 5,
      abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
      maxHp: 44, armorClass: 16, speedFt: 30,
      actions: '长剑：+6 命中，1d8+3 挥砍伤害，近战 5 尺', notes: '',
      details: { equipment: '长剑' },
    },
  };
}

function setup() {
  const base = addMonsters(emptyStore(), card, { newBattleName: '提示', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [foe.id]: 10 });
  const placed = {
    ...configureGrid(started, { width: 8, height: 8, cellFt: 5 }),
    actors: started.actors.map(actor => (actor.id === hero.id
      ? { ...actor, position: { x: 1, y: 1 } }
      : { ...actor, position: { x: 1, y: 2 } })),
  };
  return { battle: placed, hero, foe };
}

function withCondition(battle, actorId, condition) {
  return {
    ...battle,
    actors: battle.actors.map(actor => (actor.id === actorId
      ? { ...actor, combat: { ...actor.combat, conditions: [...(actor.combat?.conditions ?? []), condition] } }
      : actor)),
  };
}

test('目标倒地时提示会说明近战优势', () => {
  const { battle, hero, foe } = setup();
  const hinted = withCondition(battle, foe.id, '倒地');
  const hints = attackHints(hinted, hero.id, foe.id, 'melee');
  assert.ok(hints.some(hint => hint.includes('目标倒地（近战）')), hints.join(' | '));
});

test('攻击者倒地时提示会说明劣势', () => {
  const { battle, hero, foe } = setup();
  const hinted = withCondition(battle, hero.id, '倒地');
  const hints = attackHints(hinted, hero.id, foe.id, 'melee');
  assert.ok(hints.some(hint => hint.includes('攻击方劣势') || hint.includes('倒地')), hints.join(' | '));
});

test('没有任何状态时不会凭空多出优劣势提示', () => {
  const { battle, hero, foe } = setup();
  const hints = attackHints(battle, hero.id, foe.id, 'melee');
  assert.deepEqual(hints, []);
});
