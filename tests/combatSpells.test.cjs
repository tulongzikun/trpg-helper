const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { currentActorId, endTurn, startCombat } = require('../apps/web/src/combat.ts');
const { castSpell } = require('../apps/web/src/combatSpells.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot() {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '米拉', species: '人类', characterClass: '法师', level: 5,
      abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
      maxHp: 28, armorClass: 12, speedFt: 30, actions: '', notes: '', details: {},
    },
  };
}

function setup(count = 2) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '法术', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monsters = battle.actors.filter(actor => actor.side === '敌方');
  const initiatives = { [hero.id]: 20 };
  monsters.forEach((monster, index) => { initiatives[monster.id] = 10 - index; });
  const started = startCombat(battle, initiatives);
  return { battle: started, hero, monsters };
}

test('豁免法术对多个目标结算并消耗动作', () => {
  const { battle, hero, monsters } = setup();
  const result = castSpell(battle, {
    casterId: hero.id, spell: '燃烧之手', level: 1,
    save: { ability: 'dex', dc: 15, targetIds: monsters.map(monster => monster.id), damageExpression: '2d6', damageType: '火焰' },
  }, { random: sequence(0.9, 0.5, 0.1, 0.5) });
  assert.ok(result.results.some(text => text.includes('施放「燃烧之手」（1 环）')));
  assert.ok(result.results.some(text => text.includes('范围效果结算')));
  const actor = result.battle.actors.find(item => item.id === hero.id);
  assert.equal(actor.combat.actionUsed, true);
});

test('法术攻击按攻击检定命中并只消耗一次动作', () => {
  const { battle, hero, monsters } = setup(1);
  const result = castSpell(battle, {
    casterId: hero.id, spell: '火焰箭', level: 0,
    attack: { targetId: monsters[0].id, attackBonus: 7, damageExpression: '1d10', damageType: '火焰' },
  }, { random: sequence(0.5, 0.5) });
  assert.ok(result.results.some(text => text.includes('（戏法）')));
  assert.ok(result.results.some(text => /命中|未命中/.test(text)));
});

test('带专注的法术写入专注状态', () => {
  const { battle, hero, monsters } = setup(1);
  const result = castSpell(battle, {
    casterId: hero.id, spell: '灼热射线', level: 2, concentration: true,
    attack: { targetId: monsters[0].id, attackBonus: 7, damageExpression: '2d6', damageType: '火焰' },
  }, { random: sequence(0.5, 0.5) });
  const actor = result.battle.actors.find(item => item.id === hero.id);
  assert.equal(actor.combat.concentration.spell, '灼热射线');
  assert.ok(result.results.some(text => text.includes('专注')));
});

test('缺少名称、环阶非法与结算方式缺失都会被拒绝', () => {
  const { battle, hero, monsters } = setup(1);
  assert.throws(() => castSpell(battle, { casterId: hero.id, spell: '  ', level: 1, attack: { targetId: monsters[0].id, attackBonus: 5, damageExpression: '1d8', damageType: '火焰' } }), /请填写法术名称/);
  assert.throws(() => castSpell(battle, { casterId: hero.id, spell: '火花', level: 12, attack: { targetId: monsters[0].id, attackBonus: 5, damageExpression: '1d8', damageType: '火焰' } }), /法术环阶须为 0 至 9 的整数/);
  assert.throws(() => castSpell(battle, { casterId: hero.id, spell: '火花', level: 0 }), /请选择法术的结算方式/);
});

test('非当前回合单位不能施法', () => {
  const { battle, monsters } = setup(1);
  assert.throws(() => castSpell(battle, {
    casterId: monsters[0].id, spell: '魔法飞弹', level: 1,
    attack: { targetId: battle.actors.find(actor => actor.side === '友方').id, attackBonus: 4, damageExpression: '1d4', damageType: '力场' },
  }), /只有当前回合的单位可以施法/);
});

test('附赠动作施法不占用动作', () => {
  const { battle, hero, monsters } = setup(1);
  const result = castSpell(battle, {
    casterId: hero.id, spell: '冰刃', level: 0, cost: 'bonus',
    attack: { targetId: monsters[0].id, attackBonus: 7, damageExpression: '1d8', damageType: '寒冷' },
  }, { random: sequence(0.5, 0.5) });
  const actor = result.battle.actors.find(item => item.id === hero.id);
  assert.equal(actor.combat.bonusUsed, true);
  assert.equal(actor.combat.actionUsed, false);
});
