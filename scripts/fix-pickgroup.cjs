const fs = require('fs');
const file = 'apps/web/src/featureCatalog.ts';
let s = fs.readFileSync(file, 'utf8');
const i = s.indexOf('function pickGroupData');
const j = s.indexOf('\n', s.indexOf('return {classFeatures', i));
console.log('OLD:', s.slice(i, j));
const oldFn = s.slice(i, j);
const newFn = `function pickGroupData(m:unknown):GroupFeatureData{const cand:unknown=(m as {data?:GroupFeatureData}).data??(Object.values(m as Record<string,unknown>).find(v=>v&&typeof v==='object'&&'classFeatures' in (v as object))??m);const v=cand as GroupFeatureData;return {classFeatures:v.classFeatures??{},classNotes:v.classNotes??{},subclassFeatures:v.subclassFeatures??{},speciesFeatures:v.speciesFeatures??{}};}`;
if (!oldFn.startsWith('function pickGroupData')) { console.error('anchor fail'); process.exit(1); }
s = s.slice(0, i) + newFn + s.slice(j);
fs.writeFileSync(file, s);
console.log('patched pickGroupData');
