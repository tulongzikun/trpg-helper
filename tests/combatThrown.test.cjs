const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, moveActorToCell, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (equipment) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-thrown', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 1,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 12, armorClass: 16, speedFt: 30, actions: '', notes: '', details: { equipment },
  },
});

function setup(equipment, monsterX = 3) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '投掷测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(equipment), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const friend = withHero.actors.find(actor => actor.side === '友方');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  let next = startCombat(withHero, { [friend.id]: 20, [monster.id]: 10 });
  next = configureGrid(next, { width: Math.max(10, monsterX + 2), height: 3, cellFt: 5 });
  next = moveActorToCell(next, friend.id, 0, 0);
  next = moveActorToCell(next, monster.id, monsterX, 0);
  return { battle: next, friend, monster };
}

test('投掷武器可以在常规射程内远程攻击', () => {
  const { battle, friend, monster } = setup('标枪');
  const result = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '穿刺', range: 'ranged', weaponId: 'weapon:标枪', distanceFt: 15 }, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.equal(result.outcome.mode, 'normal');
});

test('超出投掷常规射程但在最大射程内时攻击劣势', () => {
  const { battle, friend, monster } = setup('长矛', 7);
  const result = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '穿刺', range: 'ranged', weaponId: 'weapon:长矛' }, { random: sequence(0.9, 0.1, 0.5), makeId: ids() });
  assert.equal(result.outcome.mode, 'disadvantage');
});

test('超出投掷最大射程时报错', () => {
  const { battle, friend, monster } = setup('手斧', 14);
  assert.throws(() => attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '挥砍', range: 'ranged', weaponId: 'weapon:手斧' }, { random: sequence() }), /最大射程（60 尺）。/);
});

test('没有投掷特性的近战武器不能远程攻击', () => {
  const { battle, friend, monster } = setup('长剑', 7);
  assert.throws(() => attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'ranged', weaponId: 'weapon:长剑' }, { random: sequence() }), /该武器不能进行远程攻击。/);
});

test('不指定武器时远程攻击保持原行为', () => {
  const { battle, friend, monster } = setup('长剑', 7);
  const result = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'ranged', distanceFt: 200 }, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.equal(result.outcome.mode, 'normal');
});
