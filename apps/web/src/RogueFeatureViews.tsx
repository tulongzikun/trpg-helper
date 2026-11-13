import type { CharacterDraft } from './characters';
import { classResources } from './classResources.ts';
import { arcaneTricksterState, assassinState, rogueState, soulknifeState, thiefState } from './clericRogueRules.ts';
import { resetSoulknifeFeature, setRogueWeaponMastery, spendSoulknifePsi } from './clericRogue.ts';

const remaining = (draft: CharacterDraft, id: string) => classResources(draft).find(x => x.id === id)?.remaining ?? 0;

export function RogueFeatureEditor({ draft, onChange }: { draft: CharacterDraft; onChange: (draft: CharacterDraft) => void }) {
 const c = draft.details?.fighterCalculator;
 if (c?.characterClass !== '游荡者') return null;
 const rogue = rogueState(draft), soul = soulknifeState(draft), arcane = arcaneTricksterState(draft), assassin = assassinState(draft), thief = thiefState(draft);
 const psiRemaining = remaining(draft, 'soulknife-psi');
 const mastery = rogue?.weaponMasteryChoices ?? [];
 return <section className="character-section">
  <h2>游荡者特性</h2>
  {rogue && <div>
   <h3>偷袭与诡诈打击</h3>
   <p className="sheet-text">偷袭：{rogue.sneakDice}d6（每回合一次，满足优势或邻近盟友条件时）。诡诈打击豁免 DC {rogue.cunningStrikeDC}。</p>
   <p className="character-help">偷袭：使用灵巧或远程武器命中时，若具有优势，或目标 5 尺内有未失能的盟友且你未处于劣势，可额外造成伤害。</p>
   {rogue.options.length > 0 && <p className="character-help">诡诈打击（额外效果需先扣除上列偷袭骰）：{rogue.options.map(x => `${x.name}（${x.dice}d6${x.save ? `，${x.save}豁免` : '，无需豁免'}）`).join('；')}。</p>}
   {rogue.advanced && <p className="character-help">11 级起，一次偷袭可同时选择两种诡诈打击效果，各自扣除所需骰数。</p>}
   {rogue.deadly && <p className="character-help">凶狡打击选项：恍惚、击昏、眩目；豁免失败的效果与持续时间见上。</p>}
  </div>}
  {rogue && <div>
   <h3>武器精通</h3>
   <label>武器精通武器一<input aria-label="武器精通武器一" value={mastery[0] ?? ''} onChange={e => onChange(setRogueWeaponMastery(draft, 0, e.target.value))} /></label>
   <label>武器精通武器二<input aria-label="武器精通武器二" value={mastery[1] ?? ''} onChange={e => onChange(setRogueWeaponMastery(draft, 1, e.target.value))} /></label>
   <p className="character-help">记录两种已熟练武器及其精通词条；长休后可更换。武器清单与词条效果需手动管理。</p>
  </div>}
  <div>
   <h3>游荡者基础能力</h3>
   <p className="character-help">灵巧动作：可用附赠动作疾走、撤离或躲藏。</p>
   <p className="character-help">稳定瞄准：附赠动作使下一次攻击具有优势，之后本回合速度变为 0；移动限制需在战斗中自行确认。</p>
   <p className="character-help">直觉闪避：以反应将命中的攻击伤害减半。</p>
   <p className="character-help">反射闪避：敏捷豁免成功时免受半伤效应伤害，失败时仍受一半伤害；失能时不可用。</p>
   {rogue?.reliable && <p className="character-help">可靠才能：熟练技能或工具的属性检定，D20 结果 9 及以下视为 10（已在技能与工具检定计算器中体现）。</p>}
   {rogue?.slipperyMind && <p className="character-help">圆滑心智：获得感知与魅力豁免熟练；豁免加值显示需由通用豁免栏手动补记。</p>}
   {rogue?.elusive && <p className="character-help">飘忽不定：未失能时，针对你的攻击检定不能具有优势。</p>}
  </div>
  {soul && <div>
   <h3>魂刃</h3>
   <p className="sheet-text">灵能骰：{soul.label}，剩余 {psiRemaining} / {soul.count} 枚（d{soul.die}）。短休恢复 1 枚，长休全部恢复。</p>
   <p className="character-help">灵振诀窍：熟练技能或工具检定失败时，可投 1 枚灵能骰加到结果；仅当因此变为成功时才消耗该骰。</p>
   <p className="sheet-text">心灵低语：免费使用剩余 {remaining(draft, 'soulknife-whispers')} / 1 次。</p>
   <button type="button" className="button-secondary" disabled={psiRemaining < 1} onClick={() => onChange(spendSoulknifePsi(draft, 1))}>消耗 1 枚灵能骰使用心灵低语</button>
   <p className="character-help">念刃：攻击动作或借机攻击时在空闲手塑造简易近战/远程武器，命中造成 1d6 心灵伤害并加攻击属性调整值；具有灵巧与投掷 60/120 尺，精通侵扰；攻击后消失。同一回合另一手空闲时，可用附赠动作塑造第二把并攻击，该次伤害为 1d4。</p>
   {soul.soulBlades && <p className="character-help">灵魂之刃：念刃攻击未命中时，可投 1 枚灵能骰加到攻击检定（因此命中才消耗）；可用附赠动作消耗 1 枚灵能骰并传送至多骰值×10 尺。</p>}
   {soul.veil && <div>
    <p className="sheet-text">灵能面纱：剩余 {remaining(draft, 'soulknife-veil')} / 1 次；隐形至多 1 小时，长休恢复。</p>
    <button type="button" className="button-secondary" disabled={remaining(draft, 'soulknife-veil') > 0 || psiRemaining < soul.veilCost} onClick={() => onChange(resetSoulknifeFeature(draft, 'veil'))}>消耗 {soul.veilCost} 枚灵能骰重置灵能面纱</button>
   </div>}
   {soul.rendMind && <div>
    <p className="sheet-text">撕裂心智：剩余 {remaining(draft, 'soulknife-rend-mind')} / 1 次；念刃偷袭伤害迫使感知豁免，长休恢复。</p>
    <button type="button" className="button-secondary" disabled={remaining(draft, 'soulknife-rend-mind') > 0 || psiRemaining < soul.rendCost} onClick={() => onChange(resetSoulknifeFeature(draft, 'rend-mind'))}>消耗 {soul.rendCost} 枚灵能骰重置撕裂心智</button>
   </div>}
  </div>}
  {arcane && <div>
   <h3>奥术诡术师</h3>
   <p className="character-help">施法：法师戏法 {arcane.cantripLimit} 道（法师之手固定且不占选择），法术位与准备法术在法术区域选择；施法属性为智力。</p>
   <p className="character-help">法师之手诈术：法师之手可用附赠动作施放与控制，幽灵手隐形，并可用其进行敏捷（巧手）检定。</p>
   {arcane.magicalAmbush && <p className="character-help">诡术伏击：处于隐形状态时施法，目标对抗该法术的豁免具有劣势。</p>}
   {arcane.versatileTrickster && <p className="character-help">万能诡术：对生物使用诡诈打击摔绊时，可同时对法师之手 5 尺内另一生物施加同效果。</p>}
   {arcane.spellThief && <p className="sheet-text">法术窃贼：剩余 {remaining(draft, 'rogue-spell-thief')} / 1 次；以反应迫使施法者智力豁免，失败则法术对你无效；偷学与准备需手动处理。</p>}
  </div>}
  {assassin && <div>
   <h3>刺客</h3>
   <p className="character-help">暗杀：先攻检定具有优势；战斗第一轮对尚未行动的生物攻击具有优势；该轮命中并偷袭时额外造成等于游荡者等级的伤害。</p>
   <p className="character-help">刺客工具：已自动获得易容工具与制毒工具熟练。</p>
   {assassin.infiltration && <p className="character-help">专业渗透：模仿大师（至少 1 小时钻研后可模仿他人言语或笔迹）；机动瞄准（使用稳定瞄准时速度不归零）。</p>}
   {assassin.poisoner && <p className="character-help">淬毒武器：目标对抗淬毒豁免失败时，额外受到 2d6 毒素伤害且无视毒素抗性。</p>}
   {assassin.deathStrike && <p className="character-help">致命袭杀：战斗第一轮命中并偷袭时，目标体质豁免（DC 8+熟练+敏捷）；失败则本次攻击伤害翻倍。</p>}
  </div>}
  {thief && <div>
   <h3>盗贼</h3>
   <p className="character-help">快手：附赠动作可用盗贼工具进行敏捷（巧手）检定开锁、解除陷阱或扒窃，或执行使用物件动作。</p>
   <p className="character-help">梁上君子：获得等于速度的攀爬速度；跳跃距离可改用敏捷计算（跳跃距离区域已显示）。</p>
   {thief.supremeSneak && <p className="character-help">极效潜行：新增诡诈打击选项「无声袭击」（花费 1d6）；处于躲藏动作的隐形状态并在四分之三或全身掩护后结束回合时，本次攻击不终止隐形。</p>}
   {thief.useMagicDevice && <p className="character-help">使用魔法装置：同调上限提升为 4 件；使用消耗充能的魔法物品时投 d6，掷出 6 则不消耗充能；可使用任意法术卷轴（智力为施法属性，戏法与一环稳定，高环需智力（奥秘）检定 DC 10+环阶）。同调上限已接入，充能与卷轴需手动处理。</p>}
   {thief.reflexes && <p className="character-help">窃盗本能：每场战斗第一轮可行动两个回合：正常先攻一回合，再以先攻 -10 执行第二回合。</p>}
  </div>}
  {rogue?.luckyStrike && <div>
   <h3>幸运一击</h3>
   <p className="sheet-text">剩余 {remaining(draft, 'rogue-lucky-strike')} / 1 次；D20 检定失败时可改为 20，短休或长休恢复。</p>
  </div>}
 </section>;
}

export function RogueFeatureSheet({ draft }: { draft: CharacterDraft }) {
 const c = draft.details?.fighterCalculator;
 if (c?.characterClass !== '游荡者') return null;
 const rogue = rogueState(draft), soul = soulknifeState(draft), arcane = arcaneTricksterState(draft), assassin = assassinState(draft), thief = thiefState(draft);
 return <section className="character-section">
  <h2>游荡者特性</h2>
  {rogue && <p className="sheet-text">偷袭 {rogue.sneakDice}d6；诡诈打击 DC {rogue.cunningStrikeDC}；武器精通：{rogue.weaponMasteryChoices.filter(Boolean).join('、') || '尚未记录'}。</p>}
  {rogue && <p className="character-help">灵巧动作（疾走/撤离/躲藏）；稳定瞄准；直觉闪避；反射闪避。{rogue.reliable ? '可靠才能：熟练检定 D20 下限 10。' : ''}{rogue.slipperyMind ? '圆滑心智：感知与魅力豁免熟练（需手动记入豁免）。' : ''}{rogue.elusive ? '飘忽不定。' : ''}</p>}
  {soul && <p className="sheet-text">魂刃：灵能骰 {soul.label}，剩 {remaining(draft, 'soulknife-psi')} 枚；心灵低语 {remaining(draft, 'soulknife-whispers')} / 1；念刃 1d6（附赠第二把 1d4）。{soul.soulBlades ? '灵魂之刃；' : ''}{soul.veil ? `灵能面纱 ${remaining(draft, 'soulknife-veil')} / 1；` : ''}{soul.rendMind ? `撕裂心智 ${remaining(draft, 'soulknife-rend-mind')} / 1。` : ''}</p>}
  {arcane && <p className="sheet-text">奥术诡术师：法师戏法 {arcane.cantripLimit} 道；法师之手诈术。{arcane.magicalAmbush ? '诡术伏击；' : ''}{arcane.versatileTrickster ? '万能诡术；' : ''}{arcane.spellThief ? `法术窃贼 ${remaining(draft, 'rogue-spell-thief')} / 1。` : ''}</p>}
  {assassin && <p className="sheet-text">刺客：暗杀；易容工具与制毒工具熟练。{assassin.infiltration ? '专业渗透；' : ''}{assassin.poisoner ? '淬毒武器（+2d6 毒素）；' : ''}{assassin.deathStrike ? '致命袭杀。' : ''}</p>}
  {thief && <p className="sheet-text">盗贼：快手；梁上君子（攀爬速度，跳跃用敏捷）。{thief.supremeSneak ? '极效潜行（无声袭击）；' : ''}{thief.useMagicDevice ? '使用魔法装置（同调 4 件）；' : ''}{thief.reflexes ? '窃盗本能。' : ''}</p>}
  {rogue?.luckyStrike && <p className="sheet-text">幸运一击：剩 {remaining(draft, 'rogue-lucky-strike')} / 1 次；D20 检定失败改为 20。</p>}
 </section>;
}
