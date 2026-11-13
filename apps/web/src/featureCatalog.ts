import type { CharacterDraft } from './characters.ts';
import { subclassLabel } from './subclasses.ts';
import type { GroupFeatureData } from './groups/data/types.ts';
import * as barbarianRangerData from './groups/data/barbarianRanger.ts';
import * as clericRogueData from './groups/data/clericRogue.ts';
import * as druidPaladinData from './groups/data/druidPaladin.ts';
import * as fighterWarlockData from './groups/data/fighterWarlock.ts';
import * as monkBardData from './groups/data/monkBard.ts';
import * as wizardSorcererData from './groups/data/wizardSorcerer.ts';
import * as speciesOriginData from './groups/data/speciesOrigin.ts';
type Feature={level:number;name:string;note?:string};
export const classFeatures:Record<string,Feature[]>={
 '野蛮人':[{level:1,name:'狂暴'},{level:1,name:'无甲防御'},{level:1,name:'武器精通'},{level:2,name:'危机感应'},{level:2,name:'鲁莽攻击'},{level:5,name:'额外攻击'},{level:5,name:'快速移动'}],
 '吟游诗人':[{level:1,name:'吟游诗人激励'},{level:1,name:'施法'},{level:2,name:'万事通'},{level:2,name:'专精'}],
 '牧师':[{level:1,name:'施法'},{level:1,name:'圣职'},{level:2,name:'引导神力'}],
 '德鲁伊':[{level:1,name:'德鲁伊语'},{level:1,name:'施法'},{level:1,name:'原初职司'},{level:2,name:'荒野变身'},{level:2,name:'荒野伙伴'}],
 '战士':[{level:1,name:'战斗风格'},{level:1,name:'回气'},{level:1,name:'武器精通'},{level:2,name:'动作如潮'},{level:2,name:'战术思维'},{level:5,name:'额外攻击'},{level:5,name:'战术转进'}],
 '武僧':[{level:1,name:'武艺'},{level:1,name:'无甲防御'},{level:2,name:'专注力'},{level:2,name:'无甲移动'},{level:2,name:'不可思议的新陈代谢'},{level:3,name:'卸力攻击'},{level:5,name:'额外攻击'},{level:5,name:'震慑打击'}],
 '圣武士':[{level:1,name:'圣疗'},{level:1,name:'施法'},{level:1,name:'武器精通'},{level:2,name:'战斗风格'},{level:2,name:'圣武士至圣斩'},{level:3,name:'引导神力'},{level:5,name:'额外攻击'},{level:6,name:'守护灵光'}],
 '游侠':[{level:1,name:'宿敌'},{level:1,name:'施法'},{level:1,name:'武器精通'},{level:2,name:'熟练探险家'},{level:2,name:'战斗风格'},{level:5,name:'额外攻击'},{level:6,name:'越野'}],
 '游荡者':[{level:1,name:'专精'},{level:1,name:'偷袭'},{level:1,name:'盗贼黑话'},{level:1,name:'武器精通'},{level:2,name:'灵巧动作'},{level:3,name:'稳定瞄准'},{level:5,name:'诡诈打击'}],
 '术士':[{level:1,name:'施法'},{level:1,name:'先天魔法'},{level:2,name:'魔力之源'},{level:2,name:'超魔'}],
 '邪术师':[{level:1,name:'魔能祈唤'},{level:1,name:'契约魔法'},{level:2,name:'魔法狡黠'}],
 '法师':[{level:1,name:'施法'},{level:1,name:'仪式行家'},{level:1,name:'奥术回想'},{level:2,name:'学者'}],
};
export const classNotes:Record<string,string>={
 '狂暴':'进入狂暴，增强力量战斗并获得部分伤害抗性。','无甲防御':'未穿护甲时使用职业规定的无甲 AC 公式。','武器精通':'使用所选武器的掌握属性。','危机感应':'对可见的敏捷豁免获得优势，受状态限制。','鲁莽攻击':'以力量进行近战攻击时可换取优势，但攻击者也获得优势。','额外攻击':'执行攻击动作时可进行两次攻击。','快速移动':'不穿重甲时速度增加 10 尺。',
 '吟游诗人激励':'给予盟友激励骰，帮助其完成检定或豁免。','施法':'根据职业法术列表、法术位和施法属性施放法术。','万事通':'对不熟练的属性检定加上部分熟练加值。','专精':'为选定的熟练技能提供双倍熟练加值。','圣职':'选择牧师的圣职并获得相应训练或魔法能力。','引导神力':'使用引导神力次数产生职业或子职业效果。',
 '德鲁伊语':'掌握德鲁伊语并始终准备动物交谈。','原初职司':'选择原初职司以获得战斗训练或施法辅助。','荒野变身':'消耗使用次数变为已知的野兽形态。','荒野伙伴':'消耗资源召唤临时魔宠。','战斗风格':'选择符合资格的战斗风格专长。','回气':'用附赠动作恢复生命，可按规则恢复使用次数。','动作如潮':'在自己的回合中获得一个额外动作，受使用次数限制。','战术思维':'消耗回气次数改善失败的属性检定。','战术转进':'使用回气时可按规则移动且不引发借机攻击。',
 '武艺':'未穿护甲且未持盾时强化徒手打击和武僧武器。','专注力':'获得专注点并以其发动武僧技巧。','无甲移动':'未穿护甲且未持盾时，速度随武僧等级增加。','不可思议的新陈代谢':'掷先攻时可恢复专注点并恢复生命，次数有限。','卸力攻击':'以反应减少受到的攻击伤害，符合条件可报偿。','震慑打击':'攻击命中时消耗专注点迫使目标进行体质豁免。','圣疗':'用附赠动作消耗治疗池恢复生命或结束中毒。','圣武士至圣斩':'准备至圣斩并获得一定次数的免费施放。','守护灵光':'自身与邻近盟友的豁免获得魅力调整值加值。',
 '宿敌':'准备猎人印记并获得一定次数的免费施放。','熟练探险家':'获得技能专精以及语言等探索能力。','越野':'不穿重甲时速度增加，并获得等同速度的攀爬与游泳速度。','偷袭':'符合条件时，攻击每回合可造成额外伤害。','盗贼黑话':'掌握盗贼黑话并习得额外语言。','灵巧动作':'可用附赠动作疾走、撤离或躲藏。','稳定瞄准':'满足移动限制时可用附赠动作使下一次攻击获得优势。','诡诈打击':'牺牲部分偷袭伤害以施加额外效果。',
 '先天魔法':'以附赠动作激发术法，使术士法术更有效。','魔力之源':'获得术法点并可转换术法点与法术位。','超魔':'消耗术法点改变施法方式。','魔能祈唤':'选择魔能祈唤以获得额外魔法能力。','契约魔法':'按照邪术师契约魔法规则施法并恢复法术位。','魔法狡黠':'按规则恢复已消耗的契约魔法位。','仪式行家':'可以仪式方式施展法术书中具备仪式标签的法术。','奥术回想':'短休后恢复一定数量的法术位。','学者':'选择一项知识技能并获得该技能专精。'
};
export const speciesFeatures:Record<string,string[]>={
 '阿斯莫':['黑暗视觉','天界抗性','治疗之手','光明使者','天界启示（3 级）'],
 '龙裔':['龙族血脉（需选择）','吐息武器','伤害抗性','黑暗视觉'],
 '矮人':['黑暗视觉','矮人韧性','矮人坚韧','石中精明'],
 '精灵':['黑暗视觉','精灵血统','妖精血脉','敏锐感官','出神'],
 '侏儒':['黑暗视觉','侏儒狡黠','侏儒血统（需选择）'],
 '歌利亚':['巨人血脉（需选择）','巨人形态（5 级）','强壮体格'],
 '半身人':['勇敢','半身人灵活','幸运','天生潜行'],
 '人类':['足智多谋','技能多才','多面手'],
 '兽人':['肾上腺素激增','黑暗视觉','不懈耐力'],
 '提夫林':['黑暗视觉','异界传承（需选择）','邪魔遗艺'],
};
export const subclassFeatures:Record<string,Feature[]>={
 '野蛮人:berserker':[{level:3,name:'狂怒',note:'狂暴时以鲁莽攻击命中可造成额外伤害。'},{level:6,name:'无我狂暴'},{level:10,name:'报偿'},{level:14,name:'威慑之姿'}],
 '吟游诗人:lore':[{level:3,name:'额外熟练',note:'选择另外三项技能熟练。'},{level:3,name:'尖刻言辞'},{level:6,name:'魔法发现'},{level:14,name:'无双技能'}],
 '牧师:life':[{level:3,name:'生命门徒'},{level:3,name:'生命领域法术'},{level:3,name:'维持生命'},{level:6,name:'神祝医者'},{level:17,name:'极效治疗'}],
 '德鲁伊:land':[{level:3,name:'大地结社法术'},{level:3,name:'大地援助'},{level:6,name:'自然恢复'},{level:10,name:'自然守御'},{level:14,name:'自然庇护'}],
 '战士:champion':[{level:3,name:'精通重击',note:'武器攻击和徒手打击掷出 19 或 20 可重击。'},{level:3,name:'卓越运动员',note:'先攻与力量（运动）检定具有优势；重击后可移动半速且不引发借机攻击。'},{level:7,name:'额外战斗风格'},{level:10,name:'英勇战士'},{level:15,name:'卓越重击'},{level:18,name:'幸存者'}],
 '武僧:open-hand':[{level:3,name:'散打技术'},{level:6,name:'身心完整'},{level:11,name:'疾步'},{level:17,name:'震颤掌'}],
 '圣武士:devotion':[{level:3,name:'奉献之誓法术'},{level:3,name:'神圣武器'},{level:7,name:'奉献灵光'},{level:15,name:'守护斩击'},{level:20,name:'神圣武士'}],
 '游侠:hunter':[{level:3,name:'猎人学识'},{level:3,name:'猎杀技艺',note:'选择巨像杀手或破群斩；尚需手动记录。'},{level:7,name:'防御战术'},{level:11,name:'高阶猎杀技艺'},{level:15,name:'高阶防守战术'}],
 '游荡者:thief':[{level:3,name:'快手'},{level:3,name:'梁上君子'},{level:9,name:'极效潜行'},{level:13,name:'使用魔法装置'},{level:17,name:'窃盗本能'}],
 '术士:draconic':[{level:3,name:'龙族韧性',note:'生命上限增加等于术士等级；无甲时基础 AC 为 10＋敏捷调整值＋魅力调整值。'},{level:3,name:'龙族法术'},{level:6,name:'元素亲和'},{level:14,name:'龙翼'},{level:18,name:'龙之伙伴'}],
 '邪术师:fiend':[{level:3,name:'黑暗者之福'},{level:3,name:'邪魔法术'},{level:6,name:'黑暗者的幸运'},{level:10,name:'邪魔韧性'},{level:14,name:'投掷入地狱'}],
 '法师:evoker':[{level:3,name:'塑能学者'},{level:3,name:'强效戏法'},{level:6,name:'法术塑形'},{level:10,name:'强化塑能'},{level:14,name:'过载'}],
};
function pickGroupData(m:unknown):GroupFeatureData{const cand:unknown=(m as {data?:GroupFeatureData}).data??(Object.values(m as Record<string,unknown>).find(v=>v&&typeof v==='object'&&'classFeatures' in (v as object))??m);const v=cand as GroupFeatureData;return {classFeatures:v.classFeatures??{},classNotes:v.classNotes??{},subclassFeatures:v.subclassFeatures??{},speciesFeatures:v.speciesFeatures??{}};}
const dataGroups:GroupFeatureData[]=[barbarianRangerData,clericRogueData,druidPaladinData,fighterWarlockData,monkBardData,wizardSorcererData,speciesOriginData].map(pickGroupData);
function mergeFeatures(base:Record<string,Feature[]>,pick:(g:GroupFeatureData)=>Record<string,Feature[]>){const out:Record<string,Feature[]>={};for(const [k,v] of Object.entries(base))out[k]=[...v];for(const g of dataGroups)for(const [k,v] of Object.entries(pick(g))){const list=out[k]??(out[k]=[]);for(const f of v){const i=list.findIndex(x=>x.name===f.name);if(i>=0)list[i]=f;else list.push(f);}}return out;}
function mergeNotes(base:Record<string,string>,pick:(g:GroupFeatureData)=>Record<string,string>){const out:Record<string,string>={...base};for(const g of dataGroups)Object.assign(out,pick(g));return out;}
function mergeSpecies(base:Record<string,string[]>,pick:(g:GroupFeatureData)=>Record<string,string[]>){const out:Record<string,string[]>={};for(const [k,v] of Object.entries(base))out[k]=[...v];for(const g of dataGroups)for(const [k,v] of Object.entries(pick(g))){const list=out[k]??(out[k]=[]);for(const f of v)if(!list.includes(f))list.push(f);}return out;}
export const mergedClassFeatures=mergeFeatures(classFeatures,g=>g.classFeatures);
export const mergedClassNotes=mergeNotes(classNotes,g=>g.classNotes);
export const mergedSubclassFeatures=mergeFeatures(subclassFeatures,g=>g.subclassFeatures);
export const mergedSpeciesFeatures=mergeSpecies(speciesFeatures,g=>g.speciesFeatures);
export function characterFeatures(draft:CharacterDraft){
 const c=draft.details?.fighterCalculator;if(!c)return null;
 const cls=c.characterClass??'战士';const species=mergedSpeciesFeatures[c.species]??[];
 const clsFeatures=(mergedClassFeatures[cls]??[]).filter(f=>f.level<=draft.level).map(f=>({...f,note:f.note??mergedClassNotes[f.name]}));
 const key=`${cls}:${c.subclass??''}`;const sub=c.subclass?mergedSubclassFeatures[key]:undefined;
 return {species,clsFeatures,subFeatures:(sub??[]).filter(f=>f.level<=draft.level),subclass:subclassLabel(cls,c.subclass),subclassSupported:!c.subclass||!!sub};
}
