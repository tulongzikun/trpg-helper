const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newDraft, saveDraft, publishCharacter, emptyCharacterStore, exportCharacter, importCharacter } = require('../apps/web/src/characters.ts');
const { classResources, changeClassResource } = require('../apps/web/src/classResources.ts');
const { spellSlotResources } = require('../apps/web/src/spellSlotResources.ts');
const {
	alwaysPreparedMonkBard,
	bardInspirationDie,
	bardInspirationMaximum,
	bardSpellSaveDC,
	bardicInspirationRemaining,
	danceArmorClass,
	danceBladeDamage,
	elementalAttunementActive,
	elementalFlySpeed,
	elementalReachBonus,
	elementalResistance,
	elementalStrideSpeed,
	handOfUltimateMercyHealing,
	inspiringMovementTargets,
	inspiringMovementTempHp,
	martialArtsDie,
	mercyHandHealing,
	monkBardError,
	monkBardState,
	monkFocusMaximum,
	monkFocusRemaining,
	monkFocusSaveDC,
	monkUnarmoredArmorClass,
	monkUnarmoredMovementBonus,
	quiveringPalmDamage,
	setMonkBardState,
	spendInspirationToResetBeguiling,
	spendSlotToResetMajesty,
	spendSpellSlotForInspiration,
	uncannyMetabolismHealing,
	usePerfectFocus,
	useSuperiorInspiration,
	useUncannyMetabolism,
	wholenessOfBodyHealing,
} = require('../apps/web/src/monkBardFeatures.ts');

function draft(cls, level, subclass = '') {
	const d = newDraft();
	d.name = '测试';
	d.species = '人类';
	d.characterClass = cls;
	d.level = level;
	d.abilities = { str: 10, dex: 16, con: 14, int: 10, wis: 14, cha: 16 };
	d.details.fighterCalculator = { species: '人类', elfLineage: '', armor: 'none', shield: false, characterClass: cls, subclass, classSkills: [] };
	return d;
}
function remaining(d, id) {
	return classResources(d).find(r => r.id === id)?.remaining;
}

test('武艺骰与激励骰按等级提升', () => {
	assert.equal(martialArtsDie(1), 'd6', '1 级武艺骰应为 d6');
	assert.equal(martialArtsDie(5), 'd8', '5 级武艺骰应为 d8');
	assert.equal(martialArtsDie(11), 'd10', '11 级武艺骰应为 d10');
	assert.equal(martialArtsDie(17), 'd12', '17 级武艺骰应为 d12');
	assert.equal(bardInspirationDie(1), 'd6', '1 级激励骰应为 d6');
	assert.equal(bardInspirationDie(5), 'd8', '5 级激励骰应为 d8');
	assert.equal(bardInspirationDie(10), 'd10', '10 级激励骰应为 d10');
	assert.equal(bardInspirationDie(15), 'd12', '15 级激励骰应为 d12');
});

test('武僧无甲防御、无甲移动与功力豁免 DC 可自动计算', () => {
	const d = draft('武僧', 2);
	assert.equal(monkUnarmoredArmorClass(d), 15, '2 级武僧无甲防御应为 10+3+2=15');
	assert.equal(monkUnarmoredMovementBonus(d), 10, '2 级无甲移动加值应为 10 尺');
	assert.equal(monkFocusMaximum(d), 2, '2 级功力上限应为职业等级 2');
	assert.equal(monkFocusSaveDC(d), 12, '功力豁免 DC 应为 8+2+2=12');
	d.details.fighterCalculator.armor = 'light';
	assert.equal(monkUnarmoredArmorClass(d), null, '穿甲时不应显示无甲防御');
	assert.equal(monkUnarmoredMovementBonus(d), 0, '穿甲时不应获得无甲移动');
	d.details.fighterCalculator.armor = 'none';
	d.level = 18;
	assert.equal(monkUnarmoredMovementBonus(d), 30, '18 级无甲移动加值应为 30 尺');
});

test('舞蹈学院用魅力替代感知计算护甲等级', () => {
	const d = draft('吟游诗人', 3, 'dance');
	assert.equal(danceArmorClass(d), 16, '舞蹈学院 AC 应为 10+3+3=16');
	assert.equal(bardSpellSaveDC(d), 13, '吟游诗人法术豁免 DC 应为 8+2+3=13');
	assert.deepEqual({ dice: danceBladeDamage(d).dice, bonus: danceBladeDamage(d).bonus }, { dice: '1d6', bonus: 3 }, '炫目舞步伤害应为 1 激励骰 + 敏捷');
	d.details.fighterCalculator.shield = true;
	assert.equal(danceArmorClass(d), null, '持盾时不应显示炫目舞步 AC');
});

test('运转周天恢复全部功力且每长休一次', () => {
	let d = draft('武僧', 5);
	d = changeClassResource(d, 'monk-focus', 3);
	assert.equal(monkFocusRemaining(d), 2, '使用前应剩余 2 点功力');
	d = useUncannyMetabolism(d);
	assert.equal(monkFocusRemaining(d), 5, '运转周天应恢复全部功力');
	assert.equal(remaining(d, 'monk-uncanny-metabolism'), 0, '运转周天次数应记为已使用');
	const again = useUncannyMetabolism(d);
	assert.equal(again, d, '同一长休内不能再次使用运转周天');
	const healing = uncannyMetabolismHealing(d);
	assert.deepEqual({ dice: healing.dice, bonus: healing.bonus }, { dice: '1d8', bonus: 5 }, '运转周天回血应为 1 武艺骰 + 武僧等级');
});

test('明镜止水在未使用运转周天且功力不足四点时补至四点', () => {
	let d = draft('武僧', 15);
	d = changeClassResource(d, 'monk-focus', 13);
	assert.equal(monkFocusRemaining(d), 2, '准备状态功力应剩余 2 点');
	d = usePerfectFocus(d);
	assert.equal(monkFocusRemaining(d), 4, '明镜止水应把功力补至 4 点');
	assert.equal(usePerfectFocus(d), d, '功力已达到 4 点时不应再变化');
	let used = draft('武僧', 15);
	used = changeClassResource(used, 'monk-focus', 13);
	used = useUncannyMetabolism(used);
	assert.equal(usePerfectFocus(used), used, '已使用运转周天时明镜止水不应生效');
});

test('先发激励与激励之源分别补足次数和消耗法术位', () => {
	let d = draft('吟游诗人', 18);
	assert.equal(bardInspirationMaximum(d), 3, '魅力 16 时激励上限应为 3');
	d = changeClassResource(d, 'bard-inspiration', 3);
	assert.equal(bardicInspirationRemaining(d), 0, '准备状态激励应剩余 0 次');
	d = useSuperiorInspiration(d);
	assert.equal(bardicInspirationRemaining(d), 2, '先发激励应补至 2 次');
	d = useSuperiorInspiration(d);
	assert.equal(bardicInspirationRemaining(d), 2, '已有 2 次时先发激励不应超额');
	let bard = draft('吟游诗人', 5);
	bard = changeClassResource(bard, 'bard-inspiration', 3);
	assert.equal(bardicInspirationRemaining(bard), 0, '5 级准备状态激励应剩余 0 次');
	const next = spendSpellSlotForInspiration(bard);
	assert.equal(bardicInspirationRemaining(next), 1, '激励之源应恢复 1 次激励');
	const slot = spellSlotResources(next).find(s => s.remaining < s.maximum);
	assert.ok(slot, '激励之源应消耗一个法术位');
	assert.equal(slot.spent, 1, '应记录消耗 1 个法术位');
});

test('惑心魔法与威仪作锦的重置分别消耗激励与三环法术位', () => {
	let d = draft('吟游诗人', 6, 'glamour');
	d = changeClassResource(d, 'bard-glamour-beguiling', 1);
	d = spendInspirationToResetBeguiling(d);
	assert.equal(remaining(d, 'bard-glamour-beguiling'), 1, '消耗激励应重置惑心魔法');
	assert.equal(bardicInspirationRemaining(d), 2, '重置惑心魔法应消耗 1 次激励');
	let majesty = draft('吟游诗人', 6, 'glamour');
	majesty = changeClassResource(majesty, 'bard-glamour-majesty', 1);
	majesty = spendSlotToResetMajesty(majesty);
	assert.equal(remaining(majesty, 'bard-glamour-majesty'), 1, '消耗三环法术位应重置威仪作锦');
	assert.equal(spellSlotResources(majesty).find(s => s.id.endsWith(':3')).spent, 1, '应消耗一个三环法术位');
});

test('子职业资源随等级出现并遵守长休/短休规则', () => {
	assert.equal(remaining(draft('武僧', 2), 'monk-uncanny-metabolism'), 1, '2 级武僧应有运转周天');
	assert.equal(remaining(draft('武僧', 11, 'mercy'), 'monk-mercy-flurry'), 2, '感知 14 时生杀予夺应有 2 次');
	assert.equal(remaining(draft('武僧', 17, 'mercy'), 'monk-mercy-ultimate'), 1, '17 级慈悲武者应有命极之手');
	assert.equal(remaining(draft('武僧', 6, 'open-hand'), 'monk-openhand-wholeness'), 2, '6 级散打武者应有混元体 2 次');
	assert.equal(remaining(draft('吟游诗人', 3, 'glamour'), 'bard-glamour-beguiling'), 1, '3 级魅惑学院应有惑心魔法');
	assert.equal(remaining(draft('吟游诗人', 14, 'glamour'), 'bard-glamour-unbreakable'), 1, '14 级魅惑学院应有不破威仪');
});

test('元素同调、四象遁术与四象神通按状态计算', () => {
	let d = draft('武僧', 3, 'elements');
	assert.equal(elementalAttunementActive(d), false, '初始不应处于元素同调');
	d = setMonkBardState(d, { elementalAttunement: true });
	assert.equal(elementalAttunementActive(d), true, '写入后应处于元素同调');
	assert.equal(elementalReachBonus(d), 10, '元素同调应使徒手触及 +10 尺');
	assert.equal(elementalFlySpeed(d), 0, '11 级前不应获得四象遁术飞行');
	d.level = 11;
	assert.equal(elementalFlySpeed(d), 30, '11 级同调期间飞行速度应等于当前速度 30 尺');
	d.level = 17;
	d = setMonkBardState(d, { elementalResistance: '火焰' });
	assert.equal(elementalResistance(d), '火焰', '四象神通应记录所选抗性');
	assert.equal(elementalStrideSpeed(d), 20, '17 级破灭奔行应提供 +20 尺速度');
	assert.equal(monkBardError(d), null, '合法抗性不应产生校验错误');
	const broken = setMonkBardState(d, { elementalResistance: '光耀' });
	assert.ok(monkBardError(broken), '非法抗性应产生校验错误');
});

test('常备法术与治疗公式按子职业与等级给出', () => {
	const glamour = alwaysPreparedMonkBard(draft('吟游诗人', 20, 'glamour')).map(x => x.name);
	for (const name of ['魅惑类人', '镜影术', '命令术', '律令医疗', '律令死亡']) assert.ok(glamour.includes(name), `20 级魅惑学院应始终准备${name}`);
	const shadow = alwaysPreparedMonkBard(draft('武僧', 3, 'shadow')).map(x => x.name);
	assert.ok(shadow.includes('次级幻象'), '暗影武者应习得次级幻象');
	const elements = alwaysPreparedMonkBard(draft('武僧', 3, 'elements')).map(x => x.name);
	assert.ok(elements.includes('四象法门'), '元素武者应习得四象法门');
	assert.deepEqual(alwaysPreparedMonkBard(draft('武僧', 3, 'mercy')), [], '慈悲武者没有常备法术');
	const mercy = mercyHandHealing(draft('武僧', 3, 'mercy'));
	assert.deepEqual({ dice: mercy.dice, bonus: mercy.bonus }, { dice: '1d6', bonus: 2 }, '予命之手应为 1 武艺骰 + 感知');
	const wholeness = wholenessOfBodyHealing(draft('武僧', 6, 'open-hand'));
	assert.deepEqual({ dice: wholeness.dice, bonus: wholeness.bonus }, { dice: '1d8', bonus: 2 }, '混元体应为 1 武艺骰 + 感知');
	const ultimate = handOfUltimateMercyHealing(draft('武僧', 17, 'mercy'));
	assert.deepEqual({ dice: ultimate.dice, bonus: ultimate.bonus }, { dice: '4d10', bonus: 2 }, '命极之手应为 4d10 + 感知');
	assert.equal(quiveringPalmDamage(draft('武僧', 17, 'open-hand')), '10d12', '渗透劲伤害应为 10d12');
	assert.equal(inspiringMovementTargets(draft('吟游诗人', 6, 'glamour')), 3, '魅力 16 时灵感织衣可指定 3 个生物');
	assert.equal(inspiringMovementTempHp(draft('吟游诗人', 6, 'glamour')), '2d8', '6 级灵感织衣临时生命值应为 2 激励骰');
});

test('武僧与吟游诗人状态可随发布与导入保留', () => {
	let d = draft('武僧', 3, 'elements');
	d = setMonkBardState(d, { elementalAttunement: true });
	const store = saveDraft(emptyCharacterStore(), 'one', d);
	const imported = importCharacter(emptyCharacterStore(), exportCharacter(store.characters[0]));
	const sheet = imported.characters[0].draft;
	assert.equal(monkBardState(sheet).elementalAttunement, true, '元素同调状态应随角色数据保存');
	assert.equal(monkFocusRemaining(draft('武僧', 2)), 2, '未消耗时功力应保持满值');
});
