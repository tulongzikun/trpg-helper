const {test}=require('node:test');const assert=require('node:assert/strict');
const {calculateFighter}=require('../apps/web/src/fighterRules.ts');
const {newDraft}=require('../apps/web/src/characters.ts');
test('fighter values recalculate with species, armor and ability changes',()=>{
 const d=newDraft();d.abilities.con=14;d.abilities.dex=16;d.details.fighterCalculator={species:'精灵',elfLineage:'木精灵',armor:'scale',shield:true};
 const r=calculateFighter(d);assert.equal(r.characterClass,'战士');assert.equal(r.level,1);assert.equal(r.maxHp,12);assert.equal(r.speedFt,35);assert.equal(r.armorClass,18);assert.deepEqual(r.details.saveProficiencies,['str','con']);
 const changed=calculateFighter({...r,abilities:{...r.abilities,con:8,dex:8},details:{...r.details,fighterCalculator:{...r.details.fighterCalculator,species:'矮人',armor:'plate',shield:false}}});
 assert.equal(changed.maxHp,10);assert.equal(changed.speedFt,20);assert.equal(changed.armorClass,18);assert.equal(d.characterClass,'');
});
test('legacy characters are unchanged and invalid choices rejected',()=>{
 const old=newDraft();assert.equal(calculateFighter(old),old);
 old.details.fighterCalculator={species:'精灵',elfLineage:'不存在',armor:'none',shield:false};assert.throws(()=>calculateFighter(old));
 old.details.fighterCalculator={species:'toString',elfLineage:'',armor:'none',shield:false};assert.throws(()=>calculateFighter(old));
});

test('other classes apply first level traits and unarmored defense',()=>{
 const d=newDraft();d.abilities={str:10,dex:14,con:16,int:10,wis:14,cha:10};d.details.fighterCalculator={species:'人类',elfLineage:'高等精灵',armor:'none',shield:true,characterClass:'野蛮人',classSkills:['运动','察觉']};
 let result=calculateFighter(d);assert.equal(result.maxHp,15);assert.equal(result.armorClass,17);assert.deepEqual(result.details.saveProficiencies,['str','con']);
 d.details.fighterCalculator={...d.details.fighterCalculator,characterClass:'武僧',shield:false};result=calculateFighter(d);assert.equal(result.armorClass,14);assert.deepEqual(result.details.saveProficiencies,['str','dex']);
 d.details.fighterCalculator={...d.details.fighterCalculator,characterClass:'法师',armor:'plate',shield:true};result=calculateFighter(d);assert.equal(result.armorClass,18);assert.equal(result.speedFt,20);assert.equal(result.maxHp,9);
});
test('new calculated characters require valid class skill choices for publication',()=>{
 const {generationError}=require('../apps/web/src/characters.ts');const d=newDraft();d.details.fighterCalculator={species:'人类',elfLineage:'高等精灵',armor:'none',shield:false,characterClass:'战士',classSkills:['运动']};assert.match(generationError(d),/职业技能/);
 d.details.fighterCalculator.classSkills=['运动','察觉'];assert.equal(generationError(d),null);
 d.details.fighterCalculator.classSkills=['运动','运动'];assert.match(generationError(d),/职业技能/);
 d.details.fighterCalculator.classSkills=['运动','奥秘'];assert.match(generationError(d),/职业技能/);
});

test('levels and speed depend on class and armor',()=>{
 const d=newDraft();d.level=6;d.abilities.str=15;d.abilities.con=14;d.details.fighterCalculator={species:'人类',elfLineage:'高等精灵',armor:'none',shield:false,characterClass:'武僧',classSkills:[]};
 let r=calculateFighter(d);assert.equal(r.level,6);assert.equal(r.maxHp,45);assert.equal(r.speedFt,45);
 d.details.fighterCalculator.shield=true;r=calculateFighter(d);assert.equal(r.speedFt,30);
 d.details.fighterCalculator={...d.details.fighterCalculator,characterClass:'游侠',armor:'chain',shield:false};r=calculateFighter(d);assert.equal(r.speedFt,30);assert.equal(r.maxHp,52);
 d.details.fighterCalculator.armor='leather';r=calculateFighter(d);assert.equal(r.speedFt,40);
});
test('draconic sorcerer resilience applies from third level',()=>{
 const d=newDraft();d.abilities.dex=14;d.abilities.con=12;d.abilities.cha=16;d.details.fighterCalculator={species:'矮人',elfLineage:'高等精灵',armor:'none',shield:false,characterClass:'术士',subclass:'draconic',classSkills:[]};
 d.level=2;let r=calculateFighter(d);assert.equal(r.maxHp,14);assert.equal(r.armorClass,12);
 d.level=3;r=calculateFighter(d);assert.equal(r.maxHp,23);assert.equal(r.armorClass,15);
});
test('higher-level monk and rogue saving proficiencies follow level and revert',()=>{
 const d=newDraft();d.details.fighterCalculator={species:'人类',elfLineage:'',armor:'none',shield:false,characterClass:'武僧'};
 d.level=13;assert.deepEqual(calculateFighter(d).details.saveProficiencies,['str','dex']);
 d.level=14;assert.deepEqual(new Set(calculateFighter(d).details.saveProficiencies),new Set(['str','dex','con','int','wis','cha']));
 d.details.fighterCalculator.characterClass='游荡者';d.level=14;assert.deepEqual(calculateFighter(d).details.saveProficiencies,['dex','int']);
 d.level=15;assert.deepEqual(calculateFighter(d).details.saveProficiencies,['dex','int','wis','cha']);
});
test('paladin aura bonus is reported conditionally and scales with charisma',()=>{
 const {savingThrows}=require('../apps/web/src/savingThrows.ts');const d=newDraft();d.details.fighterCalculator={species:'人类',elfLineage:'',armor:'none',shield:false,characterClass:'圣武士'};
 d.level=5;d.abilities.cha=8;assert.equal(savingThrows(d).aura,0);d.level=6;assert.equal(savingThrows(d).aura,1);d.abilities.cha=18;assert.equal(savingThrows(d).aura,4);
});
