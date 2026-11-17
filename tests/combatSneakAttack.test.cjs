const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, moveActorToCell, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (characterClass, level) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: `char-${characterClass}`, revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: characterClass === '游荡者' ? '影刃' : '护卫', species: '人类', characterClass, level,
    abilities: { str: 12, dex: 16, con: 14, int: 12, wis: 12, cha: 10 },
    maxHp: 40, armorClass: 15, speedFt: 30, actions: '', notes: '', details: { equipment: '' },
  },
});

function setup(level, allyAt) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '偷袭', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const first = addCharacter(store, hero('游荡者', level), { battleId: battle.id, side: '友方' }, ids());
  const second = addCharacter(first.store, hero('战士', 5), { battleId: battle.id, side: '友方' }, ids());
  const withHero = second.store.battles[0];
  const rogue = withHero.actors.find(actor => actor.name === '影刃');
  const ally = withHero.actors.find(actor => actor.name === '护卫');
  const monsters = withHero.actors.filter(actor => actor.side === '敌方');
  const monster = monsters[0];
  const monster2 = monsters[1];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => {
    initiatives[actor.id] = actor.name === '影刃' ? 20 : actor.name === '护卫' ? 15 : 10 - index;
  });
  let next = startCombat(withHero, initiatives);
  next = configureGrid(next, { width: 10, height: 10, cellFt: 5 });
  next = moveActorToCell(next, rogue.id, 0, 0);
  next = moveActorToCell(next, monster.id, 1, 0);
  next = moveActorToCell(next, ally.id, allyAt.x, allyAt.y);
  return { battle: next, rogue, ally, monster, monster2 };
}

const strike = (battle, rogue, monster, mode, random) => attack(battle, {
  attackerId: rogue.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', mode,
}, { random, makeId: ids() });

test('游荡者拥有优势时附加偷袭伤害', () => {
  const { battle, rogue, monster } = setup(5, { x: 8, y: 8 });
  const result = strike(battle, rogue, monster, 'advantage', sequence(0.5, 0.5, 0.5, 0.5, 0.5, 0.5));
  assert.equal(result.outcome.damage, 20);
  assert.match(result.battle.combat.log.at(-1).detail, /偷袭 12 点挥砍伤害（3d6）/);
});

test('无优势且身旁没有同伴时不触发偷袭', () => {
  const { battle, rogue, monster } = setup(5, { x: 8, y: 8 });
  const result = strike(battle, rogue, monster, 'normal', sequence(0.5, 0.5, 0.5));
  assert.equal(result.outcome.damage, 8);
  assert.ok(!/偷袭/.test(result.battle.combat.log.at(-1).detail ?? ''));
});

test('同伴贴身目标时即使没有优势也能偷袭', () => {
  const { battle, rogue, monster } = setup(5, { x: 1, y: 1 });
  const result = strike(battle, rogue, monster, 'normal', sequence(0.5, 0.5, 0.5, 0.5, 0.5, 0.5));
  assert.equal(result.outcome.damage, 20);
  assert.match(result.battle.combat.log.at(-1).detail, /偷袭 12 点/);
});

test('11 级游荡者偷袭为 6d6', () => {
  const { battle, rogue, monster } = setup(11, { x: 1, y: 1 });
  const result = strike(battle, rogue, monster, 'normal', sequence(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5));
  assert.equal(result.outcome.damage, 32);
  assert.match(result.battle.combat.log.at(-1).detail, /偷袭 24 点挥砍伤害（6d6）/);
});

test('重击时偷袭骰翻倍', () => {
  const { battle, rogue, monster } = setup(5, { x: 1, y: 1 });
  const result = strike(battle, rogue, monster, 'normal', sequence(0.99, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5));
  assert.equal(result.outcome.critical, true);
  assert.match(result.battle.combat.log.at(-1).detail, /偷袭 24 点挥砍伤害（3d6，重击翻倍）/);
});

test('同一回合只能偷袭一次', () => {
  const { battle, rogue, monster, monster2 } = setup(5, { x: 1, y: 1 });
  const first = strike(battle, rogue, monster, 'normal', sequence(0.5, 0.5, 0.5, 0.5, 0.5, 0.5));
  assert.match(first.battle.combat.log.at(-1).detail, /偷袭 12 点/);
  const second = attack(first.battle, {
    attackerId: rogue.id, targetId: monster2.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', cost: 'bonus',
  }, { random: sequence(0.5, 0.5, 0.5, 0.5, 0.5, 0.5), makeId: ids() });
  assert.equal(second.outcome.damage, 8);
  assert.ok(!/偷袭/.test(second.battle.combat.log.at(-1).detail ?? ''));
});
