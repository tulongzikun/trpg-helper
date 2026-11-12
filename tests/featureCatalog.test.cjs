const {test}=require('node:test');const assert=require('node:assert/strict');
const {characterFeatures}=require('../apps/web/src/featureCatalog.ts');const {newDraft}=require('../apps/web/src/characters.ts');
test('automatic features follow level and do not overwrite notes',()=>{
 const d=newDraft();d.details.features='保留原备注';d.details.fighterCalculator={species:'矮人',elfLineage:'高等精灵',armor:'none',shield:false,characterClass:'战士',subclass:'champion',classSkills:[]};
 let f=characterFeatures(d);assert.ok(f.species.includes('矮人坚韧'));assert.ok(f.clsFeatures.some(x=>x.name==='回气'));assert.equal(f.subFeatures.length,0);
 d.level=3;f=characterFeatures(d);assert.ok(f.subFeatures.some(x=>x.name==='精通重击'));assert.equal(d.details.features,'保留原备注');
 d.details.fighterCalculator.subclass='battle-master';assert.equal(characterFeatures(d).subclassSupported,false);
});
