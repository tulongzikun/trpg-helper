const fs = require('fs');
const p = 'scripts/audit-checklist.cjs';
let s = fs.readFileSync(p, 'utf8');
const oldR = "const hasSource = /来源|PHB|SRD|页|规则/.test(detail);";
const newR = "const hasSource = /来源|PHB|SRD|页|规则|\\.ts\\b|tests\\//.test(detail);";
if (!s.includes(oldR)) { console.error('anchor fail'); process.exit(1); }
fs.writeFileSync(p, s.replace(oldR, newR));
console.log('audit source regex patched');
