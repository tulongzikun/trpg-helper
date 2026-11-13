const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newDraft } = require('../apps/web/src/characters.ts');
const {
  favoredEnemyFreeUses, huntersMarkDie, rangerState, fightingStyleError, naturesVeilUses,
  rangerWeaponMasteryError, rangerWeapons, rangerWeaponMasteryLimit,
} = require('../apps/web/src/rangerFeatures.ts');

function ranger(level, patch = {}) {
  const d = newDraft();
  d.level = level;
  d.abilities = { str: 10, dex: 16, con: 14, int: 10, wis: 16, cha: 12 };
  d.details.fighterCalculator = {
    species: '人类', elfLineage: '', armor: 'none', shield: false,
    characterClass: '游侠', subclass: 'hunter', classSkills: ['察觉', '求生'], ...patch,
  };
  return d;
}

test('宿敌免费施法次数按等级提升', () => {
  assert.equal(favoredEnemyFreeUses(1), 2);
  assert.equal(favoredEnemyFreeUses(5), 3);
  assert.equal(favoredEnemyFreeUses(9), 4);
  assert.equal(favoredEnemyFreeUses(17), 6);
  assert.equal(favoredEnemyFreeUses(20), 6);
});

test('屠灭众敌把猎人印记额外伤害提升为 d10', () => {
  assert.equal(huntersMarkDie(19), 'd6');
  assert.equal(huntersMarkDie(20), 'd10');
});

test('越野、野性感官与自然面纱按等级开放', () => {
  const level5 = rangerState(ranger(5));
  assert.equal(level5.roving, false);
  assert.equal(level5.climbSwim, false);

  const level6 = rangerState(ranger(6));
  assert.equal(level6.roving, true);
  assert.equal(level6.rovingSpeedBonus, 10);
  assert.equal(level6.climbSwim, true);

  const heavy = rangerState(ranger(6, { armor: 'plate' }));
  assert.equal(heavy.roving, false);
  assert.equal(heavy.climbSwim, false);

  const level18 = rangerState(ranger(18));
  assert.equal(level18.feralSenses, 30);
  assert.equal(level18.relentlessHunter, true);
  assert.equal(level18.preciseHunter, true);
  assert.equal(level18.foeSlayer, false);
});

test('不知疲倦与自然面纱次数按感知调整值（最低 1）记录', () => {
  const level10 = rangerState(ranger(10));
  assert.equal(level10.tireless.uses, 3);
  assert.match(level10.tireless.tempHp, /1d8\+3/);
  assert.equal(level10.naturesVeil, null);

  const lowWis = ranger(14, {});
  lowWis.abilities.wis = 6;
  assert.equal(naturesVeilUses(lowWis), 1);
});

test('战斗风格校验德鲁伊教战士的两道戏法', () => {
  assert.equal(fightingStyleError(ranger(2)), null);
  assert.equal(fightingStyleError(ranger(2, { fightingStyle: '箭术' })), null);

  assert.match(fightingStyleError(ranger(2, { fightingStyle: '德鲁伊教战士' })), /2 个不重复/);
  assert.equal(fightingStyleError(ranger(2, { fightingStyle: '德鲁伊教战士', druidicCantrips: ['德鲁伊伎俩', '神导术'] })), null);
  assert.match(fightingStyleError(ranger(2, { fightingStyle: '德鲁伊教战士', druidicCantrips: ['神导术', '神导术'] })), /不能重复/);
  assert.match(fightingStyleError(ranger(2, { fightingStyle: '箭术', druidicCantrips: ['神导术'] })), /只有德鲁伊教战士/);
  assert.match(fightingStyleError(ranger(2, { fightingStyle: '不存在的风格' })), /战斗风格无效/);
});

test('游侠武器精通固定 2 种且校验重复与非法武器', () => {
  assert.equal(rangerWeaponMasteryLimit, 2);
  assert.equal(rangerWeapons.includes('长弓'), true);
  assert.equal(rangerWeapons.includes('长剑'), true);

  const ok = ranger(1, { weaponMastery: ['长弓', '短剑'] });
  assert.equal(rangerWeaponMasteryError(ok), null);
  assert.deepEqual(rangerState(ok).weaponMastery.selected, ['长弓', '短剑']);

  assert.match(rangerWeaponMasteryError(ranger(1, { weaponMastery: ['长弓', '短剑', '长剑'] })), /最多选择 2 种/);
  assert.match(rangerWeaponMasteryError(ranger(1, { weaponMastery: ['长弓', '长弓'] })), /不能重复/);
  assert.match(rangerWeaponMasteryError(ranger(1, { weaponMastery: ['不存在的武器'] })), /只能选择已列出/);
  assert.equal(rangerState(ranger(1)).weaponMastery.limit, 2);
});

test('19 级传奇恩惠记录名称且低等级不开放', () => {
  const high = rangerState(ranger(19));
  assert.equal(high.epicBoonAvailable, true);
  assert.equal(high.epicBoonName, '');
  assert.equal(rangerState(ranger(18)).epicBoonAvailable, false);
});
