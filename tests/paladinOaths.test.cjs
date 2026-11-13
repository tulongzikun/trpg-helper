const {test}=require('node:test');const assert=require('node:assert/strict');
const {newDraft}=require('../apps/web/src/characters.ts');
const {changeSpellSlot}=require('../apps/web/src/spellSlotResources.ts');
const {classResources}=require('../apps/web/src/classResources.ts');
const {paladinOath,oathAuraState,oathChannelOptions,oathFeatureNotes,capstoneState,activateCapstone,endCapstone,restoreCapstoneWithSlot}=require('../apps/web/src/paladinOaths.ts');
function sample(subclass,level){const d=newDraft();d.level=level;d.species='人类';d.details.fighterCalculator={species:'人类',elfLineage:'',armor:'none',shield:false,characterClass:'圣武士',subclass};return d;}
test('paladin oath is only recognised from level 3 with a known subclass',()=>{
 assert.equal(paladinOath(sample('devotion',2)),undefined);assert.equal(paladinOath(sample('devotion',3)),'devotion');
 assert.equal(paladinOath(sample('unknown',3)),undefined);assert.equal(paladinOath(sample('glory',3)),'glory');
});
test('oath auras and channel divinity options match each oath',()=>{
 assert.equal(oathAuraState(sample('devotion',6)),null);
 const devotion=oathAuraState(sample('devotion',7));assert.equal(devotion.title,'奉献灵光');assert.match(devotion.benefits[0],/魅惑/);
 assert.equal(oathAuraState(sample('glory',7)).title,'迅捷灵光');assert.equal(oathAuraState(sample('ancients',7)).title,'守御灵光');assert.equal(oathAuraState(sample('vengeance',7)),null);
 assert.equal(oathAuraState(sample('ancients',18)).radius,30);
 assert.match(oathChannelOptions(sample('devotion',3))[0],/圣洁武器/);assert.match(oathChannelOptions(sample('glory',3))[0],/鼓舞斩/);
 assert.match(oathChannelOptions(sample('ancients',3))[0],/自然之怒/);assert.match(oathChannelOptions(sample('vengeance',3))[0],/仇敌誓言/);
 const notes=oathFeatureNotes(sample('ancients',15)).join('\n');assert.match(notes,/不灭哨卫/);assert.match(notes,/45/);
 assert.match(oathFeatureNotes(sample('vengeance',7)).join('\n'),/无情复仇/);
});
test('oath capstone activates, ends and can be restored with a fifth-level slot',()=>{
 assert.equal(capstoneState(sample('devotion',19)),null);
 let d=sample('vengeance',20);const state=capstoneState(d);
 assert.equal(state.name,'复仇天使');assert.equal(state.remaining,1);assert.equal(state.active,false);
 d=activateCapstone(d);assert.equal(capstoneState(d).active,true);assert.equal(capstoneState(d).remaining,0);assert.equal(activateCapstone(d),d);
 d=endCapstone(d);assert.equal(capstoneState(d).active,false);
 assert.equal(restoreCapstoneWithSlot(d).details.fighterCalculator.classResourceSpent['paladin-oath-capstone'],0);
 d=restoreCapstoneWithSlot(d);assert.equal(classResources(d).find(x=>x.id==='paladin-oath-capstone').remaining,1);assert.equal(d.details.fighterCalculator.spellSlotSpent['圣武士:slot:5'],1);
});
