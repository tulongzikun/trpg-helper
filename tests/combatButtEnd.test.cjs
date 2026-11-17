const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, buttEndAttack, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot(equipment) {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '布鲁诺', species: '人类', characterClass: '战士', level: 5,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
      maxHp: 44, armorClass: 16, speedFt: 30, actions: '', notes: '',
      details: { equipment },
    },
  };
}

function setup(equipment) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '柄端', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(equipment), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monster = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  return { battle: started, hero, monster };
}

const main = { attackBonus: 15, damageExpression: '1d10+3', damageType: '挥砍' };

test('长武器柄端攻击造成 1d4 加力量调整值的钝击伤害', () => {
  const { battle, hero, monster } = setup('戟');
  const result = buttEndAttack(battle, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:戟' }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.hit, true);
  assert.equal(result.outcome.damage, 6);
  const record = result.battle.combat.log.at(-1);
  assert.match(record.text, /命中/);
  assert.match(record.detail, /钝击/);
});

test('非长武器不能柄端攻击', () => {
  const { battle, hero, monster } = setup('长剑');
  assert.throws(() => buttEndAttack(battle, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:长剑' }, { random: sequence(0.5, 0.5) }), /只有长武器可以用柄端攻击/);
});

test('未指定武器时无法柄端攻击', () => {
  const { battle, hero, monster } = setup('戟');
  assert.throws(() => buttEndAttack(battle, { ...main, attackerId: hero.id, targetId: monster.id }, { random: sequence(0.5, 0.5) }), /请选择长武器/);
});

test('附赠动作已用后不能再柄端攻击', () => {
  const { battle, hero, monster } = setup('戟');
  const live = battle.actors.find(actor => actor.side === '敌方');
  live.currentHp = 200;
  live.maxHp = 200;
  const spent = attack(battle, { ...main, attackerId: hero.id, targetId: monster.id, cost: 'bonus' }, { random: sequence(0.5, 0.5) }).battle;
  assert.throws(() => buttEndAttack(spent, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:戟' }, { random: sequence(0.5, 0.5) }), /已经使用过附赠动作/);
});

test('长棍也可用且不触发武器精通', () => {
  const { battle, hero, monster } = setup('长棍');
  const result = buttEndAttack(battle, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:长棍' }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.damage, 6);
  const record = result.battle.combat.log.at(-1);
  assert.doesNotMatch(record.detail, /精通·/);
});
