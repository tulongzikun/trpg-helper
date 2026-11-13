const {test}=require('node:test');const assert=require('node:assert/strict');
const {newDraft}=require('../apps/web/src/characters.ts');
const {changeClassResource,classResources}=require('../apps/web/src/classResources.ts');
const {weaponMasteryState,setWeaponMastery,fightingStyle,setFightingStyle,freeSmiteRemaining,recoveryTouchCost,useRecoveryTouch,paladinAura,attacksPerAttackAction,channelDivinityOptions,paladinClassNotes}=require('../apps/web/src/paladinFeatures.ts');
function sample(level=6,subclass='devotion'){const d=newDraft();d.level=level;d.species='人类';d.details.fighterCalculator={species:'人类',elfLineage:'',armor:'none',shield:false,characterClass:'圣武士',subclass};return d;}
test('paladin records two weapon masteries and rejects duplicates',()=>{
 let d=sample(1);assert.equal(weaponMasteryState(d).invalid,false);
 d=setWeaponMastery(d,0,'长剑','迅击');d=setWeaponMastery(d,1,'巨剑','顺劈');
 assert.equal(weaponMasteryState(d).choices.length,2);assert.equal(weaponMasteryState(d).invalid,false);
 assert.equal(setWeaponMastery(d,2,'短剑','擦伤'),d);
 const dup=setWeaponMastery(d,1,'长剑','迅击');assert.equal(weaponMasteryState(dup).invalid,true);
});
test('paladin fighting style is available from level 2',()=>{
 let d=sample(1);assert.equal(fightingStyle(d),'');assert.equal(setFightingStyle(d,'防御'),d);
 d.level=2;d=setFightingStyle(d,'防御');assert.equal(fightingStyle(d),'防御');assert.equal(setFightingStyle(d,'不存在的风格'),d);
});
test('free smite resource exists from level 2',()=>{
 assert.equal(freeSmiteRemaining(sample(2)),1);assert.equal(freeSmiteRemaining(sample(1)),0);
});
test('recovery touch costs five points per condition from level 14',()=>{
 assert.equal(recoveryTouchCost(['目盲','恐慌','无效']),10);
 let d=sample(13);assert.equal(useRecoveryTouch(d,['目盲']),d);
 d=sample(14);const pool=()=>classResources(d).find(x=>x.id==='paladin-hands');
 assert.equal(pool().remaining,70);const next=useRecoveryTouch(d,['目盲','麻痹']);assert.equal(pool().remaining,70);assert.equal(classResources(next).find(x=>x.id==='paladin-hands').remaining,60);
 assert.equal(useRecoveryTouch(next,['目盲','目盲']),next);assert.equal(useRecoveryTouch(next,[]),next);
});
test('paladin aura scales from level 6 and widens at level 18',()=>{
 assert.equal(paladinAura(sample(5)),null);
 let d=sample(6);d.abilities.cha=8;assert.equal(paladinAura(d).bonus,1);assert.equal(paladinAura(d).radius,10);assert.equal(paladinAura(d).frightenedImmune,false);
 d.level=10;d.abilities.cha=18;assert.equal(paladinAura(d).bonus,4);assert.equal(paladinAura(d).frightenedImmune,true);
 d.level=18;assert.equal(paladinAura(d).radius,30);
});
test('extra attack, channel divinity options and paladin notes follow level',()=>{
 assert.equal(attacksPerAttackAction(sample(4)),1);assert.equal(attacksPerAttackAction(sample(5)),2);
 assert.deepEqual(channelDivinityOptions(sample(3)).length,1);assert.equal(channelDivinityOptions(sample(9)).length,2);
 const notes=paladinClassNotes(sample(19)).join('\n');assert.match(notes,/施法/);assert.match(notes,/圣武斩/);assert.match(notes,/光耀打击/);assert.match(notes,/复原之触/);
});
