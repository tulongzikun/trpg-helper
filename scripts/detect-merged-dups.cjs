const cat = require('../apps/web/src/featureCatalog.ts');
function dupList(list) {
  const seen = new Map();
  for (const x of list) seen.set(x, (seen.get(x) || 0) + 1);
  return [...seen.entries()].filter(([, c]) => c > 1).map(([k, c]) => k + '×' + c);
}
let problems = 0;
for (const [cls, list] of Object.entries(cat.mergedClassFeatures)) {
  const d = dupList(list.map((f) => f.name));
  if (d.length) { problems++; console.log('CLASS', cls, d.join(', ')); }
}
for (const [key, list] of Object.entries(cat.mergedSubclassFeatures)) {
  const d = dupList(list.map((f) => f.name));
  if (d.length) { problems++; console.log('SUB', key, d.join(', ')); }
}
for (const [sp, list] of Object.entries(cat.mergedSpeciesFeatures)) {
  const d = dupList(list.map((f) => (typeof f === 'string' ? f : f.name)));
  if (d.length) { problems++; console.log('SPECIES', sp, d.join(', ')); }
}
console.log('problem sections:', problems);
console.log('counts: classes', Object.keys(cat.mergedClassFeatures).length, 'subclasses', Object.keys(cat.mergedSubclassFeatures).length, 'species', Object.keys(cat.mergedSpeciesFeatures).length);
