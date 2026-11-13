const {test}=require('node:test');const assert=require('node:assert/strict');
const {newDraft}=require('../apps/web/src/characters.ts');
const {changeSpellSlot}=require('../apps/web/src/spellSlotResources.ts');
const {changeClassResource,classResources}=require('../apps/web/src/classResources.ts');
const {landAidDice,landRecoveryState,useLandFreeCast,recoverLandSlots}=require('../apps/web/src/landCircleFeatures.ts');
const {moonShapeState,moonStepMax,moonStepRemaining,useMoonStep,restoreMoonStepWithSlot,moonCircleNotes}=require('../apps/web/src/moonCircleFeatures.ts');
const {seaWrathState,startSeaWrath,endSeaWrath,swimSpeed,seaCircleNotes}=require('../apps/web/src/seaCircleFeatures.ts');
const {starryFormEffects,starMapState,cosmicOmenState,starCircleNotes,starryFormResistances}=require('../apps/web/src/starCircleFeatures.ts');
function sample(subclass,level){const d=newDraft();d.level=level;d.species='人类';d.details.fighterCalculator={species:'人类',elfLineage:'',armor:'none',shield:false,characterClass:'德鲁伊',subclass,knownWildShapes:[{id:'wolf',name:'狼',challenge:0.25,flies:false}]};return d;}
test('land aid dice and land recovery budget follow druid level',()=>{
 assert.equal(landAidDice(sample('land',2)),null);assert.equal(landAidDice(sample('land',3)),2);assert.equal(landAidDice(sample('land',10)),3);assert.equal(landAidDice(sample('land',14)),4);
 let d=sample('land',6);assert.equal(landRecoveryState(d).maxSlotLevels,3);assert.equal(landRecoveryState(d).freeCastRemaining,1);
 d=useLandFreeCast(d);assert.equal(landRecoveryState(d).freeCastRemaining,0);assert.equal(useLandFreeCast(d),d);
});
test('land recovery restores slots within the half-level budget once per long rest',()=>{
 let d=sample('land',6);assert.equal(recoverLandSlots(d,{}),d);
 d=changeSpellSlot(changeSpellSlot(d,'德鲁伊:slot:1',1),'德鲁伊:slot:2',1);
 assert.equal(recoverLandSlots(d,{'德鲁伊:slot:2':2}),d);
 const next=recoverLandSlots(d,{'德鲁伊:slot:1':1,'德鲁伊:slot:2':1});
 assert.equal(next.details.fighterCalculator.spellSlotSpent['德鲁伊:slot:1'],0);assert.equal(landRecoveryState(next).slotRecoveryRemaining,0);
 d=changeSpellSlot(next,'德鲁伊:slot:1',1);assert.equal(recoverLandSlots(d,{'德鲁伊:slot:1':1}),d);
});
test('moon shape state, step uses and slot-based recovery',()=>{
 const state=moonShapeState(sample('moon',3));assert.equal(state.maxChallenge,1);assert.equal(state.acOption,13);assert.equal(state.tempHp,9);assert.equal(state.lunarRadiance,false);
 assert.equal(moonShapeState(sample('moon',3)).conSaveBonus,0);assert.equal(moonShapeState(sample('moon',6)).conSaveBonus,0);assert.equal(moonShapeState(sample('moon',14)).improvedRadiance,true);
 let d=sample('moon',10);assert.equal(moonStepMax(d),1);assert.equal(moonStepRemaining(d),1);
 d=useMoonStep(d);assert.equal(moonStepRemaining(d),0);assert.equal(useMoonStep(d),d);
 d=changeSpellSlot(d,'德鲁伊:slot:2',1);d=restoreMoonStepWithSlot(d,2);assert.equal(moonStepRemaining(d),1);
 assert.match(moonCircleNotes(sample('moon',14)).join('\n'),/2d10/);
});
test('sea wrath aura consumes a wild shape use and scales with level',()=>{
 let d=sample('sea',3);assert.equal(seaWrathState(d).radius,5);assert.equal(seaWrathState(d).dice,1);
 d=startSeaWrath(d);assert.equal(seaWrathState(d).active,true);assert.equal(classResources(d).find(x=>x.id==='druid-wildshape').remaining,1);
 assert.equal(startSeaWrath(d),d);d=endSeaWrath(d);assert.equal(seaWrathState(d).active,false);
 d=sample('sea',10);assert.equal(swimSpeed(d),30);assert.equal(seaWrathState(d).radius,10);assert.equal(seaWrathState(d).flySpeed,30);assert.equal(seaWrathState(d).resistances.length,3);
 assert.equal(seaWrathState(sample('sea',14)).allyTarget,true);
 assert.match(seaCircleNotes(sample('sea',14)).join('\n'),/大洋慨赠/);
});
test('star map, cosmic omen and starry form effects follow level',()=>{
 let d=sample('stars',3);d.details.fighterCalculator.starMapHeld=true;
 assert.equal(starMapState(d).held,true);assert.equal(starMapState(d).maxGuidingBolt,1);assert.equal(starMapState(d).guidingBoltRemaining,1);
 assert.equal(cosmicOmenState(d),null);
 d.level=6;d.details.fighterCalculator.cosmicOmenRoll=4;const omen=cosmicOmenState(d);assert.equal(omen.omen,'吉兆');assert.equal(omen.remaining,1);
 d.details.fighterCalculator.cosmicOmenRoll=3;assert.equal(cosmicOmenState(d).omen,'凶兆');
 d.details.fighterCalculator.starryForm='archer';assert.match(starryFormEffects(d).detail,/1d8/);assert.equal(starryFormResistances(d).length,0);
 d.level=10;assert.match(starryFormEffects(d).detail,/2d8/);
 d.details.fighterCalculator.starryForm='dragon';assert.match(starryFormEffects(d).detail,/20 尺飞行/);
 d.level=14;assert.deepEqual(starryFormResistances(d),['钝击','穿刺','挥砍']);
 assert.match(starCircleNotes(d).join('\n'),/灿若繁星/);
});
