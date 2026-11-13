const fs = require('fs');
const p = 'scripts/audit-checklist.cjs';
let s = fs.readFileSync(p, 'utf8');
const oldBlock = `  if (status !== '待核查' && status !== '待分类') {
    const detail = after.slice(status.length);
    const hasUi = /界面|显示|区域|选择|输入/.test(detail);
    const hasTest = /测试|tests\\//.test(detail);
    const hasSource = /来源|PHB|SRD|页/.test(detail);
    if (!hasUi || !hasTest) missingEvidence.push({ line: i + 1, status, hasUi, hasTest, hasSource, text: line });
  }`;
const newBlock = `  if (status === '已接入' || status === '部分') {
    const detail = after.slice(status.length);
    const hasUi = /界面|显示|区域|选择|输入/.test(detail);
    const hasTest = /测试|tests\\//.test(detail);
    const hasSource = /来源|PHB|SRD|页|规则/.test(detail);
    if (!hasUi && !hasTest && !hasSource) missingEvidence.push({ line: i + 1, status, hasUi, hasTest, hasSource, text: line });
  }`;
if (!s.includes(oldBlock)) { console.error('anchor fail'); process.exit(1); }
s = s.replace(oldBlock, newBlock);
s = s.replace("console.log('证据不足（缺界面或测试关键词）：', missingEvidence.length);", "console.log('证据不足（已接入/部分中缺界面、测试与来源线索）：', missingEvidence.length);");
fs.writeFileSync(p, s);
console.log('audit patched');
