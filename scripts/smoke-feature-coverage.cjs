const { newDraft } = require('../apps/web/src/characters.ts');
const { characterFeatures, mergedClassFeatures, mergedSubclassFeatures, mergedSpeciesFeatures } = require('../apps/web/src/featureCatalog.ts');
const classes = Object.keys(mergedClassFeatures);
let bad = 0;
for (const cls of classes) {
  const d = newDraft();
  d.name = 'T-' + cls;
  d.species = '浜虹被';
  d.characterClass = cls;
  d.level = 20;
  d.details.fighterCalculator = { species: '浜虹被', elfLineage: '', armor: 'none', shield: false, characterClass: cls, classSkills: [] };
  try {
    const f = characterFeatures(d);
    if (!f || f.clsFeatures.length === 0) { bad++; console.log('EMPTY', cls); }
    else console.log('OK', cls, 'features', f.clsFeatures.length);
  } catch (e) { bad++; console.log('THROW', cls, e.message); }
}
for (const key of Object.keys(mergedSubclassFeatures)) {
  const [cls, sub] = key.split(':');
  const d = newDraft();
  d.name = 'T-' + key;
  d.species = '浜虹被';
  d.characterClass = cls;
  d.subclass = sub;
  d.level = 20;
  d.details.fighterCalculator = { species: '浜虹被', elfLineage: '', armor: 'none', shield: false, characterClass: cls, subclass: sub, classSkills: [] };
  try {
    const f = characterFeatures(d);
    if (!f || !f.subclassSupported) { bad++; console.log('SUBNOTSUPPORTED', key); }
  } catch (e) { bad++; console.log('THROWSUB', key, e.message); }
}
for (const sp of Object.keys(mergedSpeciesFeatures)) {
  const d = newDraft();
  d.name = 'T-' + sp;
  d.species = sp;
  d.characterClass = '鎴樺＋';
  d.level = 20;
  d.details.fighterCalculator = { species: sp, elfLineage: '', armor: 'none', shield: false, characterClass: '鎴樺＋', classSkills: [] };
  try {
    const f = characterFeatures(d);
    if (!f || f.species.length === 0) { bad++; console.log('EMPTYSPECIES', sp); }
  } catch (e) { bad++; console.log('THROWSPECIES', sp, e.message); }
}
console.log('subclass keys', Object.keys(mergedSubclassFeatures).length, 'species keys', Object.keys(mergedSpeciesFeatures).length, 'problems', bad);
