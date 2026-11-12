import type { CharacterDraft } from './characters';
export const divinerSightOptions=['黑暗视觉','高等通晓','识破隐形'] as const;
export function divinerSight(draft:CharacterDraft){
 const c=draft.details?.fighterCalculator;
 if(c?.characterClass!=='法师'||c.subclass!=='diviner'||draft.level<10)return undefined;
 return c.divinerSight&&divinerSightOptions.includes(c.divinerSight)?c.divinerSight:undefined;
}
