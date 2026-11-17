const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, currentActorId, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };
const character = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: { name: '艾拉', species: '人类', characterClass: '战士', level: 5, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '' },
};

function setup() {
  const base = addMonsters(emptyStore(), card, { newBattleName: '附伤测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, character, { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monster = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  return { battle: started, hero, monster };
}

const base = {
  attackBonus: 5,
  damageExpression: '1d8+3',
  damageType: '挥砍',
  range: 'melee',
  distanceFt: 5,
};

test('额外伤害骰会追加到总伤害并写进日志', () => {
  const { battle, hero, monster } = setup();
  const before = monster.currentHp;
  const result = attack(battle, { ...base, attackerId: hero.id, targetId: monster.id, extraDamageExpression: '1d6', extraDamageType: '火焰' }, { random: sequence(0.7, 0.5, 0) });
  const outcome = result.outcome;
  assert.equal(outcome.hit, true);
  assert.equal(outcome.critical, false);
  assert.equal(outcome.extraDamage, 1, '1d6 掷出 1');
  assert.equal(outcome.damage, 9, '1d8+3 掷出 8，加上 1 点火焰');
  assert.equal(currentActorId(result.battle), hero.id);
  const log = result.battle.combat.log.at(-1);
  assert.match(log.text, /命中，造成 9 点伤害（含额外 1 点火焰伤害）/);
  assert.match(log.detail, /额外 1 点火焰伤害/);
  assert.equal(result.battle.actors.find(actor => actor.id === monster.id).currentHp, before - 9);
});

test('重击时额外伤害骰一起翻倍', () => {
  const { battle, hero, monster } = setup();
  const result = attack(battle, { ...base, attackerId: hero.id, targetId: monster.id, extraDamageExpression: '1d6', extraDamageType: '火焰' }, { random: sequence(0.99, 0, 0, 0, 0) });
  assert.equal(result.outcome.critical, true);
  assert.equal(result.outcome.extraDamage, 2, '1d6 在重击时掷两次，各为 1');
  assert.equal(result.outcome.damage, 7, '2d8 各掷出 1，共 5，加上 2 点火焰');
});

test('关闭翻倍开关后额外伤害在重击时只掷一次', () => {
  const { battle, hero, monster } = setup();
  const result = attack(battle, { ...base, attackerId: hero.id, targetId: monster.id, extraDamageExpression: '1d6', extraDamageType: '火焰', extraDamageCritical: false }, { random: sequence(0.99, 0, 0, 0) });
  assert.equal(result.outcome.critical, true);
  assert.equal(result.outcome.extraDamage, 1);
});

test('抗性只作用于额外伤害自己的类型', () => {
  const { battle, hero, monster } = setup();
  const resisted = structuredClone(battle);
  const target = resisted.actors.find(actor => actor.id === monster.id);
  target.template.damageResistances = ['火焰'];
  const result = attack(resisted, { ...base, attackerId: hero.id, targetId: target.id, extraDamageExpression: '2d6', extraDamageType: '火焰' }, { random: sequence(0.7, 0.5, 0.5, 0.5) });
  assert.equal(result.outcome.damage, 12, '8 点挥砍全额 + 8 点火焰减半为 4');
  assert.equal(result.outcome.extraDamage, 4);
  assert.match(result.battle.combat.log.at(-1).detail, /抗性/);
});

test('额外伤害的骰式与类型会被校验', () => {
  const { battle, hero, monster } = setup();
  assert.throws(() => attack(battle, { ...base, attackerId: hero.id, targetId: monster.id, extraDamageExpression: '1d6' }), /请选择额外伤害的类型。/);
  assert.throws(() => attack(battle, { ...base, attackerId: hero.id, targetId: monster.id, extraDamageExpression: '1d6', extraDamageType: '不存在' }), /请选择额外伤害的类型。/);
  assert.throws(() => attack(battle, { ...base, attackerId: hero.id, targetId: monster.id, extraDamageExpression: 'abc', extraDamageType: '火焰' }), /伤害骰格式无效/);
});

