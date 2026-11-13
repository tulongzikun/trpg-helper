const fs = require('fs');
const file = 'apps/web/src/featureCatalog.ts';
let s = fs.readFileSync(file, 'utf8');
for (const name of ['classFeatures', 'classNotes', 'speciesFeatures', 'subclassFeatures', 'mergedClassFeatures', 'mergedClassNotes', 'mergedSubclassFeatures', 'mergedSpeciesFeatures']) {
  const old = 'const ' + name;
  const neu = 'export const ' + name;
  if (s.split(old).length - 1 === 1) s = s.split(old).join(neu);
  else { console.error('skip/anchor', name, s.split(old).length - 1); }
}
fs.writeFileSync(file, s);
console.log('done');
