import type { Ability } from './characters';
import type { Class2024 } from './rules2024';
export const classTraits:Record<Class2024,{saves:Ability[];skills:string[];count:number;shield:boolean}>= {
 '野蛮人':{saves:['str','con'],skills:['驯兽','运动','威吓','自然','察觉','求生'],count:2,shield:true},
 '吟游诗人':{saves:['dex','cha'],skills:['运动','体操','巧手','隐匿','奥秘','历史','调查','自然','宗教','驯兽','察觉','洞悉','医药','求生','欺瞒','威吓','表演','游说'],count:3,shield:false},
 '牧师':{saves:['wis','cha'],skills:['历史','洞悉','医药','游说','宗教'],count:2,shield:true},
 '德鲁伊':{saves:['int','wis'],skills:['奥秘','驯兽','洞悉','医药','自然','察觉','宗教','求生'],count:2,shield:true},
 '战士':{saves:['str','con'],skills:['体操','驯兽','运动','历史','洞悉','威吓','游说','察觉','求生'],count:2,shield:true},
 '武僧':{saves:['str','dex'],skills:['体操','运动','历史','洞悉','宗教','隐匿'],count:2,shield:false},
 '圣武士':{saves:['wis','cha'],skills:['运动','洞悉','威吓','医药','游说','宗教'],count:2,shield:true},
 '游侠':{saves:['str','dex'],skills:['驯兽','运动','洞悉','调查','自然','察觉','隐匿','求生'],count:3,shield:true},
 '游荡者':{saves:['dex','int'],skills:['体操','运动','欺瞒','洞悉','威吓','调查','察觉','游说','巧手','隐匿'],count:4,shield:false},
 '术士':{saves:['con','cha'],skills:['奥秘','欺瞒','洞悉','威吓','游说','宗教'],count:2,shield:false},
 '邪术师':{saves:['wis','cha'],skills:['奥秘','欺瞒','历史','威吓','调查','自然','宗教'],count:2,shield:false},
 '法师':{saves:['int','wis'],skills:['奥秘','历史','洞悉','调查','医药','自然','宗教'],count:2,shield:false},
};
