const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newDraft } = require('../apps/web/src/characters.ts');
const {
  beastMasterState, feyWandererState, gloomStalkerState, hunterState,
} = require('../apps/web/src/rangerSubclasses.ts');

function ranger(level, subclass, patch = {}) {
  const d = newDraft();
  d.level = level;
  d.abilities = { str: 10, dex: 16, con: 14, int: 10, wis: 16, cha: 12 };
  d.details.fighterCalculator = {
    species: '人类', elfLineage: '', armor: 'none', shield: false,
    characterClass: '游侠', subclass, classSkills: ['察觉', '求生'], ...patch,
  };
  return d;
}

test('驯兽师：三张原初野兽数据卡按等级与感知计算', () => {
  const land = beastMasterState(ranger(6, 'beast-master', { beastCompanion: '大地' }));
  assert.equal(land.choice, '大地');
  assert.equal(land.ac, 16);
  assert.equal(land.hp, 5 + 5 * 6);
  assert.match(land.speed, /40/);
  assert.equal(land.darkvision, 60);
  assert.equal(land.attackBonus, 6);
  assert.equal(land.spellDc, 14);
  assert.match(land.strike, /1d8\+2/);

  const sea = beastMasterState(ranger(6, 'beast-master', { beastCompanion: '海洋' }));
  assert.equal(sea.darkvision, 90);
  assert.match(sea.speed, /游泳 60/);
  assert.ok(sea.traits.some((x) => x.includes('受擒')));

  const sky = beastMasterState(ranger(6, 'beast-master', { beastCompanion: '天空' }));
  assert.equal(sky.hp, 4 + 4 * 6);
  assert.match(sky.speed, /飞行 60/);
  assert.ok(sky.traits.some((x) => x.includes('飞掠')));

  const none = beastMasterState(ranger(6, 'beast-master'));
  assert.equal(none.choice, null);
  assert.equal(none.hp, null);
  assert.equal(none.options.length, 3);

  const level11 = beastMasterState(ranger(11, 'beast-master', { beastCompanion: '大地' }));
  assert.equal(level11.bestialFury, true);
  assert.equal(level11.advancedTraining, true);
  assert.equal(level11.spellSharing, false);
});

test('妖精漫游者：哀惧灵袭、精野之赐与雾行漫游', () => {
  const level3 = feyWandererState(ranger(3, 'fey-wanderer', { feyGift: 4 }));
  assert.equal(level3.dreadfulDie, '1d4');
  assert.equal(level3.gift, 4);
  assert.match(level3.giftText, /影子/);
  assert.equal(level3.mistyStepFreeUses, 0);
  assert.equal(level3.feyReinforcements, false);

  const level11 = feyWandererState(ranger(11, 'fey-wanderer'));
  assert.equal(level11.dreadfulDie, '1d6');
  assert.equal(level11.feyReinforcements, true);
  assert.equal(level11.beguilingStrike, true);

  const level15 = feyWandererState(ranger(15, 'fey-wanderer'));
  assert.equal(level15.mistyStepFreeUses, 3);
});

test('幽域追猎者：恐惧打击次数与骰子随等级提升', () => {
  const level3 = gloomStalkerState(ranger(3, 'gloom-stalker'));
  assert.equal(level3.dreadAmbusherUses, 3);
  assert.equal(level3.dreadStrikeDie, '2d6');
  assert.equal(level3.initiativeBonus, 3);
  assert.equal(level3.ironMind, false);

  const level11 = gloomStalkerState(ranger(11, 'gloom-stalker'));
  assert.equal(level11.dreadStrikeDie, '2d8');
  assert.equal(level11.stalkersFlurry, true);

  const level15 = gloomStalkerState(ranger(15, 'gloom-stalker'));
  assert.equal(level15.ironMind, true);
  assert.equal(level15.shadowyDodge, true);
});

test('猎人：猎杀技艺与防守战术选择及高阶特性', () => {
  const level3 = hunterState(ranger(3, 'hunter', { hunterPrey: '巨像屠夫', hunterDefense: '冲出重围' }));
  assert.equal(level3.prey, '巨像屠夫');
  assert.equal(level3.defense, '冲出重围');
  assert.deepEqual(level3.preyOptions, ['巨像屠夫', '灭族者']);
  assert.deepEqual(level3.defenseOptions, ['冲出重围', '多重防御']);
  assert.equal(level3.superiorPrey, false);

  const invalid = hunterState(ranger(3, 'hunter', { hunterPrey: '不存在的技艺' }));
  assert.equal(invalid.prey, '');

  const level11 = hunterState(ranger(11, 'hunter'));
  assert.equal(level11.superiorPrey, true);
  assert.equal(level11.superiorDefense, false);

  const level15 = hunterState(ranger(15, 'hunter'));
  assert.equal(level15.superiorDefense, true);
});

test('游侠子职不匹配时返回 null', () => {
  assert.equal(beastMasterState(ranger(6, 'hunter')), null);
  assert.equal(feyWandererState(ranger(6, 'gloom-stalker')), null);
  assert.equal(gloomStalkerState(ranger(6, 'fey-wanderer')), null);
  assert.equal(hunterState(ranger(6, 'beast-master')), null);
});
