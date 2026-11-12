import type { CharacterDraft } from './characters';
import { proficiencyBonus } from './characterRules.ts';
export const dragonAncestry={黑龙:'强酸',蓝龙:'闪电',黄铜龙:'火焰',青铜龙:'闪电',赤铜龙:'强酸',金龙:'火焰',绿龙:'毒素',红龙:'火焰',银龙:'寒冷',白龙:'寒冷'} as const;
export type DragonAncestry=keyof typeof dragonAncestry;
export const giantAncestry={云巨人:'以附赠动作传送至 30 尺内可见的未占据空间。',火巨人:'攻击命中并造成伤害时，额外造成 1d10 火焰伤害。',霜巨人:'攻击命中并造成伤害时，额外造成 1d6 寒冷伤害并使目标速度降低 10 尺。',丘陵巨人:'攻击命中并造成伤害时，可使大型或更小目标倒地。',石巨人:'受到伤害时，以反应减少 1d12 加体质调整值的伤害。',风暴巨人:'受到 60 尺内生物伤害时，以反应对其造成 1d8 雷鸣伤害。'} as const;
export type GiantAncestry=keyof typeof giantAncestry;
export function speciesExploration(draft:CharacterDraft){
 const c=draft.details?.fighterCalculator;if(!c)return null;
 const ancestry=c.dragonAncestry;
 const resistance=c.species==='龙裔'&&ancestry&&Object.hasOwn(dragonAncestry,ancestry)?dragonAncestry[ancestry]:c.species==='矮人'?'毒素':undefined;
 const giant=c.species==='歌利亚'&&c.giantAncestry&&Object.hasOwn(giantAncestry,c.giantAncestry)?c.giantAncestry:undefined;
 return {resistance,carryLbs:draft.abilities.str*15*(c.species==='歌利亚'?2:1),powerfulBuild:c.species==='歌利亚',giant,giantUses:giant?proficiencyBonus(draft.level):0,stoneUses:c.species==='矮人'?proficiencyBonus(draft.level):0};
}
