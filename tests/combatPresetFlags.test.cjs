const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, saveAttackPreset, attackWithPreset, toggleWallCell, configureGrid, moveActorToCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `pp-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++ % values.length]; };

function hero(equipment) {
  const sheet = { name: '艾拉', level: 5, characterClass: '战士', abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 }, details: { equipment, fightingStyle: '' }, actions: '' };
  return { sheet };
}

function setup(equipment = '巨剑', monsterX = 1) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '预设', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const foe = { ...base.actors[0], id: 'foe', name: '雾影兽', currentHp: 200, maxHp: 200 };
  const pc = { ...foe, id: 'hero', name: '艾拉', side: '友方', characterSnapshot: hero(equipment) };
  let battle = configureGrid({ ...base, actors: [pc, foe] }, { width: 12, height: 8, cellFt: 5 });
  battle = startCombat(battle, { hero: 20, foe: 10 });
  battle = moveActorToCell(battle, 'hero', 0, 0);
  battle = moveActorToCell(battle, 'foe', monsterX, 0);
  return battle;
}

test('保存时保留武器与战术参数', () => {
  const battle = saveAttackPreset(setup(), { name: '重击', attackerId: 'hero', targetId: 'foe', attackBonus: 5, damageExpression: '2d6+3', damageType: '挥砍', range: 'melee', weaponId: 'weapon:巨剑', powerAttack: true, twoHanded: true }, ids()).battle;
  const preset = battle.attackPresets[0];
  assert.equal(preset.weaponId, 'weapon:巨剑');
  assert.equal(preset.powerAttack, true);
  assert.equal(preset.twoHanded, true);
  assert.equal(preset.sharpshooter, undefined);
});

test('一键攻击沿用强力攻击的 -5/+10', () => {
  let battle = saveAttackPreset(setup(), { name: '重击', attackerId: 'hero', targetId: 'foe', attackBonus: 5, damageExpression: '2d6+3', damageType: '挥砍', range: 'melee', weaponId: 'weapon:巨剑', powerAttack: true }, ids()).battle;
  const result = attackWithPreset(battle, battle.attackPresets[0].id, { random: sequence(0.6, 0.1, 0.1) });
  assert.match(result.outcome.detail ?? result.battle.combat.log.at(-1).detail ?? '', /强力攻击/);
  assert.equal(result.outcome.total, 13 + 5 - 5);
});

test('一键攻击沿用双手持用的伤害骰', () => {
  const battle = saveAttackPreset(setup('长剑'), { name: '双手劈', attackerId: 'hero', targetId: 'foe', attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', weaponId: 'weapon:长剑', twoHanded: true }, ids()).battle;
  const result = attackWithPreset(battle, battle.attackPresets[0].id, { random: sequence(0.6, 0.6) });
  assert.match(result.battle.combat.log.at(-1).detail ?? '', /双手持用：1d10\+3/);
});

test('武器不在攻击来源里时拒绝保存', () => {
  assert.throws(() => saveAttackPreset(setup(), { name: '乱写', attackerId: 'hero', targetId: 'foe', attackBonus: 5, damageExpression: '1d8', damageType: '挥砍', range: 'melee', weaponId: 'weapon:不存在' }, ids()), /常用攻击的武器无效。/);
});

test('没有战术参数时保持原行为', () => {
  const battle = saveAttackPreset(setup(), { name: '普通', attackerId: 'hero', targetId: 'foe', attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee' }, ids()).battle;
  const result = attackWithPreset(battle, battle.attackPresets[0].id, { random: sequence(0.6, 0.5) });
  assert.equal(result.outcome.total, 13 + 5);
});
