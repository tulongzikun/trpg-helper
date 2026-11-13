const {test}=require('node:test');const assert=require('node:assert/strict');
const {newDraft}=require('../apps/web/src/characters.ts');
const {changeClassResource,classResources}=require('../apps/web/src/classResources.ts');
const {changeSpellSlot}=require('../apps/web/src/spellSlotResources.ts');
const {completeRest}=require('../apps/web/src/characterRest.ts');
const {elementalFury,setElementalFury,wildShapeRemaining,activeWildShape,startWildShape,endWildShape,wildShapeTempHp,wildShapeAcOption,wildCompanionState,summonWildCompanion,dismissWildCompanion,natureMagicianState,useNatureMagician,druidGrandNotes}=require('../apps/web/src/druidFeatures.ts');
function sample(level=5,subclass='land'){const d=newDraft();d.level=level;d.species='人类';d.details.fighterCalculator={species:'人类',elfLineage:'',armor:'none',shield:false,characterClass:'德鲁伊',subclass,knownWildShapes:[{id:'wolf',name:'狼',challenge:0.25,flies:false}]};return d;}
test('druid wild shape consumes a use, tracks the active form and does not refund on end',()=>{
 let d=sample(5);assert.equal(wildShapeRemaining(d),2);assert.equal(activeWildShape(d),undefined);
 d=startWildShape(d,'狼');assert.equal(wildShapeRemaining(d),1);assert.equal(activeWildShape(d),'狼');assert.equal(wildShapeTempHp(d),5);
 assert.equal(startWildShape(d,'狼'),d);assert.equal(startWildShape(d,'不存在的形态'),d);
 d=endWildShape(d);assert.equal(activeWildShape(d),undefined);assert.equal(wildShapeRemaining(d),1);
 d.level=1;assert.equal(wildShapeRemaining(d),0);assert.equal(startWildShape(d,'狼'),d);
});
test('moon circle adds triple temporary hit points and the wisdom AC option',()=>{
 let d=sample(6,'moon');d=startWildShape(d,'狼');assert.equal(wildShapeTempHp(d),18);assert.equal(wildShapeAcOption(d),13);
 d.abilities.wis=18;assert.equal(wildShapeAcOption(d),17);
});
test('elemental fury is chosen from level 7 and improves at level 15',()=>{
 let d=sample(6);assert.equal(elementalFury(d),null);assert.equal(setElementalFury(d,'potent'),d);
 d.level=7;assert.equal(elementalFury(d).choice,'');d=setElementalFury(d,'potent');assert.equal(elementalFury(d).label,'强力施法');assert.match(elementalFury(d).note,/感知/);
 d=setElementalFury(d,'primal');assert.match(elementalFury(d).note,/1d8/);d.level=15;assert.match(elementalFury(d).note,/2d8/);
 assert.equal(setElementalFury(d,'无效'),d);
});
test('wild companion costs a slot or a wild shape use and can be dismissed',()=>{
 let d=sample(4);assert.equal(wildCompanionState(d).active,false);
 const bySlot=summonWildCompanion(d,'slot');assert.equal(bySlot.details.fighterCalculator.wildCompanionActive,true);assert.equal(bySlot.details.fighterCalculator.spellSlotSpent['德鲁伊:slot:1'],1);
 d=summonWildCompanion(d,'wildshape');assert.equal(wildShapeRemaining(d),1);assert.equal(wildCompanionState(d).active,true);
 assert.equal(summonWildCompanion(d,'wildshape'),d);d=dismissWildCompanion(d);assert.equal(wildCompanionState(d).active,false);
 const again=summonWildCompanion(d,'slot');assert.equal(again.details.fighterCalculator.wildCompanionActive,true);
 d=changeClassResource(d,'druid-wildshape',2);assert.equal(summonWildCompanion(d,'wildshape'),d);
});
test('nature magician converts unused wild shape uses into one spell slot once per long rest',()=>{
 let d=sample(20);assert.equal(natureMagicianState(d).used,false);
 d=changeSpellSlot(d,'德鲁伊:slot:3',1);assert.deepEqual(natureMagicianState(d).recoverableLevels,[3]);
 d=changeSpellSlot(d,'德鲁伊:slot:6',1);assert.deepEqual(natureMagicianState(d).recoverableLevels,[3]);
 const next=useNatureMagician(d,3);assert.equal(natureMagicianState(next).used,true);assert.equal(wildShapeRemaining(next),2);
 assert.equal(next.details.fighterCalculator.spellSlotSpent['德鲁伊:slot:3'],0);assert.equal(useNatureMagician(next,1),next);
 d=changeClassResource(d,'druid-wildshape',2);d=changeClassResource(d,'druid-wildshape',2);
 d=changeSpellSlot(d,'德鲁伊:slot:4',1);assert.deepEqual(natureMagicianState(d).recoverableLevels,[]);
 assert.equal(useNatureMagician(d,4),d);
});
test('druid grand notes mention language, spellcasting and capstone features',()=>{
 const notes=druidGrandNotes(sample(20)).join('\n');assert.match(notes,/德鲁伊语/);assert.match(notes,/施法/);assert.match(notes,/不凋化形/);assert.match(notes,/青春永驻/);
});
test('long rest restores wild shape uses',()=>{let d=sample(5);d=startWildShape(d,'狼');d=completeRest(d,'long');assert.equal(wildShapeRemaining(d),2);});
