import type {CharacterDraft} from './characters';
const dice:Record<string,number>={'野蛮人':12,'战士':10,'圣武士':10,'游侠':10,'吟游诗人':8,'牧师':8,'德鲁伊':8,'武僧':8,'游荡者':8,'邪术师':8,'术士':6,'法师':6};
export const armorTable:Record<string,{base:number;kind:'none'|'light'|'medium'|'heavy';strength?:number}>={'无甲':{base:10,kind:'none'},'布甲':{base:11,kind:'light'},'皮甲':{base:11,kind:'light'},'镶钉皮甲':{base:12,kind:'light'},'兽皮甲':{base:12,kind:'medium'},'链甲衫':{base:13,kind:'medium'},'鳞甲':{base:14,kind:'medium'},'胸甲':{base:14,kind:'medium'},'半身板甲':{base:15,kind:'medium'},'环甲':{base:14,kind:'heavy'},'锁子甲':{base:16,kind:'heavy',strength:13},'条板甲':{base:17,kind:'heavy',strength:15},'板甲':{base:18,kind:'heavy',strength:15}};
const mod=(n:number)=>Math.floor((n-10)/2);
const classBasics:Record<string,string>={'野蛮人':'狂暴、无甲防御、武器精通','吟游诗人':'吟游诗人激励、施法','牧师':'施法、神圣职司','德鲁伊':'德鲁伊语、原始职司、施法','战士':'战斗风格、回气、武器精通','武僧':'武术、无甲防御','圣武士':'圣疗、施法、武器精通','游侠':'宿敌、施法、武器精通','游荡者':'专精、偷袭、盗贼黑话、武器精通','术士':'施法、天赋法术','邪术师':'魔能祈唤、契约魔法','法师':'施法、仪式学者、奥术回想'};
const speciesBasics:Record<string,string>={'龙裔':'龙族先祖、吐息武器、伤害抗性、黑暗视觉','矮人':'黑暗视觉、矮人韧性、矮人坚韧、石之灵觉','精灵':'黑暗视觉、精灵血统、妖精血统、敏锐感官、出神','侏儒':'黑暗视觉、侏儒狡黠、侏儒血统','歌利亚':'巨人先祖、强壮体格','半身人':'勇敢、半身人灵巧、幸运、天生隐匿','人类':'足智多谋、技艺娴熟、多才多艺','兽人':'肾上腺素冲刺、黑暗视觉、坚韧不屈','提夫林':'黑暗视觉、邪魔传承、异界存在'};
const species=['龙裔','矮人','精灵','侏儒','歌利亚','半身人','人类','兽人','提夫林'];
export function deriveCharacter(d:CharacterDraft):CharacterDraft {
 if(!d.details?.autoRules)return d;
 const hitDie=dice[d.characterClass];const armor=armorTable[d.details.armor??'无甲'];
 // Unrecognized custom choices cannot be calculated; preserve existing values.
 if(!hitDie||!armor||!species.includes(d.species)||!Number.isInteger(d.level)||d.level<1||d.level>20||Object.values(d.abilities).some(v=>!Number.isFinite(v)))return d;
 const dex=mod(d.abilities.dex),con=mod(d.abilities.con),wis=mod(d.abilities.wis);
 const maxHp=hitDie+con+(d.level-1)*Math.max(1,hitDie/2+1+con)+(d.species==='矮人'?d.level:0);
 let ac=armor.base+(armor.kind==='light'||armor.kind==='none'?dex:armor.kind==='medium'?Math.min(2,dex):0);
 if(armor.kind==='none'&&d.characterClass==='野蛮人')ac=Math.max(ac,10+dex+con);
 if(armor.kind==='none'&&d.characterClass==='武僧'&&!d.details.shield)ac=Math.max(ac,10+dex+wis);
 if(armor.kind==='none'&&d.characterClass==='术士'&&d.subclass==='龙族血脉'&&d.level>=3)ac=Math.max(ac,13+dex);
 const canShield=['野蛮人','牧师','德鲁伊','战士','圣武士','游侠'].includes(d.characterClass)||(d.characterClass==='吟游诗人'&&d.subclass==='勇气学院'&&d.level>=3);
 if(d.details.shield&&canShield)ac+=2;
 let speed=d.species==='歌利亚'||(d.species==='精灵'&&d.details.elfLineage==='木精灵')?35:30;
 if(armor.strength&&d.abilities.str<armor.strength)speed-=10;
 if(d.characterClass==='野蛮人'&&d.level>=5&&armor.kind!=='heavy')speed+=10;
 if(d.characterClass==='武僧'&&d.level>=2&&armor.kind==='none'&&!d.details.shield)speed+=d.level>=18?30:d.level>=14?25:d.level>=10?20:d.level>=6?15:10;
 return {...d,maxHp,armorClass:ac,speedFt:speed,details:{...d.details,features:`一级职业特性：${classBasics[d.characterClass]}\n物种特性：${speciesBasics[d.species]}${d.level>=5&&d.species==='歌利亚'?'、巨人化':d.level>=5&&d.species==='龙裔'?'、龙翼飞行':''}\n此处仅列出基础特性名称；高等级、子职业及需选择的特性尚未生成或计入数值。`}};
}
export function automaticError(d:CharacterDraft):string|null {
 if(!d.details?.autoRules)return null;
 if(!dice[d.characterClass]||!species.includes(d.species))return '自动计算目前仅支持内置职业和物种。';
 if(d.species==='精灵'&&!d.details.elfLineage)return '请选择精灵血统。';
 return null;
}
