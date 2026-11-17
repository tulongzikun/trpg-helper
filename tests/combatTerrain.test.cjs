const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, moveActorToCell, setTerrain, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (equipment) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-terrain', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: { equipment },
  },
});

function setup(equipment, cellX = 2) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '地形', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(equipment), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const friend = withHero.actors.find(actor => actor.side === '友方');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  let next = startCombat(withHero, { [friend.id]: 20, [monster.id]: 10 });
  next = configureGrid(next, { width: Math.max(10, cellX + 2), height: 3, cellFt: 5 });
  next = moveActorToCell(next, friend.id, 1, 1);
  next = moveActorToCell(next, monster.id, cellX, 1);
  return { battle: next, friend, monster };
}

test('水下让远程攻击检定劣势', () => {
  const { battle, friend, monster } = setup('短弓', 3);
  const underwater = setTerrain(battle, 'underwater');
  const result = attack(underwater, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '穿刺', weaponId: 'weapon:短弓', range: 'ranged' }, { random: sequence(0.9, 0.1), makeId: ids() });
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.ok(result.outcome.notes.some(note => note.includes('水下')));
  assert.match(result.battle.combat.log.at(-1).detail, /水下：远程攻击检定劣势/);
});

test('水下不影响近战攻击', () => {
  const { battle, friend, monster } = setup('长剑');
  const underwater = setTerrain(battle, 'underwater');
  const result = attack(underwater, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', weaponId: 'weapon:长剑' }, { random: sequence(0.5), makeId: ids() });
  assert.equal(result.outcome.mode, 'normal');
});

test('水下远程超出 30 尺自动失手', () => {
  const { battle, friend, monster } = setup('短弓', 8);
  const underwater = setTerrain(battle, 'underwater');
  const result = attack(underwater, { attackerId: friend.id, targetId: monster.id, attackBonus: 20, damageExpression: '1d8+3', damageType: '穿刺', weaponId: 'weapon:短弓', range: 'ranged' }, { random: sequence(0.99), makeId: ids() });
  assert.equal(result.outcome.hit, false);
  assert.equal(result.outcome.damage, 0);
  assert.ok(result.outcome.notes.some(note => note.includes('自动失手')));
});

test('回到普通地形后远程恢复正常', () => {
  const { battle, friend, monster } = setup('短弓', 3);
  const underwater = setTerrain(battle, 'underwater');
  const normal = setTerrain(underwater, 'normal');
  assert.equal(normal.terrain, undefined);
  const result = attack(normal, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '穿刺', weaponId: 'weapon:短弓', range: 'ranged' }, { random: sequence(0.5), makeId: ids() });
  assert.equal(result.outcome.mode, 'normal');
});

test('地形日志与非法取值', () => {
  const { battle } = setup('短弓', 3);
  const underwater = setTerrain(battle, 'underwater');
  assert.match(underwater.combat.log.at(-1).text, /水下环境/);
  assert.equal(underwater.terrain, 'underwater');
  const normal = setTerrain(underwater, 'normal');
  assert.match(normal.combat.log.at(-1).text, /普通地形/);
  assert.throws(() => setTerrain(battle, 'lava'), /战场地形取值无效/);
});
