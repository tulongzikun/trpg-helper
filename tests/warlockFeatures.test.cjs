const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newDraft } = require('../apps/web/src/characters.ts');
const {
  warlockFeatureState, warlockSheetLines, arcanumEntries, celestialHealingDice, feyStepsUses, darkLuckUses,
  darkBlessingTempHp, celestialResilienceTempHp, awakenMindRangeMiles, patchWarlockConfig,
} = require('../apps/web/src/warlockFeatures.ts');
const { classResources } = require('../apps/web/src/classResources.ts');
const { invocationState } = require('../apps/web/src/explorationInvocations.ts');

function warlock(level, patch = {}) {
  const d = newDraft();
  d.level = level;
  d.abilities = { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 17 };
  d.details.fighterCalculator = { species: '人类', elfLineage: '', armor: 'none', shield: false, characterClass: '邪术师', subclass: 'fiend', classSkills: ['奥秘'], ...patch };
  return d;
}

test('治愈之光骰池与魅力相关次数按规则计算', () => {
  assert.equal(celestialHealingDice(1), 2);
  assert.equal(celestialHealingDice(10), 11);
  assert.equal(feyStepsUses(warlock(3)), 3);
  assert.equal(darkLuckUses(warlock(6)), 3);
  const weak = warlock(6);
  weak.abilities.cha = 8;
  assert.equal(feyStepsUses(weak), 1, '魅力调整值为负时至少 1 次');
  assert.equal(darkLuckUses(weak), 1);
});

test('黑暗赐福与天界韧性临时生命等于等级加魅力调整值', () => {
  assert.equal(darkBlessingTempHp(warlock(10)), 13);
  assert.equal(celestialResilienceTempHp(warlock(10)), 13);
  const weak = warlock(1);
  weak.abilities.cha = 8;
  assert.equal(darkBlessingTempHp(weak), 1, '总数不大于 0 时至少 1 点');
});

test('唤醒心灵范围等于魅力调整值英里且至少 1 英里', () => {
  assert.equal(awakenMindRangeMiles(warlock(3)), 3);
  const weak = warlock(3);
  weak.abilities.cha = 8;
  assert.equal(awakenMindRangeMiles(weak), 1);
});

test('玄奥秘法按已解锁环阶列出所选法术', () => {
  const d = warlock(11, { classSpellChoices: { 邪术师: { cantrips: [], prepared: [], arcanum: { 6: '真知术' } } } });
  const entries = arcanumEntries(d);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], { level: 6, name: '真知术' });
  const upgraded = warlock(17, { classSpellChoices: { 邪术师: { cantrips: [], prepared: [], arcanum: { 6: '真知术', 7: '异界之门', 8: '心灵空白', 9: '形体变化' } } } });
  assert.deepEqual(arcanumEntries(upgraded).map((x) => x.level), [6, 7, 8, 9]);
});

test('秘法未覆盖已解锁环阶时进入校验错误', () => {
  const d = warlock(13, { classSpellChoices: { 邪术师: { cantrips: [], prepared: [], arcanum: { 6: '真知术' } } } });
  const state = warlockFeatureState(d);
  assert.ok(state.errors.some((x) => x.includes('秘法环阶')), '缺 7 环秘法应报错');
});

test('玄奥秘法资源按每个已选秘法各 1 次', () => {
  const d = warlock(13, { classSpellChoices: { 邪术师: { cantrips: [], prepared: [], arcanum: { 6: '真知术', 7: '异界之门' } } } });
  const defs = classResources(d).filter((r) => r.id.startsWith('warlock-arcanum-'));
  assert.deepEqual(defs.map((x) => x.id), ['warlock-arcanum-6', 'warlock-arcanum-7']);
  assert.ok(defs.every((x) => x.maximum === 1 && x.shortRest === false));
});

test('宗主资源按等级与魅力生成', () => {
  const fey = classResources(warlock(10, { subclass: 'archfey' })).filter((r) => r.id.startsWith('archfey-'));
  assert.deepEqual(fey.map((r) => r.id), ['archfey-fey-steps', 'archfey-beguiling-deflection']);
  assert.equal(fey[0].maximum, 3);
  const celestial = classResources(warlock(14, { subclass: 'celestial' })).filter((r) => r.id.startsWith('celestial-'));
  assert.deepEqual(celestial.map((r) => r.id), ['celestial-healing-light', 'celestial-revive']);
  assert.equal(celestial[0].maximum, 15);
  const goo = classResources(warlock(6, { subclass: 'great-old-one' })).filter((r) => r.id.startsWith('goo-'));
  assert.deepEqual(goo.map((r) => r.id), ['goo-clairvoyant-combatant']);
});

test('邪魔体魄抗性仅在邪魔宗主 10 级后合法', () => {
  const d = warlock(10, { fiendResistance: '火焰' });
  assert.equal(warlockFeatureState(d).errors.length, 0);
  d.details.fighterCalculator.subclass = 'archfey';
  assert.ok(warlockFeatureState(d).errors.some((x) => x.includes('邪魔体魄')), '非邪魔宗主不应有邪魔体魄');
  d.details.fighterCalculator.fiendResistance = '力场';
  d.details.fighterCalculator.subclass = 'fiend';
  assert.ok(warlockFeatureState(d).errors.some((x) => x.includes('伤害类型无效')));
  d.details.fighterCalculator.fiendResistance = '';
  assert.equal(warlockFeatureState(d).errors.length, 0);
});

test('骇异恶咒属性选择校验', () => {
  const d = warlock(10, { subclass: 'great-old-one', hexAbility: '敏捷' });
  assert.equal(warlockFeatureState(d).errors.length, 0);
  d.details.fighterCalculator.hexAbility = '幸运';
  assert.ok(warlockFeatureState(d).errors.some((x) => x.includes('属性无效')));
});

test('角色卡摘要包含契约法术位与宗主特性数值', () => {
  const celestial = warlockSheetLines(warlock(10, { subclass: 'celestial' }));
  assert.ok(celestial.some((x) => x.includes('契约法术位')), '应显示契约法术位');
  assert.ok(celestial.some((x) => x.includes('治愈之光')), '应显示治愈之光骰池');
  const fiend = warlockSheetLines(warlock(14));
  assert.ok(fiend.some((x) => x.includes('黑暗赐福')));
  assert.ok(fiend.some((x) => x.includes('黑暗强运')));
  assert.ok(fiend.some((x) => x.includes('直坠噩梦')));
});

test('魔能祈唤先决结构校验', () => {
  const ok = warlock(5, { explorationInvocations: ['pact-blade', 'thirsting-blade'] });
  assert.equal(invocationState(ok).invalid, false, '先决满足时合法');
  const bad = warlock(5, { explorationInvocations: ['thirsting-blade'] });
  assert.equal(invocationState(bad).invalid, true, '缺少锋刃契约时应无效');
  const high = warlock(12, { explorationInvocations: ['pact-blade', 'thirsting-blade', 'devouring-blade'] });
  assert.equal(invocationState(high).invalid, false, '12 级满足吞噬之刃先决');
});

test('字段写入保留其他配置', () => {
  const d = warlock(10);
  const next = patchWarlockConfig(d, { fiendResistance: '寒冷' });
  assert.equal(next.details.fighterCalculator.fiendResistance, '寒冷');
  assert.equal(next.details.fighterCalculator.subclass, 'fiend');
  assert.equal(d.details.fighterCalculator.fiendResistance, undefined);
});
