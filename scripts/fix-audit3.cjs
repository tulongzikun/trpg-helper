const fs = require('fs');
const p = 'scripts/audit-checklist.cjs';
let s = fs.readFileSync(p, 'utf8');
const oldU = "const hasUi = /界面|显示|区域|选择|输入/.test(detail);";
const newU = "const hasUi = /界面|显示|区域|选择|输入|记录|按钮|资源/.test(detail);";
if (!s.includes(oldU)) { console.error('anchor fail'); process.exit(1); }
fs.writeFileSync(p, s.replace(oldU, newU));
console.log('audit ui regex patched');
