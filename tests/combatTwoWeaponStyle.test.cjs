const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, offhandAttack, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot(config) {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '双刃', species: '人类', characterClass: '战士', level: 5,
      abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8 },
      maxHp: 44, armorClass: 16, speedFt: 30, actions: '', notes: '',
      details: { equipment: '匕首、短剑', fighterCalculator: config },
    },
  };
}

function setup(config) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '风格', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(config), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monster = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  return { battle: started, hero, monster };
}

const main = { attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍' };

test('双武器战斗风格把属性调整值加入副手伤害', () => {
  const { battle, hero, monster } = setup({ characterClass: '战士', fightingStyles: ['双武器战斗'] });
  const afterAttack = attack(battle, { ...main, attackerId: hero.id, targetId: monster.id }, { random: sequence(0.5, 0.5) }).battle;
  const result = offhandAttack(afterAttack, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:匕首' }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.damage, 6, '1d4 掷出 3，加 +3 调整值');
  assert.ok(result.battle.combat.log.some(item => /双武器战斗风格把属性调整值加入伤害/.test(item.text)));
});

test('没有战斗风格时副手伤害不加调整值', () => {
  const { battle, hero, monster } = setup({ characterClass: '战士', fightingStyles: ['防御'] });
  const afterAttack = attack(battle, { ...main, attackerId: hero.id, targetId: monster.id }, { random: sequence(0.5, 0.5) }).battle;
  const result = offhandAttack(afterAttack, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:匕首' }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.damage, 3);
});

test('游侠的单一战斗风格字段同样生效', () => {
  const { battle, hero, monster } = setup({ characterClass: '游侠', fightingStyle: '双武器战斗' });
  const afterAttack = attack(battle, { ...main, attackerId: hero.id, targetId: monster.id }, { random: sequence(0.5, 0.5) }).battle;
  const result = offhandAttack(afterAttack, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:短剑' }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.damage, 7, '1d6 掷出 4，加 +3 调整值');
});

test('未配置 fighterCalculator 时按无风格处理', () => {
  const { battle, hero, monster } = setup(undefined);
  const afterAttack = attack(battle, { ...main, attackerId: hero.id, targetId: monster.id }, { random: sequence(0.5, 0.5) }).battle;
  const result = offhandAttack(afterAttack, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:匕首' }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.damage, 3);
  assert.ok(result.battle.combat.log.some(item => /伤害不使用属性调整值/.test(item.text)));
});
