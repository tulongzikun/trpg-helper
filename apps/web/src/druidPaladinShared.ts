import type { CharacterDraft } from './characters';
// 德鲁伊 / 圣武士共用的草稿字段访问层：新字段先在此集中声明，待 Lead 合并进 characters.ts。
type BaseConfig=NonNullable<NonNullable<CharacterDraft['details']>['fighterCalculator']>;
export type WeaponMasteryChoice={weapon:string;property:string};
export type DruidPaladinConfig=BaseConfig&{
 elementalFury?:'potent'|'primal'|'';
 wildShapeActive?:string;
 wildCompanionActive?:boolean;
 natureMagicianUsed?:boolean;
 epicBoon?:string;
 weaponMasteries?:WeaponMasteryChoice[];
 fightingStyle?:string;
 seaWrathActive?:boolean;
 oathCapstoneActive?:boolean;
};
export function dpConfig(draft:CharacterDraft):DruidPaladinConfig|undefined{
 return draft.details?.fighterCalculator as DruidPaladinConfig|undefined;
}
export function patchConfig(draft:CharacterDraft,patch:Partial<DruidPaladinConfig>):CharacterDraft{
 const details=draft.details,c=dpConfig(draft);if(!details||!c)return draft;
 return {...draft,details:{...details,fighterCalculator:{...c,...patch} as BaseConfig}};
}
export function isDruid(draft:CharacterDraft):boolean{
 return dpConfig(draft)?.characterClass==='德鲁伊';
}
export function isPaladin(draft:CharacterDraft):boolean{
 return dpConfig(draft)?.characterClass==='圣武士';
}
export function epicBoon(draft:CharacterDraft):string{
 const value=dpConfig(draft)?.epicBoon;return typeof value==='string'?value.trim():'';
}
export function setEpicBoon(draft:CharacterDraft,name:string):CharacterDraft{
 if(draft.level<19)return draft;return patchConfig(draft,{epicBoon:name.trim()});
}
