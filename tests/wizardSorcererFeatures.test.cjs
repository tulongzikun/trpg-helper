const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newDraft } = require('../apps/web/src/characters.ts');
const { classResources } = require('../apps/web/src/classResources.ts');
const { changeSpellSlot } = require('../apps/web/src/spellSlotResources.ts');
const { wizardSorcererData } = require('../apps/web/src/groups/data/wizardSorcerer.ts');
const features = require('../apps/web/src/wizardSorcererFeatures.ts');
const { wizardSorcererResourceDefs } = require('../apps/web/src/groups/resources/wizardSorcerer.ts');

function sample(cls, subclass = '') {
  const d = newDraft();
  d.level = 1;
  d.details.fighterCalculator = { species: '人类', elfLineage: '', armor: 'none', shield: false, characterClass: cls, subclass };
  return d;
}
function sorcerer(level, subclass = '') { const d = sample('术士', subclass); d.level = level; return d; }
function wizard(level, subclass = '') { const d = sample('法师', subclass); d.level = level; return d; }

test('施法摘要按职业属性计算豁免 DC 与攻击加值', () => {
  const d = sorcerer(5); d.abilities.cha = 16;
  const s = features.spellcastingSummary(d);
  assert.equal(s.cls, '术士');
  assert.equal(s.abilityName, '魅力');
  assert.equal(s.modifier, 3);
  assert.equal(s.proficiency, 3);
  assert.equal(s.saveDC, 14);
  assert.equal(s.attackBonus, 6);
  assert.equal(features.spellcastingSummary(sample('战士')), null);
});

test('超魔法数量上限随等级为 2/4/6 且拒绝重复与超限', () => {
  assert.equal(features.metamagicLimit(1), 0);
  assert.equal(features.metamagicLimit(2), 2);
  assert.equal(features.metamagicLimit(10), 4);
  assert.equal(features.metamagicLimit(17), 6);
  let d = sorcerer(2);
  d = features.addMetamagic(d, ' 谨慎法术 ');
  d = features.addMetamagic(d, '远程法术');
  assert.deepEqual(features.metamagicState(d).chosen, ['谨慎法术', '远程法术']);
  assert.equal(features.metamagicState(d).remaining, 0);
  assert.equal(features.addMetamagic(d, '延长法术'), d);
  assert.equal(features.addMetamagic(d, '谨慎法术'), d);
  d = features.removeMetamagic(d, '远程法术');
  assert.equal(features.metamagicState(d).chosen.length, 1);
  const over = sorcerer(2); over.details.fighterCalculator.metamagic = ['a', 'b', 'c'];
  assert.equal(features.metamagicState(over).invalid, true);
  const wizardDraft = sample('法师');
  assert.equal(features.metamagicState(wizardDraft).limit, 0);
  assert.equal(features.addMetamagic(wizardDraft, '谨慎法术'), wizardDraft);
});

test('先天术法消耗次数，7 级次数耗尽后可花 2 术法点再激活', () => {
  let d = sorcerer(1);
  assert.equal(features.innateSorceryState(d).remaining, 2);
  d = features.toggleInnateSorcery(d);
  assert.equal(features.innateSorceryState(d).active, true);
  assert.equal(features.innateSorceryState(d).remaining, 1);
  d = features.toggleInnateSorcery(d);
  assert.equal(features.innateSorceryState(d).active, false);
  d = features.toggleInnateSorcery(d);
  assert.equal(features.innateSorceryState(d).remaining, 0);
  d = features.toggleInnateSorcery(d);
  assert.equal(features.innateSorceryState(d).active, false);
  assert.equal(features.toggleInnateSorcery(d), d);
  let high = sorcerer(7);
  high.abilities.cha = 16;
  high = features.toggleInnateSorcery(high);
  high = features.toggleInnateSorcery(high);
  high = features.toggleInnateSorcery(high);
  high = features.toggleInnateSorcery(high);
  assert.equal(features.innateSorceryState(high).remaining, 0);
  const activated = features.toggleInnateSorcery(high);
  assert.equal(features.innateSorceryState(activated).active, true);
  assert.equal(classResources(activated).find(r => r.id === 'sorcerer-points').spent, 2);
});

test('术法复苏与奥术回想的上限按等级计算', () => {
  const s = features.sorcerousRestorationState(sorcerer(5));
  assert.equal(s.available, true);
  assert.equal(s.maximumPoints, 2);
  assert.equal(features.sorcerousRestorationState(sorcerer(4)).available, false);
  const w = features.arcaneRecoveryState(wizard(5));
  assert.equal(w.available, true);
  assert.equal(w.maximumTotalLevels, 3);
  assert.equal(features.arcaneRecoveryState(sorcerer(5)).available, false);
});

test('记忆法术在 5 级后把已准备法术替换为法术书中的另一道', () => {
  let d = wizard(5);
  const book = [{ name: '魔法飞弹', level: 1 }, { name: '护盾术', level: 1 }, { name: '灼热射线', level: 2 }];
  d.details.fighterCalculator.classSpellChoices = { '法师': { cantrips: [], prepared: [{ name: '魔法飞弹', level: 1 }], book } };
  assert.equal(features.wizardMemorySpell(d, '魔法飞弹', '护盾术').draft.details.fighterCalculator.classSpellChoices['法师'].prepared[0].name, '护盾术');
  assert.match(features.wizardMemorySpell(d, '魔法飞弹', '火球术').error, /法术书/);
  assert.match(features.wizardMemorySpell(d, '护盾术', '灼热射线').error, /已准备/);
  const low = wizard(4);
  low.details.fighterCalculator.classSpellChoices = d.details.fighterCalculator.classSpellChoices;
  assert.match(features.wizardMemorySpell(low, '魔法飞弹', '护盾术').error, /5 级/);
  assert.match(features.wizardMemorySpell(sorcerer(5), '魔法飞弹', '护盾术').error, /法师/);
});

test('元素亲和只在龙族魔法 6 级可选', () => {
  const d = sorcerer(6, 'draconic');
  assert.equal(features.draconicAffinityState(d).available, true);
  const next = features.setDraconicAffinity(d, '火焰');
  assert.equal(features.draconicAffinityState(next).chosen, '火焰');
  assert.equal(features.setDraconicAffinity(sorcerer(5, 'draconic'), '火焰').details.fighterCalculator.draconicAffinity, undefined);
  assert.equal(features.setDraconicAffinity(sorcerer(6, 'wild-magic'), '火焰').details.fighterCalculator.draconicAffinity, undefined);
});

test('血肉启示消耗术法点并要求点数与增益一致，可结束', () => {
  let d = sorcerer(14, 'aberrant'); d.abilities.cha = 16;
  assert.equal(features.fleshRevelationState(d).available, true);
  const two = features.activateFleshRevelation(d, 2, ['水生适应', '闪耀飞翔']);
  assert.equal(two.error, undefined);
  assert.equal(features.fleshRevelationState(two.draft).active, true);
  assert.equal(features.fleshRevelationState(two.draft).remainingPoints, 12);
  assert.match(features.activateFleshRevelation(d, 2, ['水生适应']).error, /不同增益|点数/);
  assert.match(features.activateFleshRevelation(d, 1, ['飞行']).error, /无效/);
  const ended = features.endFleshRevelation(two.draft);
  assert.equal(features.fleshRevelationState(ended).active, false);
  assert.match(features.activateFleshRevelation(sorcerer(13, 'aberrant'), 1, ['水生适应']).error, /14 级/);
});

test('奥术守御结界生命值上限与钳制', () => {
  const d = wizard(5, 'abjurer'); d.abilities.int = 16;
  assert.equal(features.arcaneWardMax(d), 5 * 2 + 3);
  assert.equal(features.arcaneWardState(d).hp, 0);
  const filled = features.setArcaneWardHp(d, 99);
  assert.equal(features.arcaneWardState(filled).hp, 13);
  assert.equal(features.setArcaneWardHp(wizard(5, 'evoker'), 3).details.fighterCalculator.arcaneWardHp, undefined);
});

test('预兆骰数量 3 级为 2、14 级为 3，可记录使用', () => {
  let d = wizard(3, 'diviner');
  assert.equal(features.portentState(d).count, 2);
  d = features.setPortentValue(d, 0, 17);
  d = features.setPortentValue(d, 1, 4);
  assert.equal(features.portentState(d).remaining, 2);
  d = features.togglePortentUsed(d, 0);
  assert.equal(features.portentState(d).remaining, 1);
  assert.equal(features.portentState(wizard(14, 'diviner')).count, 3);
  assert.equal(features.portentState(wizard(14, 'diviner')).higher, true);
  const cleared = features.clearPortent(d);
  assert.deepEqual(features.portentState(cleared).values, [0, 0, 0].slice(0, 2));
  assert.equal(features.setPortentValue(d, 5, 10), d);
});

test('法师学者免费法术数量按学派核对', () => {
  const catalog = [
    { name: '护盾术', level: 1, school: '防护' }, { name: '法师护甲', level: 1, school: '防护' },
    { name: '魔法飞弹', level: 1, school: '塑能' }, { name: '火球术', level: 3, school: '塑能' },
  ];
  const d = wizard(3, 'abjurer');
  d.details.fighterCalculator.classSpellChoices = { '法师': { cantrips: [], prepared: [], book: [{ name: '护盾术', level: 1 }] } };
  const state = features.wizardScholarState(d, catalog);
  assert.equal(state.school, '防护');
  assert.equal(state.required, 2);
  assert.equal(state.inBook, 1);
  assert.equal(state.met, false);
  const ok = wizard(5, 'evoker');
  ok.details.fighterCalculator.classSpellChoices = { '法师': { cantrips: [], prepared: [], book: [{ name: '魔法飞弹', level: 1 }, { name: '火球术', level: 3 }] } };
  assert.equal(features.wizardScholarState(ok, catalog).required, 3);
  assert.equal(features.wizardScholarState(ok, catalog).met, false);
  assert.equal(features.wizardScholarState(sorcerer(3), catalog), null);
});

test('传奇恩惠只记录文本且 19 级起可用', () => {
  const low = features.setEpicBoon(wizard(18), '命运之宠');
  assert.equal(features.epicBoonState(low).chosen, '');
  const d = features.setEpicBoon(wizard(19), '命运之宠');
  assert.equal(features.epicBoonState(d).chosen, '命运之宠');
});

test('组资源定义包含子职次数资源且不改动术士基础资源列表', () => {
  assert.deepEqual(wizardSorcererResourceDefs(sorcerer(1)), []);
  assert.deepEqual(classResources(sorcerer(5)).map(r => r.id), ['sorcerer-points', 'sorcerer-restoration']);
  assert.equal(features.innateSorceryState(sorcerer(1)).remaining, 2);
  const clock = wizardSorcererResourceDefs(sorcerer(3, 'clockwork'));
  assert.equal(clock.find(r => r.id === 'clockwork-balance').maximum, 1);
  const strong = sorcerer(3, 'clockwork'); strong.abilities.cha = 18;
  assert.equal(wizardSorcererResourceDefs(strong).find(r => r.id === 'clockwork-balance').maximum, 4);
  const ids = wizardSorcererResourceDefs(sorcerer(18, 'clockwork')).map(r => r.id);
  assert.deepEqual(ids, ['clockwork-balance', 'clockwork-awareness', 'clockwork-matrix']);
  assert.ok(wizardSorcererResourceDefs(wizard(3, 'abjurer')).every(r => r.id !== 'sorcerer-innate'));
});

test('记忆法术替换与法术位系统共存', () => {
  let d = wizard(5);
  d.details.fighterCalculator.classSpellChoices = { '法师': { cantrips: [], prepared: [{ name: '魔法飞弹', level: 1 }], book: [{ name: '魔法飞弹', level: 1 }, { name: '护盾术', level: 1 }] } };
  d = changeSpellSlot(d, '法师:slot:1', 1);
  const result = features.wizardMemorySpell(d, '魔法飞弹', '护盾术').draft;
  assert.equal(result.details.fighterCalculator.classSpellChoices['法师'].prepared[0].name, '护盾术');
  assert.equal(result.details.fighterCalculator.spellSlotSpent['法师:slot:1'], 1);
});

test('特性目录覆盖法师与术士基础及 8 个子职条目', () => {
  const classes = wizardSorcererData.classFeatures;
  const sorcererNames = classes['术士'].map(f => `${f.level} ${f.name}`);
  const wizardNames = classes['法师'].map(f => `${f.level} ${f.name}`);
  for (const name of ['1 先天术法', '2 魔力泉涌', '2 超魔法', '5 术法复苏', '7 术法化身', '20 奥术化神']) assert.ok(sorcererNames.includes(name), name);
  for (const name of ['1 仪式学家', '5 记忆法术', '18 法术精通', '20 招牌法术']) assert.ok(wizardNames.includes(name), name);
  const expected = {
    '术士:aberrant': 6, '术士:clockwork': 5, '术士:draconic': 5, '术士:wild-magic': 5,
    '法师:abjurer': 5, '法师:diviner': 5, '法师:evoker': 5, '法师:illusionist': 5,
  };
  for (const [key, count] of Object.entries(expected)) assert.equal(wizardSorcererData.subclassFeatures[key].length, count, key);
  const draconic = wizardSorcererData.subclassFeatures['术士:draconic'].map(f => f.name);
  assert.deepEqual(draconic, ['龙族体魄', '龙族法术', '元素亲和', '龙翼', '龙族伙伴']);
  const illusion = wizardSorcererData.subclassFeatures['法师:illusionist'].map(f => f.name);
  assert.deepEqual(illusion, ['幻术学者', '强化幻术', '魅影生灵', '幻影化形', '亦真亦幻']);
});

test('子职被动特性按等级列示，传心谈话与灵能术法有独立数值', () => {
  const aberrant3 = features.subclassFeatureNotes(sorcerer(3, 'aberrant'));
  assert.deepEqual(aberrant3.map(n => n.name), ['灵能法术']);
  const aberrant6 = features.subclassFeatureNotes(sorcerer(6, 'aberrant')).map(n => n.name);
  assert.deepEqual(aberrant6, ['灵能法术', '灵能术法', '心灵防御']);
  assert.deepEqual(features.subclassFeatureNotes(sorcerer(3, 'draconic')).map(n => n.name), ['龙族法术', '龙族体魄']);
  assert.deepEqual(features.subclassFeatureNotes(wizard(14, 'diviner')), []);
  assert.deepEqual(features.subclassFeatureNotes(sorcerer(3, 'evoker')).map(n => n.name), ['强力戏法']);

  const telepathy = sorcerer(3, 'aberrant'); telepathy.abilities.cha = 16;
  const t = features.telepathyState(telepathy);
  assert.equal(t.available, true);
  assert.equal(t.durationMinutes, 3);
  assert.equal(t.rangeMiles, 3);
  assert.equal(features.telepathyState(sorcerer(2, 'aberrant')).available, false);
  assert.equal(features.telepathyState(sorcerer(3, 'draconic')).available, false);

  assert.equal(features.psionicSorceryCost(0), 1);
  assert.equal(features.psionicSorceryCost(3), 3);
  assert.equal(features.psionicSorceryState(sorcerer(6, 'aberrant')).available, true);
  assert.equal(features.psionicSorceryState(sorcerer(5, 'aberrant')).available, false);
});
