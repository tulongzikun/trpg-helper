const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newDraft } = require('../apps/web/src/characters.ts');
const {
  fightingStyleLimit, weaponMasteryLimit, maneuverLimit, superiorityDice, psiDie, criticalRange,
  fighterFeatureState, fighterSheetLines, patchFighterConfig,
} = require('../apps/web/src/fighterFeatures.ts');

function fighter(level, patch = {}) {
  const d = newDraft();
  d.level = level;
  d.abilities = { str: 18, dex: 14, con: 16, int: 10, wis: 12, cha: 8 };
  d.details.fighterCalculator = { species: '人类', elfLineage: '', armor: 'none', shield: false, characterClass: '战士', subclass: 'champion', classSkills: ['运动'], ...patch };
  return d;
}

test('战斗风格上限：勇士 7 级起可再选一项，其余战士只有一项', () => {
  assert.equal(fightingStyleLimit(fighter(6)), 1);
  assert.equal(fightingStyleLimit(fighter(7)), 2);
  assert.equal(fightingStyleLimit(fighter(15)), 2);
  assert.equal(fightingStyleLimit(fighter(7, { subclass: 'battle-master' })), 1);
});

test('武器精通上限按战士等级提升为 3、4、5、6 种', () => {
  assert.equal(weaponMasteryLimit(1), 3);
  assert.equal(weaponMasteryLimit(4), 4);
  assert.equal(weaponMasteryLimit(9), 5);
  assert.equal(weaponMasteryLimit(13), 6);
});

test('战技数量与卓越骰随等级提升', () => {
  assert.equal(maneuverLimit(2), 0);
  assert.equal(maneuverLimit(3), 3);
  assert.equal(maneuverLimit(7), 5);
  assert.equal(maneuverLimit(10), 7);
  assert.equal(maneuverLimit(15), 9);
  assert.deepEqual(superiorityDice(3), { count: 4, die: 8 });
  assert.deepEqual(superiorityDice(7), { count: 5, die: 8 });
  assert.deepEqual(superiorityDice(10), { count: 5, die: 10 });
  assert.deepEqual(superiorityDice(15), { count: 6, die: 10 });
  assert.deepEqual(superiorityDice(18), { count: 6, die: 12 });
});

test('灵能骰数量与骰面按等级表提升', () => {
  assert.equal(psiDie(2), null);
  assert.deepEqual(psiDie(3), { count: 4, die: 6 });
  assert.deepEqual(psiDie(9), { count: 8, die: 8 });
  assert.deepEqual(psiDie(17), { count: 12, die: 12 });
});

test('勇士重击范围在 3 级与 15 级扩展', () => {
  assert.equal(criticalRange(fighter(2)), null);
  assert.deepEqual(criticalRange(fighter(3)), [19, 20]);
  assert.deepEqual(criticalRange(fighter(15)), [18, 20]);
  assert.equal(criticalRange(fighter(15, { subclass: 'battle-master' })), null);
});

test('选择校验：数量、重复、未知选项与传奇恩惠等级', () => {
  let d = fighter(3, { fightingStyles: ['archery', 'defense'], weaponMastery: ['longsword', 'longsword'] });
  let state = fighterFeatureState(d);
  assert.ok(state.errors.some((x) => x.includes('战斗风格最多')), '超量战斗风格应报错');
  assert.ok(state.errors.some((x) => x.includes('武器精通不能重复')), '重复武器应报错');
  d = fighter(3, { fightingStyles: ['unknown-style'], epicBoon: '真实视觉之恩惠' });
  state = fighterFeatureState(d);
  assert.ok(state.errors.some((x) => x.includes('战斗风格选项无效')));
  assert.ok(state.errors.some((x) => x.includes('19 级')), '未到 19 级选择传奇恩惠应报错');
  d = fighter(19, { epicBoon: '真实视觉之恩惠' });
  assert.equal(fighterFeatureState(d).errors.length, 0, '19 级选择传奇恩惠合法');
});

test('战斗大师校验战技与战争学者选项', () => {
  let d = fighter(3, { subclass: 'battle-master', maneuvers: ['伏击', '格挡', '精准攻击', '反击'] });
  assert.ok(fighterFeatureState(d).errors.some((x) => x.includes('战技最多')));
  d = fighter(3, { subclass: 'battle-master', maneuvers: ['不存在的战技'] });
  assert.ok(fighterFeatureState(d).errors.some((x) => x.includes('战技选项无效')));
  d = fighter(3, { subclass: 'battle-master', martialTool: '不存在的工具', martialSkill: '奥秘' });
  const state = fighterFeatureState(d);
  assert.ok(state.errors.some((x) => x.includes('工匠工具')), '非工匠工具应报错');
  assert.ok(state.errors.some((x) => x.includes('战士技能列表')), '非战士技能应报错');
});

test('奥法骑士战争联结最多两把武器，非战士不产生校验错误', () => {
  const d = fighter(3, { subclass: 'eldritch-knight', weaponBond: ['长剑', '短剑', '匕首'] });
  assert.ok(fighterFeatureState(d).errors.some((x) => x.includes('最多联结两把')));
  const notFighter = fighter(3);
  notFighter.details.fighterCalculator.characterClass = '法师';
  assert.deepEqual(fighterFeatureState(notFighter).errors, []);
  assert.deepEqual(fighterSheetLines(notFighter), []);
});

test('角色卡摘要输出战斗风格、重击范围与传奇恩惠', () => {
  const d = fighter(19, { fightingStyles: ['defense'], epicBoon: '真实视觉之恩惠' });
  const lines = fighterSheetLines(d);
  assert.ok(lines.some((x) => x.includes('战斗风格：防御')));
  assert.ok(lines.some((x) => x.includes('传奇恩惠：真实视觉之恩惠')));
  const championLines = fighterSheetLines(fighter(15));
  assert.ok(championLines.some((x) => x.includes('重击范围')));
});

test('字段写入保留其他配置并只更新战士字段', () => {
  const d = fighter(3, { species: '精灵' });
  const next = patchFighterConfig(d, { fightingStyles: ['dueling'] });
  assert.deepEqual(next.details.fighterCalculator.fightingStyles, ['dueling']);
  assert.equal(next.details.fighterCalculator.species, '精灵');
  assert.deepEqual(d.details.fighterCalculator.fightingStyles, undefined, '原草稿不应被修改');
});
