import type { ElementalDamage } from '../monkBardFeatures';
import type { CharacterDraft } from '../characters';
import { changeClassResource, classResources } from '../classResources';
import {
	alwaysPreparedMonkBard,
	bardInspirationDie,
	bardInspirationMaximum,
	bardicInspirationRemaining,
	bardSpellSaveDC,
	danceArmorClass,
	danceBladeDamage,
	elementalAttunementActive,
	elementalDamageTypes,
	elementalFlySpeed,
	elementalReachBonus,
	elementalStrideSpeed,
	handOfUltimateMercyHealing,
	inspiringMovementTargets,
	inspiringMovementTempHp,
	martialArtsDie,
	mercyHandHealing,
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
} from '../monkBardFeatures';
// 武僧 + 吟游诗人（职业基础特性与子职业）聚合视图；由 monk-bard 组维护。
// 只处理角色卡上可计算/可记录的部分，战斗轮内结算、豁免与状态由玩家手动处理。

type Props = { draft: CharacterDraft; onChange: (draft: CharacterDraft) => void };
type FieldProps = { draft: CharacterDraft };

function isMonk(draft: CharacterDraft) {
	return draft.details?.fighterCalculator?.characterClass === '武僧';
}
function isBard(draft: CharacterDraft) {
	return draft.details?.fighterCalculator?.characterClass === '吟游诗人';
}
function remainingOf(draft: CharacterDraft, id: string) {
	return classResources(draft).find(r => r.id === id)?.remaining ?? 0;
}
function sign(value: number) {
	return value >= 0 ? `+${value}` : `${value}`;
}

export function MonkBardEditorGroup({ draft, onChange }: Props) {
	const c = draft.details?.fighterCalculator;
	if (!c || (!isMonk(draft) && !isBard(draft))) return null;
	const level = draft.level;
	const sub = c.subclass ?? '';
	const focusRemaining = monkFocusRemaining(draft);
	const focusMaximum = monkFocusMaximum(draft);
	const inspirationRemaining = bardicInspirationRemaining(draft);
	const inspirationMaximum = bardInspirationMaximum(draft);
	const state = monkBardState(draft);
	const canAttune = isMonk(draft) && sub === 'elements' && level >= 3;
	const attuned = elementalAttunementActive(draft);
	const metabolismUsed = remainingOf(draft, 'monk-uncanny-metabolism') === 0;
	const healing = uncannyMetabolismHealing(draft);
	const mercyHand = mercyHandHealing(draft);
	const wholeness = wholenessOfBodyHealing(draft);
	const ultimate = handOfUltimateMercyHealing(draft);
	const blade = danceBladeDamage(draft);
	return (
		<section className="character-section">
			<h2>武僧与吟游诗人：可计算与可记录部分</h2>
			<p className="character-help">
				这里只记录角色卡上可自动计算或可消耗的数值；攻击、豁免、状态与战斗轮内结算仍需手动处理。标记「部分」「不适用（战斗）」的特性请以规则文本为准。
			</p>
			{isMonk(draft) && (
				<>
					<div className="section-label">武僧</div>
					<div className="character-stats">
						<span>武艺骰 <b>{martialArtsDie(level)}</b></span>
						{focusMaximum > 0 && <span>功力 <b>{focusRemaining} / {focusMaximum}</b></span>}
						{monkFocusSaveDC(draft) !== null && <span>功力豁免 DC <b>{monkFocusSaveDC(draft)}</b></span>}
						{monkUnarmoredArmorClass(draft) !== null && <span>无甲防御 AC <b>{monkUnarmoredArmorClass(draft)}</b></span>}
						{monkUnarmoredMovementBonus(draft) > 0 && <span>无甲移动加值 <b>+{monkUnarmoredMovementBonus(draft)} 尺</b></span>}
					</div>
					{level >= 2 && (
						<div className="revision-row">
							<span>运转周天：一次性重获全部功力并恢复「1 {martialArtsDie(level)} {sign(level)}」生命值</span>
							<button type="button" className="button-secondary" aria-label="使用运转周天" disabled={metabolismUsed} onClick={() => onChange(useUncannyMetabolism(draft))}>
								{metabolismUsed ? '本长休已使用' : '使用运转周天'}
							</button>
						</div>
					)}
					{level >= 15 && (
						<div className="revision-row">
							<span>明镜止水：投先攻且未用运转周天、功力不足 4 点时补至 4 点</span>
							<button type="button" className="button-secondary" aria-label="使用明镜止水" disabled={metabolismUsed || focusRemaining > 3} onClick={() => onChange(usePerfectFocus(draft))}>
								使用明镜止水
							</button>
						</div>
					)}
					{canAttune && (
						<>
							<label>
								<input
									type="checkbox"
									aria-label="元素同调状态"
									checked={attuned}
									onChange={e => {
										if (e.target.checked) {
											if (focusRemaining < 1) return;
											onChange(setMonkBardState(changeClassResource(draft, 'monk-focus', 1), { elementalAttunement: true }));
										} else onChange(setMonkBardState(draft, { elementalAttunement: false }));
									}}
								/>
								元素同调（激活时消耗 1 点功力，持续 10 分钟；触及 +10 尺、伤害可改为元素类型）
							</label>
							{attuned && <p className="character-help">同调期间：徒手触及 {elementalReachBonus(draft)} 尺；命中时可迫使力量豁免并推拉 10 尺。{level >= 11 && ` 四象遁术：飞行与游泳速度 ${elementalFlySpeed(draft)} 尺。`}{level >= 17 && ` 破灭奔行：疾步如风时速度 +${elementalStrideSpeed(draft)} 尺。`}</p>}
						</>
					)}
					{canAttune && level >= 17 && (
						<label>
							四象神通抗性
							<select aria-label="四象神通抗性" value={state.elementalResistance} onChange={e => onChange(setMonkBardState(draft, { elementalResistance: e.target.value as ElementalDamage | '' }))}>
								<option value="">未选择（每回合开始可更换）</option>
								{elementalDamageTypes.map(type => <option key={type} value={type}>{type}</option>)}
							</select>
						</label>
					)}
					{mercyHand && <p className="character-help">予命之手：治疗 {mercyHand.dice} {sign(mercyHand.bonus)}；疾风连击可替换一次且免费。</p>}
					{wholeness && <p className="character-help">混元体：附赠动作恢复 {wholeness.dice} {sign(wholeness.bonus)} 生命值；次数在职业资源中记录。</p>}
					{ultimate && <p className="character-help">命极之手：复活恢复 {ultimate.dice} {sign(ultimate.bonus)} 生命值；每长休一次，次数在职业资源中记录。</p>}
					{quiveringPalmDamage(draft) && <p className="character-help">渗透劲：结束暗劲时目标体质豁免，失败受到 {quiveringPalmDamage(draft)} 力场伤害（成功半伤）；同一时间只能影响一个目标。</p>}
				</>
			)}
			{isBard(draft) && (
				<>
					<div className="section-label">吟游诗人</div>
					<div className="character-stats">
						<span>激励骰 <b>{bardInspirationDie(level)}</b></span>
						<span>激励次数 <b>{inspirationRemaining} / {inspirationMaximum}</b></span>
						{bardSpellSaveDC(draft) !== null && <span>法术豁免 DC <b>{bardSpellSaveDC(draft)}</b></span>}
						{danceArmorClass(draft) !== null && <span>炫目舞步 AC <b>{danceArmorClass(draft)}</b></span>}
					</div>
					{level >= 5 && (
						<div className="revision-row">
							<span>激励之源：消耗一个法术位（无需动作）恢复 1 次激励；短休或长休也会恢复全部</span>
							<button type="button" className="button-secondary" aria-label="消耗法术位恢复激励" disabled={inspirationRemaining >= inspirationMaximum} onClick={() => onChange(spendSpellSlotForInspiration(draft))}>
								消耗最低环法术位恢复 1 次
							</button>
						</div>
					)}
					{level >= 18 && (
						<div className="revision-row">
							<span>先发激励：投先攻时若激励不足 2 次则补至 2 次</span>
							<button type="button" className="button-secondary" aria-label="使用先发激励" disabled={inspirationRemaining >= 2} onClick={() => onChange(useSuperiorInspiration(draft))}>
								补至 2 次
							</button>
						</div>
					)}
					{sub === 'glamour' && level >= 3 && (
						<div className="revision-row">
							<span>惑心魔法：重获一次使用（消耗一次激励，无需动作；长休也会恢复）</span>
							<button type="button" className="button-secondary" aria-label="消耗激励重置惑心魔法" disabled={remainingOf(draft, 'bard-glamour-beguiling') !== 0 || inspirationRemaining < 1} onClick={() => onChange(spendInspirationToResetBeguiling(draft))}>
								消耗激励重置
							</button>
						</div>
					)}
					{sub === 'glamour' && level >= 6 && (
						<div className="revision-row">
							<span>威仪作锦：重获一次使用（消耗三环或更高法术位；长休也会恢复）</span>
							<button type="button" className="button-secondary" aria-label="消耗法术位重置威仪作锦" disabled={remainingOf(draft, 'bard-glamour-majesty') !== 0} onClick={() => onChange(spendSlotToResetMajesty(draft))}>
								消耗三环法术位重置
							</button>
						</div>
					)}
					{blade && <p className="character-help">炫目舞步：徒手伤害可造成 {blade.dice} {sign(blade.bonus)} 钝击（不消耗激励）。</p>}
					{sub === 'glamour' && level >= 3 && <p className="character-help">灵感织衣：至多 {inspiringMovementTargets(draft)} 个生物各获得 {inspiringMovementTempHp(draft)} 临时生命值，并可反应移动。</p>}
					{sub === 'valor' && level >= 3 && <p className="character-help">战争训练：军用武器、中甲与盾牌熟练，武器可作吟游法器。角色卡护甲为自由填写，请手动核对熟练是否匹配；武器熟练同样需手动记录。</p>}
					{sub === 'lore' && level >= 14 && <p className="character-help">超凡技艺：属性或攻击检定失败时消耗一次激励加骰；若加后仍失败则不消耗。</p>}
				</>
			)}
		</section>
	);
}

export function MonkBardSheetGroup({ draft }: FieldProps) {
	if (!isMonk(draft) && !isBard(draft)) return null;
	const c = draft.details?.fighterCalculator;
	if (!c) return null;
	const level = draft.level;
	const prepared = alwaysPreparedMonkBard(draft);
	const state = monkBardState(draft);
	const facts: string[] = [];
	if (isMonk(draft)) {
		facts.push(`武艺骰 ${martialArtsDie(level)}`);
		if (monkFocusSaveDC(draft) !== null) facts.push(`功力 ${monkFocusRemaining(draft)} / ${monkFocusMaximum(draft)}（豁免 DC ${monkFocusSaveDC(draft)}）`);
		if (monkUnarmoredArmorClass(draft) !== null) facts.push(`无甲防御 AC ${monkUnarmoredArmorClass(draft)}`);
		if (monkUnarmoredMovementBonus(draft) > 0) facts.push(`无甲移动 +${monkUnarmoredMovementBonus(draft)} 尺`);
		if (draft.level >= 14) facts.push('圆融自在：六项豁免均熟练（已计入豁免面板）');
		if (elementalAttunementActive(draft)) facts.push(`元素同调生效中：触及 +${elementalReachBonus(draft)} 尺${level >= 11 ? `，飞行/游泳 ${elementalFlySpeed(draft)} 尺` : ''}${state.elementalResistance ? `，抗性：${state.elementalResistance}` : ''}`);
	} else {
		facts.push(`激励骰 ${bardInspirationDie(level)}，次数 ${bardicInspirationRemaining(draft)} / ${bardInspirationMaximum(draft)}`);
		if (bardSpellSaveDC(draft) !== null) facts.push(`法术豁免 DC ${bardSpellSaveDC(draft)}`);
		if (danceArmorClass(draft) !== null) facts.push(`炫目舞步 AC ${danceArmorClass(draft)}（规则值；角色卡护甲等级由 Lead 合并后同步）`);
	}
	return (
		<section className="character-section">
			<h2>武僧与吟游诗人特性</h2>
			<p className="sheet-text">{facts.join(' · ')}</p>
			{prepared.length > 0 && <p className="sheet-text">常备法术/戏法：{prepared.map(x => `${x.name}（${x.source}）`).join('、')}</p>}
			{c.subclass === 'shadow' && level >= 3 && <p className="character-help">暗影技艺：黑暗视觉已计入感官面板；黑暗术的可看穿与移动区域需手动处理。</p>}
			{c.subclass === 'shadow' && level >= 6 && <p className="character-help">暗影步：微光或黑暗环境中附赠传送 60 尺，需手动确认目标空间的光照。</p>}
			{c.subclass === 'elements' && level >= 17 && !state.elementalResistance && <p className="character-help">四象神通：尚未记录抗性类型，请在编辑页选择。</p>}
			{c.subclass === 'valor' && <p className="character-help">战斗激励：激励骰加 AC 或伤害，以及额外攻击/战斗魔法的攻击次数，需手动结算。</p>}
			{c.subclass === 'lore' && level >= 3 && <p className="character-help">语出惊人：反应消耗激励，从敌方伤害或成功检定中减去激励骰，需手动结算。</p>}
			<p className="character-help">战斗轮内生效的特性（武艺的附赠攻击、拨挡攻击、震慑拳、反射闪避、抗性等）不进入自动结算；本清单只要求角色卡可记录部分。</p>
		</section>
	);
}
