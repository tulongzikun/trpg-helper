const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newDraft } = require('../apps/web/src/characters.ts');
const {
  rageUses, rageDamageBonus, weaponMasteryLimit, barbarianState, weaponMasteryError,
} = require('../apps/web/src/barbarianFeatures.ts');

function barbarian(level, patch = {}) {
  const d = newDraft();
  d.level = level;
  d.abilities = { str: 18, dex: 14, con: 16, int: 10, wis: 12, cha: 8 };
  d.details.fighterCalculator = {
    species: '人类', elfLineage: '', armor: 'none', shield: false,
    characterClass: '野蛮人', subclass: 'berserker', classSkills: ['运动', '察觉'], ...patch,
  };
  return d;
}

test('狂暴次数按等级提升并提供短休恢复一次', () => {
  assert.equal(rageUses(1), 2);
  assert.equal(rageUses(3), 3);
  assert.equal(rageUses(6), 4);
  assert.equal(rageUses(12), 5);
  assert.equal(rageUses(17), 6);
  const state = barbarianState(barbarian(6));
  assert.equal(state.rage.uses, 4);
  assert.equal(state.rage.damage, 2);
  assert.equal(state.rage.shortRestOne, true);
});

test('狂暴伤害加值在 9 级与 16 级提升', () => {
  assert.equal(rageDamageBonus(8), 2);
  assert.equal(rageDamageBonus(9), 3);
  assert.equal(rageDamageBonus(15), 3);
  assert.equal(rageDamageBonus(16), 4);
});

test('武器精通上限按等级提升且校验数量与重复', () => {
  assert.equal(weaponMasteryLimit(1), 2);
  assert.equal(weaponMasteryLimit(4), 3);
  assert.equal(weaponMasteryLimit(10), 4);
  assert.equal(weaponMasteryLimit(16), 5);

  const ok = barbarian(4, { weaponMastery: ['战斧', '巨斧', '长剑'] });
  assert.equal(weaponMasteryError(ok), null);
  assert.deepEqual(barbarianState(ok).weaponMastery.selected, ['战斧', '巨斧', '长剑']);

  assert.match(weaponMasteryError(barbarian(4, { weaponMastery: ['战斧', '巨斧', '长剑', '短剑'] })), /最多选择 3 种/);
  assert.match(weaponMasteryError(barbarian(4, { weaponMastery: ['战斧', '战斧'] })), /不能重复/);
  assert.match(weaponMasteryError(barbarian(4, { weaponMastery: ['长弓'] })), /简易或军用近战武器/);
});

test('无甲防御与快速移动按护甲和等级计算', () => {
  const d = barbarian(5);
  const state = barbarianState(d);
  assert.equal(state.unarmoredDefense, 10 + 2 + 3);
  assert.equal(state.fastMovement, true);

  const heavy = barbarian(5, { armor: 'chain' });
  assert.equal(barbarianState(heavy).unarmoredDefense, null);
  assert.equal(barbarianState(heavy).fastMovement, false);

  const shielded = barbarian(1, { shield: true });
  assert.equal(barbarianState(shielded).unarmoredDefense, 10 + 2 + 3 + 2);
});

test('高等级特性状态按等级开放', () => {
  const d = barbarian(18, { subclass: 'zealot' });
  const state = barbarianState(d);
  assert.equal(state.feralInstinct, true);
  assert.equal(state.instinctivePounce, true);
  assert.equal(state.brutalStrike.die, '2d10');
  assert.equal(state.relentlessRage, true);
  assert.equal(state.persistentRage, true);
  assert.deepEqual(state.indomitableMight, { floor: 18 });
  assert.equal(state.epicBoon, false);
  assert.equal(state.primalChampion, null);

  const level20 = barbarianState(barbarian(20, { subclass: 'zealot' }));
  assert.equal(level20.epicBoon, true);
  assert.deepEqual(level20.primalChampion, { strength: 4, constitution: 4, cap: 25 });
});

test('非野蛮人不返回野蛮人状态', () => {
  const d = newDraft();
  d.level = 5;
  d.details.fighterCalculator = { species: '人类', elfLineage: '', armor: 'none', shield: false, characterClass: '游侠' };
  assert.equal(barbarianState(d), null);
  assert.equal(weaponMasteryError(d), null);
});
