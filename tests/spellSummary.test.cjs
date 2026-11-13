const {test}=require('node:test');
const assert=require('node:assert/strict');
const {newDraft}=require('../apps/web/src/characters.ts');
const {spellSummary}=require('../apps/web/src/spellSummary.ts');

function base(patch={}){
 const d=newDraft();
 d.name='测试';d.species='人类';d.characterClass='德鲁伊';d.level=2;
 d.details.fighterCalculator={species:'人类',elfLineage:'',armor:'none',shield:false,characterClass:'德鲁伊',classSkills:['自然','察觉'],...patch};
 return d;
}

test('德鲁伊的戏法、准备法术、常备法术与法术位自动汇总',()=>{
 const d=base({classSpellChoices:{'德鲁伊':{cantrips:['德鲁伊伎俩','神导术'],prepared:[{name:'疗伤术',level:1}]}}});
 const text=spellSummary(d);
 assert.match(text,/【德鲁伊戏法与准备法术】/);
 assert.match(text,/戏法：德鲁伊伎俩、神导术/);
 assert.match(text,/准备法术：疗伤术（1 环）/);
 assert.match(text,/常备法术：动物交谈/);
 assert.match(text,/法术位：1 环法术位 3\/3/);
});

test('邪术师的契约法术位与秘法进入摘要',()=>{
 const d=base({characterClass:'邪术师',classSpellChoices:{'邪术师':{cantrips:['魔能爆','次级幻影'],prepared:[{name:'哈达之欲',level:1}],arcanum:{'6':'真知术'}}}});
 d.level=11;
 const text=spellSummary(d);
 assert.match(text,/5 环契约法术位 3\/3/);
 assert.match(text,/6 环秘法：真知术/);
 assert.match(text,/常备法术：异界探知/);
});

test('物种天赋法术按血统汇总',()=>{
 const d=base({species:'提夫林',tieflingLegacy:'炼狱',lineageAbility:'cha',characterClass:'邪术师'});
 d.species='提夫林';d.level=5;
 const text=spellSummary(d);
 assert.match(text,/物种天赋：/);
 assert.match(text,/奇术（随意施放）/);
 assert.match(text,/1 环 地狱斥喝/);
 assert.match(text,/2 环 黑暗术/);
});

test('魔法学徒的戏法与一环法术进入摘要',()=>{
 const d=base({classSpellChoices:{'德鲁伊':{cantrips:[],prepared:[]}},magicInitiate:{background:{list:'法师',ability:'int',cantrips:['火焰箭','冷冻射线'],spell:'魔法飞弹'}}});
 d.details.background='贤者';
 const text=spellSummary(d);
 assert.match(text,/魔法学徒（法师，智力）：戏法：火焰箭、冷冻射线；一环法术：魔法飞弹/);
});

test('非法师职业不显示法术书行，法师显示法术书与法术精通',()=>{
 const druid=spellSummary(base({classSpellChoices:{'德鲁伊':{cantrips:[],prepared:[]}}}));
 assert.doesNotMatch(druid,/法术书：/);
 const wizard=base({characterClass:'法师',classSpellChoices:{'法师':{cantrips:['火焰箭'],prepared:[{name:'护盾术',level:1}],book:[{name:'护盾术',level:1},{name:'迷踪步',level:2}],mastery:{'1':'护盾术','2':'迷踪步'}}}});
 wizard.level=18;
 const text=spellSummary(wizard);
 assert.match(text,/法术书：护盾术（1 环）、迷踪步（2 环）/);
 assert.match(text,/法术精通：1 环 护盾术 · 2 环 迷踪步/);
});

test('奥法骑士与奥术诡术师的三分之一施法进入摘要',()=>{
 const fighter=base({characterClass:'战士',subclass:'eldritch-knight',classSpellChoices:{'战士':{cantrips:['火焰箭'],prepared:[{name:'护盾术',level:1}]}}});
 fighter.level=7;
 const text=spellSummary(fighter);
 assert.match(text,/【战士戏法与准备法术】/);
 assert.match(text,/1 环法术位 4\/4 · 2 环法术位 2\/2/);
 const rogue=base({characterClass:'游荡者',subclass:'arcane-trickster',classSpellChoices:{'游荡者':{cantrips:['火焰箭'],prepared:[{name:'护盾术',level:1}]}}});
 rogue.level=7;
 assert.match(spellSummary(rogue),/戏法：法师之手（固定）、火焰箭/);
});

test('没有任何法术选择时返回空字符串',()=>{
 assert.equal(spellSummary(newDraft()),'');
});
