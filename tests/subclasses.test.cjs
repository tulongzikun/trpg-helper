const {test}=require('node:test');const assert=require('node:assert/strict');
const {subclasses,subclassLabel}=require('../apps/web/src/subclasses.ts');
const {newDraft,generationError,emptyCharacterStore,saveDraft,publishCharacter,exportCharacter,importCharacter}=require('../apps/web/src/characters.ts');
test('all 12 classes have four distinct subclass choices',()=>{
 assert.equal(Object.keys(subclasses).length,12);
 for(const options of Object.values(subclasses)){assert.equal(options.length,4);assert.equal(new Set(options.map(x=>x.id)).size,4);}
 assert.match(subclassLabel('战士','champion'),/勇士/);assert.equal(subclassLabel('法师','champion'),undefined);
});
test('subclass choice survives publish and export and mismatched class is rejected',()=>{
 const draft=newDraft();draft.name='测试';draft.species='人类';draft.characterClass='战士';draft.details.fighterCalculator={species:'人类',elfLineage:'高等精灵',armor:'none',shield:false,characterClass:'战士',classSkills:['运动','察觉'],subclass:'champion'};
 assert.equal(generationError(draft),null);let store=saveDraft(emptyCharacterStore(),'id',draft);store=publishCharacter(store,'id');const imported=importCharacter(emptyCharacterStore(),exportCharacter(store.characters[0]));
 assert.equal(imported.characters[0].draft.details.fighterCalculator.subclass,'champion');assert.equal(imported.characters[0].revisions[0].sheet.details.fighterCalculator.subclass,'champion');
 draft.details.fighterCalculator.characterClass='法师';assert.match(generationError(draft),/子职业/);
});
