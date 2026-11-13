// Wire the 7 group aggregations into CharacterDetails.tsx (idempotent).
// Usage: node scripts/wire-groups.cjs
const fs = require('node:fs');
const p = 'apps/web/src/CharacterDetails.tsx';
let s = fs.readFileSync(p, 'utf8');
if (s.includes('FeatureGroupsEditor')) { console.log('already wired'); process.exit(0); }
const eol = s.includes('\r\n') ? '\r\n' : '\n';
const importAnchor = "import { DivinerEditor, DivinerSheet } from './DivinerViews';";
if (!s.includes(importAnchor)) throw new Error('import anchor missing');
s = s.replace(importAnchor, importAnchor + eol + "import { FeatureGroupsEditor, FeatureGroupsSheet } from './groups/FeatureGroups';");
const editorRe = /<WildShapeFormsEditor[^>]*\/>/;
const sheetRe = /<WildShapeFormsSheet[^>]*\/>/;
if (!editorRe.test(s) || !sheetRe.test(s)) throw new Error('mount anchors missing');
s = s.replace(editorRe, (m) => m + '<FeatureGroupsEditor draft={draft} onChange={onChange}/>');
s = s.replace(sheetRe, (m) => m + '<FeatureGroupsSheet draft={draft}/>');
fs.writeFileSync(p, s, 'utf8');
console.log('wired: import + editor + sheet');
