const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, toggleDifficultCell, addHazard, setTerrain, setFlying, currentActorId } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot(name) {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name, species: '人类', characterClass: '战士', level: 5,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
      maxHp: 44, armorClass: 16, speedFt: 30, actions: '', notes: '',
      details: { equipment: '长剑' },
    },
  };
}

function setup() {
  const first = addMonsters(emptyStore(), card, { newBattleName: '飞行', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = first.battles[0];
  const withHero = addCharacter(first, snapshot('布鲁诺'), { battleId: base.id, side: '友方' }, ids()).store.battles[0];
  const hero = withHero.actors.find(actor => actor.characterSnapshot?.sheet.name === '布鲁诺');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  let battle = startCombat(withHero, { [hero.id]: 30, [monster.id]: 10 });
  battle = configureGrid(battle, { width: 10, height: 10, cellFt: 5 });
  battle = { ...battle, actors: battle.actors.map(actor => actor.id === hero.id ? { ...actor, position: { x: 0, y: 1 } } : actor.id === monster.id ? { ...actor, position: { x: 9, y: 9 } } : actor) };
  const live = id => battle.actors.find(item => item.id === id);
  return { battle, hero: live(hero.id), monster: live(monster.id) };
}

test('飞行忽略困难地形翻倍消耗', () => {
  const { battle, hero } = setup();
  const rough = toggleDifficultCell(battle, 1, 1);
  const walked = moveActorToCell(rough, hero.id, 1, 1);
  assert.equal(walked.actors.find(item => item.id === hero.id).combat.movementUsed, 10);
  const airborne = setFlying(rough, hero.id, true);
  const flown = moveActorToCell(airborne, hero.id, 1, 1);
  assert.equal(flown.actors.find(item => item.id === hero.id).combat.movementUsed, 5);
  assert.match(flown.combat.log.at(-1).text, /飞行忽略地形消耗/);
});

test('飞行单位不会受到危险地形伤害', () => {
  const { battle, hero } = setup();
  const hazard = addHazard(battle, { x: 1, y: 1, damageExpression: '1d6', damageType: '火焰' });
  const airborne = setFlying(hazard, hero.id, true);
  const flown = moveActorToCell(airborne, hero.id, 1, 1, { random: sequence(0.5) });
  assert.equal(flown.actors.find(item => item.id === hero.id).currentHp, 44);
  const walking = moveActorToCell(hazard, hero.id, 1, 1, { random: sequence(0.5) });
  assert.ok(walking.actors.find(item => item.id === hero.id).currentHp < 44);
});

test('飞行单位不会受到岩浆伤害', () => {
  const { battle, hero } = setup();
  const lava = setTerrain(battle, 'lava');
  const airborne = setFlying(lava, hero.id, true);
  const flown = moveActorToCell(airborne, hero.id, 1, 1, { random: sequence(0.5) });
  assert.equal(flown.actors.find(item => item.id === hero.id).currentHp, 44);
});

test('飞行单位在冰面上不会滑倒', () => {
  const { battle, hero } = setup();
  const ice = setTerrain(battle, 'ice');
  const airborne = setFlying(ice, hero.id, true);
  const flown = moveActorToCell(airborne, hero.id, 1, 1, { random: sequence(0) });
  const state = flown.actors.find(item => item.id === hero.id).combat;
  assert.equal(state.conditions.includes('倒地'), false);
});

test('落地后恢复地形消耗与危险伤害，并写日志', () => {
  const { battle, hero } = setup();
  const rough = toggleDifficultCell(battle, 1, 1);
  const airborne = setFlying(rough, hero.id, true);
  const landed = setFlying(airborne, hero.id, false);
  assert.match(landed.combat.log.at(-1).text, /落地/);
  const walked = moveActorToCell(landed, hero.id, 1, 1);
  assert.equal(walked.actors.find(item => item.id === hero.id).combat.movementUsed, 10);
});
