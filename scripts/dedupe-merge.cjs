const fs = require('fs');
const file = 'apps/web/src/featureCatalog.ts';
let s = fs.readFileSync(file, 'utf8');
const oldF = `function mergeFeatures(base:Record<string,Feature[]>,pick:(g:GroupFeatureData)=>Record<string,Feature[]>){const out:Record<string,Feature[]>={...base};for(const g of dataGroups)for(const [k,v] of Object.entries(pick(g)))out[k]=[...(out[k]??[]),...v];return out;}`;
const newF = `function mergeFeatures(base:Record<string,Feature[]>,pick:(g:GroupFeatureData)=>Record<string,Feature[]>){const out:Record<string,Feature[]>={};for(const [k,v] of Object.entries(base))out[k]=[...v];for(const g of dataGroups)for(const [k,v] of Object.entries(pick(g))){const list=out[k]??(out[k]=[]);for(const f of v){const i=list.findIndex(x=>x.name===f.name);if(i>=0)list[i]=f;else list.push(f);}}return out;}`;
const oldS = `function mergeSpecies(base:Record<string,string[]>,pick:(g:GroupFeatureData)=>Record<string,string[]>){const out:Record<string,string[]>={...base};for(const g of dataGroups)for(const [k,v] of Object.entries(pick(g)))out[k]=[...(out[k]??[]),...v];return out;}`;
const newS = `function mergeSpecies(base:Record<string,string[]>,pick:(g:GroupFeatureData)=>Record<string,string[]>){const out:Record<string,string[]>={};for(const [k,v] of Object.entries(base))out[k]=[...v];for(const g of dataGroups)for(const [k,v] of Object.entries(pick(g))){const list=out[k]??(out[k]=[]);for(const f of v)if(!list.includes(f))list.push(f);}return out;}`;
for (const [oldT, newT, label] of [[oldF, newF, 'mergeFeatures'], [oldS, newS, 'mergeSpecies']]) {
  const n = s.split(oldT).length - 1;
  if (n !== 1) { console.error('ANCHOR FAIL', label, n); process.exit(1); }
  s = s.split(oldT).join(newT);
}
fs.writeFileSync(file, s);
console.log('patched merge functions');
