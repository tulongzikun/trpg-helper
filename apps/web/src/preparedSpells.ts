import type { CharacterDraft } from './characters';
type Tier={at:number;spells:string[]};
const subclassSpells:Record<string,Tier[]>={
 '牧师:life':[{at:3,spells:['援助术','祝福术','疗伤术','次级复原术']},{at:5,spells:['群体治愈真言','回生术']},{at:7,spells:['生命灵光','防死结界']},{at:9,spells:['高等复原术','群体疗伤术']}],
 '牧师:light':[{at:3,spells:['燃烧之手','妖火','灼热射线','识破隐形']},{at:5,spells:['昼明术','火球术']},{at:7,spells:['秘法眼','火墙术']},{at:9,spells:['焰击术','探知术']}],
 '牧师:trickery':[{at:3,spells:['魅惑类人','易容术','隐形术','行动无踪']},{at:5,spells:['催眠图纹','回避侦测']},{at:7,spells:['困惑术','任意门']},{at:9,spells:['支配类人','篡改记忆']}],
 '牧师:war':[{at:3,spells:['光导箭','虔诚护盾','魔化武器','灵体武器']},{at:5,spells:['十字军披风','灵体卫士']},{at:7,spells:['火焰护盾','行动自如']},{at:9,spells:['定身怪物','钢风斩']}],
 '德鲁伊:moon':[{at:3,spells:['点点星芒','疗伤术','月华之光']},{at:5,spells:['咒唤兽群']},{at:7,spells:['月光涌泉']},{at:9,spells:['群体疗伤术']}],
 '德鲁伊:sea':[{at:3,spells:['冷冻射线','云雾术','雷鸣波','造风术','粉碎音波']},{at:5,spells:['闪电束','水下呼吸']},{at:7,spells:['操控水体','冰风暴']},{at:9,spells:['咒唤元素','定身怪物']}],
 '圣武士:devotion':[{at:3,spells:['防护善恶','虔诚护盾']},{at:5,spells:['援助术','真实之域']},{at:9,spells:['希望信标','解除魔法']},{at:13,spells:['行动自如','信仰守卫']},{at:17,spells:['通神术','焰击术']}],
 '圣武士:glory':[{at:3,spells:['光导箭','英雄气概']},{at:5,spells:['强化属性','魔化武器']},{at:9,spells:['加速术','防护能量']},{at:13,spells:['强迫术','行动自如']},{at:17,spells:['通晓传奇','悠兰德王者威仪']}],
 '圣武士:ancients':[{at:3,spells:['捕获打击','动物交谈']},{at:5,spells:['迷踪步','月华之光']},{at:9,spells:['植物滋长','防护能量']},{at:13,spells:['冰风暴','石肤术']},{at:17,spells:['问道自然','树跃术']}],
 '圣武士:vengeance':[{at:3,spells:['灾祸术','猎人印记']},{at:5,spells:['定身类人','迷踪步']},{at:9,spells:['加速术','防护能量']},{at:13,spells:['放逐术','任意门']},{at:17,spells:['定身怪物','探知术']}],
 '游侠:fey-wanderer':[{at:3,spells:['魅惑类人']},{at:5,spells:['迷踪步']},{at:9,spells:['妖精召唤术']},{at:13,spells:['任意门']},{at:17,spells:['假象术']}],
 '游侠:gloom-stalker':[{at:3,spells:['易容术']},{at:5,spells:['魔绳术']},{at:9,spells:['恐惧术']},{at:13,spells:['高等隐形术']},{at:17,spells:['伪装术']}],
 '术士:draconic':[{at:3,spells:['变身术','七彩喷球','命令术','龙息术']},{at:5,spells:['恐惧术','飞行术']},{at:7,spells:['奥术眼','魅惑怪物']},{at:9,spells:['传奇传说','召唤龙']}],
 '术士:aberrant':[{at:3,spells:['心灵之楔','哈达之臂','不谐低语','安定心神','侦测思想']},{at:5,spells:['哈达之欲','短讯术']},{at:7,spells:['艾伐黑触手','异怪召唤术']},{at:9,spells:['拉瑞心灵连接','心灵遥控']}],
 '术士:clockwork':[{at:3,spells:['防护善恶','警报术','次等复原术','援助术']},{at:5,spells:['解除魔法','防护能量']},{at:7,spells:['行动自如','构装召唤术']},{at:9,spells:['高等复原术','力场墙']}],
 '邪术师:archfey':[{at:3,spells:['妖火','睡眠术','安定心神','迷踪步','魅影之力']},{at:5,spells:['闪现术','植物滋长']},{at:7,spells:['支配野兽','高等隐形术']},{at:9,spells:['支配类人','伪装术']}],
 '邪术师:celestial':[{at:3,spells:['光亮术','圣火术','疗伤术','光导箭','援助术','次等复原术']},{at:5,spells:['昼明术','回生术']},{at:7,spells:['信仰守卫','火墙术']},{at:9,spells:['高等复原术','天界召唤术']}],
 '邪术师:great-old-one':[{at:3,spells:['不谐低语','塔莎狂笑术','魅影之力','侦测思想']},{at:5,spells:['鹰眼术','哈达之欲']},{at:7,spells:['困惑术','异怪召唤术']},{at:9,spells:['篡改记忆','心灵遥控']}],
 '法师:illusionist':[{at:6,spells:['野兽召唤术','妖精召唤术']}],
 '邪术师:fiend':[{at:3,spells:['燃烧之手','命令术','灼热射线','暗示术']},{at:5,spells:['火球术','臭云术']},{at:7,spells:['火焰护盾','火墙术']},{at:9,spells:['指使术','虫群术']}],
};
export const landTypes=['荒漠','极地','温带','热带'] as const;
const landSpells:Record<typeof landTypes[number],Tier[]>={
 '荒漠':[{at:3,spells:['火焰箭','燃烧之手','朦胧术']},{at:5,spells:['火球术']},{at:7,spells:['枯萎术']},{at:9,spells:['石墙术']}],
 '极地':[{at:3,spells:['冷冻射线','云雾术','定身类人']},{at:5,spells:['雪雨暴']},{at:7,spells:['冰风暴']},{at:9,spells:['寒冰锥']}],
 '温带':[{at:3,spells:['电爪','睡眠术','迷踪步']},{at:5,spells:['闪电束']},{at:7,spells:['行动自如']},{at:9,spells:['树跃术']}],
 '热带':[{at:3,spells:['酸液飞溅','蛛网术','致病射线']},{at:5,spells:['臭云术']},{at:7,spells:['变形术']},{at:9,spells:['疫病虫群']}],
};
export function landResistance(d:CharacterDraft){const c=d.details?.fighterCalculator;if(c?.characterClass!=='德鲁伊'||c.subclass!=='land'||d.level<10||!c.landType)return null;return ({'荒漠':'火焰','极地':'寒冷','温带':'闪电','热带':'毒素'} as Record<string,string>)[c.landType]??null;}
export function alwaysPreparedSpells(d:CharacterDraft){
 const c=d.details?.fighterCalculator;if(!c)return [];
 const cls=c.characterClass??'战士';const result:{name:string;grantedAt:number;usage?:string}[]=[];
 if(cls==='德鲁伊')result.push({name:'动物交谈',grantedAt:1});
 if(cls==='德鲁伊'&&c.subclass==='stars'&&d.level>=3&&c.starMapHeld)result.push({name:'神导术',grantedAt:3,usage:'持有星图时准备'},{name:'光导箭',grantedAt:3,usage:'持有星图时准备；可免费施放，次数见职业资源'});
 if(cls==='游侠')result.push({name:'猎人印记',grantedAt:1,usage:`长休后可免费施放 ${Math.min(6,2+Math.floor((d.level-1)/4))} 次`});
 if(cls==='圣武士'&&d.level>=2)result.push({name:'至圣斩',grantedAt:2,usage:'长休后可免费施放一次'});
 if(cls==='圣武士'&&d.level>=5)result.push({name:'寻获坐骑',grantedAt:5,usage:'长休后可免费施放一次'});
 if(cls==='邪术师'&&d.level>=9)result.push({name:'异界探知',grantedAt:9,usage:'联系宗主时可免费施放一次并自动成功豁免；长休恢复'});
 const key=`${cls}:${c.subclass??''}`;if(Object.hasOwn(subclassSpells,key))result.push(...subclassSpells[key].filter(t=>t.at<=d.level).flatMap(t=>t.spells.map(name=>({name,grantedAt:t.at,...(key==='法师:illusionist'?{usage:'幻术版本可免费一次，长休恢复；召唤物生命减半'}:{})}))));
 if(key==='德鲁伊:land'&&c.landType&&Object.hasOwn(landSpells,c.landType))result.push(...landSpells[c.landType].filter(t=>t.at<=d.level).flatMap(t=>t.spells.map(name=>({name,grantedAt:t.at}))));
 return result;
}
