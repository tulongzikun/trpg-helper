import type { CharacterDraft } from './characters';
export const wildAspects=['枭','豹','鲑'] as const;
export function wildHeart(draft:CharacterDraft){
 const c=draft.details?.fighterCalculator;
 if(c?.characterClass!=='野蛮人'||c.subclass!=='wild-heart'||draft.level<3)return null;
 return {aspect:draft.level>=6&&c.wildAspect&&wildAspects.includes(c.wildAspect)?c.wildAspect:undefined,
  rituals:[...['野兽感官','动物交谈'],...(draft.level>=10?['问道自然']:[])]};
}
