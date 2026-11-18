const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, moveActorToCell, opportunityAttack, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

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
  const base = addMonsters(emptyStore(), card, { newBattleName: '目盲借机', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  // 让敌人先行动，这样它可以移动触发借机攻击
  const started = startCombat(battle, { [foe.id]: 20, [hero.id]: 10 });
  let placed = configureGrid(started, { width: 8, height: 8, cellFt: 5 });
  placed = {
    ...placed,
    actors: placed.actors.map(actor => (actor.id === hero.id
      ? { ...actor, position: { x: 0, y: 0 } }
      : { ...actor, position: { x: 0, y: 1 } })),
  };
  return { battle: placed, hero, foe };
}

test('目盲的单位无法借机攻击', () => {
  const { battle, hero, foe } = setup();
  const moved = moveActorToCell(battle, foe.id, 0, 3);
  assert.ok((moved.combat.pendingOpportunity ?? []).some(item => item.reactorId === hero.id), '应当产生借机攻击提示');
  const blinded = {
    ...moved,
    actors: moved.actors.map(actor => (actor.id === hero.id
      ? { ...actor, combat: { ...actor.combat, conditions: [...(actor.combat?.conditions ?? []), '目盲'] } }
      : actor)),
  };
  assert.throws(() => opportunityAttack(blinded, hero.id, {}, { random: sequence(0.5) }), /看不见目标，无法进行借机攻击。/);
});

test('目盲解除后可以正常借机攻击', () => {
  const { battle, hero, foe } = setup();
  const moved = moveActorToCell(battle, foe.id, 0, 3);
  const result = opportunityAttack(moved, hero.id, {}, { random: sequence(0.9, 0.5) });
  assert.ok(result.outcome);
  assert.equal((result.battle.combat.pendingOpportunity ?? []).some(item => item.reactorId === hero.id), false);
});
