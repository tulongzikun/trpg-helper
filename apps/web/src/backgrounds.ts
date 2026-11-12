import type { Ability } from './characters';
export type Background={abilities:Ability[];skills:string[];feat:string;tool:string};
export const backgrounds:Record<string,Background>={
 '侍僧':{abilities:['int','wis','cha'],skills:['洞悉','宗教'],feat:'魔法学徒（牧师）',tool:'书法工具'},
 '罪犯':{abilities:['dex','con','int'],skills:['巧手','隐匿'],feat:'警觉',tool:'盗贼工具'},
 '贤者':{abilities:['con','int','wis'],skills:['奥秘','历史'],feat:'魔法学徒（法师）',tool:'书法工具'},
 '士兵':{abilities:['str','dex','con'],skills:['运动','威吓'],feat:'野蛮攻击者',tool:'一种游戏工具（自选）'},
 '工匠':{abilities:['str','dex','int'],skills:['调查','游说'],feat:'工匠',tool:'一种工匠工具（自选）'},
 '骗子':{abilities:['dex','con','cha'],skills:['欺瞒','巧手'],feat:'娴熟',tool:'伪造工具'},
 '艺人':{abilities:['str','dex','cha'],skills:['体操','表演'],feat:'音乐家',tool:'一种乐器（自选）'},
 '农夫':{abilities:['str','con','wis'],skills:['驯兽','自然'],feat:'强韧',tool:'木匠工具'},
 '卫兵':{abilities:['str','int','wis'],skills:['运动','察觉'],feat:'警觉',tool:'一种游戏工具（自选）'},
 '向导':{abilities:['dex','con','wis'],skills:['隐匿','求生'],feat:'魔法学徒（德鲁伊）',tool:'绘图工具'},
 '隐士':{abilities:['con','wis','cha'],skills:['医药','宗教'],feat:'医者',tool:'草药工具'},
 '商人':{abilities:['con','int','cha'],skills:['驯兽','游说'],feat:'幸运',tool:'导航工具'},
 '贵族':{abilities:['str','int','cha'],skills:['历史','游说'],feat:'娴熟',tool:'一种游戏工具（自选）'},
 '水手':{abilities:['str','dex','wis'],skills:['体操','察觉'],feat:'酒馆斗殴者',tool:'导航工具'},
 '抄写员':{abilities:['dex','int','wis'],skills:['调查','察觉'],feat:'娴熟',tool:'书法工具'},
 '流浪者':{abilities:['dex','wis','cha'],skills:['洞悉','隐匿'],feat:'幸运',tool:'盗贼工具'},
};
export function getBackground(name:string|undefined):Background|undefined{return name&&Object.hasOwn(backgrounds,name)?backgrounds[name]:undefined;}
export const originLanguages=['通用语','通用手语','龙语','矮人语','精灵语','巨人语','侏儒语','地精语','半身人语','兽人语'];
export function originFeatDescription(feat:string):string {
 if(feat.startsWith('魔法学徒'))return '选择两个戏法和一个一级法术；每次长休可免费施展该一级法术一次，具体法术须另选。';
 const descriptions:Record<string,string>={'警觉':'先攻加入熟练加值，并可与自愿盟友交换先攻。','工匠':'获得三种工匠工具熟练，并可享受指定折扣及快速制作。','医者':'使用医疗包协助治疗，并可重掷治疗骰中部分结果。','幸运':'获得幸运点，用于影响检定或对你的攻击。','音乐家':'获得三种乐器熟练，休息后可激励盟友。','野蛮攻击者':'每回合一次，武器伤害骰可掷两次并选择一次结果。','娴熟':'选择三项技能或工具熟练。','酒馆斗殴者':'改善徒手打击，并能在符合条件时推开目标。','强韧':'生命上限增加角色等级的两倍，升级时每级额外增加 2。'};
 return descriptions[feat]??'具体选择和效果请查阅规则。';
}
