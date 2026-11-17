const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter, configureGrid } = require('../apps/web/src/battle.ts');
const { attack, configureGrid: grid, moveActorToCell, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (equipment, actions) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-sharpshooter', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '射手', species: '人类', characterClass: '游侠', level: 5,
    abilities: { str: 12, dex: 18, con: 14, int: 10, wis: 14, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30,
    actions: actions ?? '短弓：+7 命中，1d6+3 穿刺伤害，射程 80/320 尺\n长剑：+5 命中，1d8+1 挥砍伤害，触及 5 尺',
    notes: '', details: { equipment },
  },
});

function setup(cellX = 2) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '神射手', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero('短弓、长剑'), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  let started = startCombat(withHero, initiatives);
  const friend = started.actors.find(actor => actor.side === '友方');
  const monster = started.actors.find(actor => actor.side === '敌方');
  started = grid(started, { width: Math.max(20, cellX + 2), height: 10, cellFt: 5 });
  started = moveActorToCell(started, friend.id, 1, 1);
  started = moveActorToCell(started, monster.id, 1 + cellX, 1);
  const tough = structuredClone(started);
  const target = tough.actors.find(actor => actor.id === monster.id);
  target.maxHp = 200;
  target.currentHp = 200;
  target.template = { ...target.template, armorClass: 16 };
  return { battle: tough, friend, monster };
}

const options = (friend, monster, extra = {}) => ({ attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '穿刺', range: 'ranged', weaponId: 'weapon:短弓', ...extra });

test('神射手忽略半掩体，攻击不再因 AC 提升而落空', () => {
  const { battle, friend, monster } = setup();
  const covered = attack(battle, options(friend, monster, { cover: '半掩体' }), { random: sequence(0.55) });
  assert.equal(covered.outcome.natural, 12);
  assert.equal(covered.outcome.hit, false);
  const ignored = attack(battle, options(friend, monster, { cover: '半掩体', sharpshooter: true }), { random: sequence(0.55) });
  assert.equal(ignored.outcome.hit, true);
  assert.match(ignored.battle.combat.log.at(-1).detail, /神射手：忽略掩体与远程射程劣势/);
});

test('神射手忽略超出常规射程的劣势', () => {
  const { battle, friend, monster } = setup(30);
  const normal = attack(battle, options(friend, monster), { random: sequence(0.9, 0.1) });
  assert.equal(normal.outcome.mode, 'disadvantage');
  const sharp = attack(battle, options(friend, monster, { sharpshooter: true }), { random: sequence(0.9) });
  assert.equal(sharp.outcome.mode, 'normal');
});

test('近战武器不能使用神射手', () => {
  const { battle, friend, monster } = setup(1);
  assert.throws(() => attack(battle, { ...options(friend, monster, { sharpshooter: true }), range: 'melee', weaponId: 'weapon:长剑' }, { random: sequence(0.9) }), /只有远程或投掷武器可以使用神射手/);
});

test('未指定武器时拒绝神射手', () => {
  const { battle, friend, monster } = setup();
  const { weaponId, ...rest } = options(friend, monster, { sharpshooter: true });
  assert.throws(() => attack(battle, rest, { random: sequence(0.9) }), /只有远程或投掷武器可以使用神射手/);
});

test('全掩体即使开启神射手也仍然拦截', () => {
  const { battle, friend, monster } = setup();
  assert.throws(() => attack(battle, options(friend, monster, { cover: '全掩体', sharpshooter: true }), { random: sequence(0.9) }), /全掩体/);
});
