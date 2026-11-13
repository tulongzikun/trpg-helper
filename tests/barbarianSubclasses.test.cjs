const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newDraft } = require('../apps/web/src/characters.ts');
const {
  berserkerState, wildHeartState, worldTreeState, zealotState,
} = require('../apps/web/src/barbarianSubclasses.ts');

function barbarian(level, subclass, patch = {}) {
  const d = newDraft();
  d.level = level;
  d.abilities = { str: 18, dex: 14, con: 16, int: 10, wis: 12, cha: 8 };
  d.details.fighterCalculator = {
    species: '人类', elfLineage: '', armor: 'none', shield: false,
    characterClass: '野蛮人', subclass, classSkills: ['运动', '察觉'], ...patch,
  };
  return d;
}

test('狂战士：狂怒伤害、无我狂暴、报偿与威慑之姿按等级开放', () => {
  const level3 = berserkerState(barbarian(3, 'berserker'));
  assert.equal(level3.frenzyExtraDie, '2d6');
  assert.equal(level3.mindlessRage, false);
  assert.equal(level3.intimidatingPresence, null);

  const level9 = berserkerState(barbarian(9, 'berserker'));
  assert.equal(level9.frenzyExtraDie, '3d6');

  const level14 = berserkerState(barbarian(14, 'berserker'));
  assert.equal(level14.mindlessRage, true);
  assert.equal(level14.retaliation, true);
  assert.equal(level14.intimidatingPresence.usesPerLongRest, 1);
  assert.equal(level14.intimidatingPresence.resetByRage, true);
});

test('狂野之心：仪式、兽之形貌与兽力威能', () => {
  const level3 = wildHeartState(barbarian(3, 'wild-heart'));
  assert.deepEqual(level3.rituals, ['野兽感官', '动物交谈']);
  assert.equal(level3.aspect, '');
  assert.equal(level3.wildPower, null);

  const level10Owl = wildHeartState(barbarian(10, 'wild-heart', { wildAspect: '枭' }));
  assert.deepEqual(level10Owl.rituals, ['野兽感官', '动物交谈', '问道自然']);
  assert.equal(level10Owl.aspect, '枭');
  assert.equal(level10Owl.darkvision, 60);
  assert.equal(level10Owl.wildPower, null);

  const level14Panther = wildHeartState(barbarian(14, 'wild-heart', { wildAspect: '豹' }));
  assert.equal(level14Panther.climb, true);
  assert.deepEqual(level14Panther.wildPower.options, ['猎鹰', '雄狮', '角羊']);
});

test('世界树：临时生命值、根击千钧与奇旅传送', () => {
  const level10 = worldTreeState(barbarian(10, 'world-tree'));
  assert.equal(level10.vitalityTempHp, 10);
  assert.equal(level10.lifeGivingDie, '3d6');
  assert.equal(level10.reachBonus, 10);
  assert.equal(level10.greaterTeleport, null);

  const level14 = worldTreeState(barbarian(14, 'world-tree'));
  assert.equal(level14.teleportFt, 60);
  assert.deepEqual(level14.greaterTeleport, { ft: 150, creatures: 6 });
});

test('狂热者：神性之怒、治疗池与每长休一次的特性', () => {
  const level3 = zealotState(barbarian(3, 'zealot'));
  assert.equal(level3.divineFury, '1d6+1');
  assert.equal(level3.healingPoolDice, 4);
  assert.equal(level3.zealousPresence, null);

  assert.equal(zealotState(barbarian(6, 'zealot')).healingPoolDice, 5);
  assert.equal(zealotState(barbarian(12, 'zealot')).healingPoolDice, 6);

  const level17 = zealotState(barbarian(17, 'zealot'));
  assert.equal(level17.divineFury, '1d6+8');
  assert.equal(level17.healingPoolDice, 7);
  assert.equal(level17.zealousPresence.usesPerLongRest, 1);
  assert.deepEqual(level17.rageOfGods, { usesPerLongRest: 1 });
});

test('子职不匹配时返回 null', () => {
  assert.equal(berserkerState(barbarian(6, 'zealot')), null);
  assert.equal(wildHeartState(barbarian(6, 'beast-master')), null);
  assert.equal(worldTreeState(barbarian(6, 'berserker')), null);
  assert.equal(zealotState(barbarian(6, 'world-tree')), null);
});
