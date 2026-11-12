import type { Class2024 } from './rules2024';
/** 2024 Player's Handbook subclass names. Choosing one here is only a plan for level 3. */
export const subclasses:Record<Class2024, {id:string;label:string}[]>={
 '野蛮人':[{id:'berserker',label:'狂战士之途 / Berserker'},{id:'wild-heart',label:'狂野之心之途 / Wild Heart'},{id:'world-tree',label:'世界树之途 / World Tree'},{id:'zealot',label:'狂热者之途 / Zealot'}],
 '吟游诗人':[{id:'dance',label:'舞蹈学院 / Dance'},{id:'glamour',label:'魅惑学院 / Glamour'},{id:'lore',label:'逸闻学院 / Lore'},{id:'valor',label:'勇气学院 / Valor'}],
 '牧师':[{id:'life',label:'生命领域 / Life'},{id:'light',label:'光明领域 / Light'},{id:'trickery',label:'诡术领域 / Trickery'},{id:'war',label:'战争领域 / War'}],
 '德鲁伊':[{id:'land',label:'大地结社 / Land'},{id:'moon',label:'月亮结社 / Moon'},{id:'sea',label:'海洋结社 / Sea'},{id:'stars',label:'星辰结社 / Stars'}],
 '战士':[{id:'battle-master',label:'战斗大师 / Battle Master'},{id:'champion',label:'勇士 / Champion'},{id:'eldritch-knight',label:'奥法骑士 / Eldritch Knight'},{id:'psi-warrior',label:'灵能战士 / Psi Warrior'}],
 '武僧':[{id:'mercy',label:'慈悲武者 / Mercy'},{id:'shadow',label:'暗影武者 / Shadow'},{id:'elements',label:'元素武者 / Elements'},{id:'open-hand',label:'散打武者 / Open Hand'}],
 '圣武士':[{id:'devotion',label:'奉献之誓 / Devotion'},{id:'glory',label:'荣耀之誓 / Glory'},{id:'ancients',label:'远古之誓 / Ancients'},{id:'vengeance',label:'复仇之誓 / Vengeance'}],
 '游侠':[{id:'beast-master',label:'驯兽师 / Beast Master'},{id:'fey-wanderer',label:'妖精漫游者 / Fey Wanderer'},{id:'gloom-stalker',label:'幽域追猎者 / Gloom Stalker'},{id:'hunter',label:'猎人 / Hunter'}],
 '游荡者':[{id:'arcane-trickster',label:'奥术诡术师 / Arcane Trickster'},{id:'assassin',label:'刺客 / Assassin'},{id:'soulknife',label:'魂刃 / Soulknife'},{id:'thief',label:'盗贼 / Thief'}],
 '术士':[{id:'aberrant',label:'异怪魔法 / Aberrant Sorcery'},{id:'clockwork',label:'发条魔法 / Clockwork Sorcery'},{id:'draconic',label:'龙族魔法 / Draconic Sorcery'},{id:'wild-magic',label:'狂野魔法 / Wild Magic Sorcery'}],
 '邪术师':[{id:'archfey',label:'至高妖精宗主 / Archfey'},{id:'celestial',label:'天界宗主 / Celestial'},{id:'fiend',label:'邪魔宗主 / Fiend'},{id:'great-old-one',label:'旧日支配者宗主 / Great Old One'}],
 '法师':[{id:'abjurer',label:'防护师 / Abjurer'},{id:'diviner',label:'预言师 / Diviner'},{id:'evoker',label:'塑能师 / Evoker'},{id:'illusionist',label:'幻术师 / Illusionist'}],
};
export function subclassLabel(characterClass:string,id:string|undefined):string|undefined {
 if(!id||!Object.hasOwn(subclasses,characterClass))return undefined;
 return subclasses[characterClass as Class2024].find(option=>option.id===id)?.label;
}
