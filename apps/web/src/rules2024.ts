/** Small, explicitly scoped SRD 5.2.1 calculations. Unknown choices are rejected. */
export const classes2024 = {
  '野蛮人':12,'吟游诗人':8,'牧师':8,'德鲁伊':8,'战士':10,'武僧':8,
  '圣武士':10,'游侠':10,'游荡者':8,'术士':6,'邪术师':8,'法师':6,
} as const;
export const species2024 = {'阿斯莫':30,'龙裔':30,'矮人':30,'精灵':30,'侏儒':30,'歌利亚':35,'半身人':30,'人类':30,'兽人':30,'提夫林':30} as const;
export type Class2024 = keyof typeof classes2024;
export type Species2024 = keyof typeof species2024;
export function firstLevelMaxHp(characterClass:Class2024,constitution:number,species:Species2024):number {
  if(!Object.hasOwn(classes2024,characterClass)||!Object.hasOwn(species2024,species)||!Number.isInteger(constitution)||constitution<1||constitution>30)throw Error('职业、物种或体质无效。');
  return Math.max(1,classes2024[characterClass]+Math.floor((constitution-10)/2))+(species==='矮人'?1:0);
}
export function baseSpeed(species:Species2024,elfLineage?:'木精灵'|'高等精灵'|'卓尔'):number {
  if(!Object.hasOwn(species2024,species))throw Error('未知物种。');
  if(species==='精灵'&&(!elfLineage||!['木精灵','高等精灵','卓尔'].includes(elfLineage)))throw Error('请选择有效的精灵血统。');
  if(species!=='精灵'&&elfLineage)throw Error('只有精灵可以选择精灵血统。');
  return species==='精灵'&&elfLineage==='木精灵'?35:species2024[species];
}
/** Fixed HP choice for a single-class character; excludes optional features and rolled level gains. */
export function fixedClassHp(characterClass:Class2024,constitution:number,species:Species2024,level:number):number {
  if(!Number.isInteger(level)||level<1||level>20)throw Error('等级须为 1 至 20。');
  const first=firstLevelMaxHp(characterClass,constitution,species);
  const modifier=Math.floor((constitution-10)/2);
  const fixed=Math.floor(classes2024[characterClass]/2)+1;
  return first+(level-1)*(Math.max(1,fixed+modifier)+(species==='矮人'?1:0));
}
const armorData={
  none:{base:10,dex:'full'},padded:{base:11,dex:'full'},leather:{base:11,dex:'full'},studded:{base:12,dex:'full'},
  hide:{base:12,dex:'max2'},chainShirt:{base:13,dex:'max2'},scale:{base:14,dex:'max2'},breastplate:{base:14,dex:'max2'},halfPlate:{base:15,dex:'max2'},
  ring:{base:14,dex:'none'},chain:{base:16,dex:'none'},splint:{base:17,dex:'none'},plate:{base:18,dex:'none'},
} as const;
export type Armor2024=keyof typeof armorData;
/** Standard armor only; does not include class defenses, spells, feats or magic items. */
export function standardArmorClass(armor:Armor2024,dexterity:number,shield:boolean,shieldTrained:boolean):number {
  if(!Object.hasOwn(armorData,armor)||!Number.isInteger(dexterity)||dexterity<1||dexterity>30)throw Error('护甲或敏捷无效。');
  const data=armorData[armor];const dex=Math.floor((dexterity-10)/2);
  return data.base+(data.dex==='full'?dex:data.dex==='max2'?Math.min(2,dex):0)+(shield&&shieldTrained?2:0);
}
