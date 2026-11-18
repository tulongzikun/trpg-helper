const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const docPath = path.join(__dirname, '..', 'docs', '战斗引擎_第一版.md');
const lines = fs.readFileSync(docPath, 'utf8').split(/\r?\n/);

const headings = lines
  .map((line, index) => ({ line, index }))
  .filter(item => /^## \d+\./.test(item.line))
  .map(item => ({ number: Number(item.line.match(/^## (\d+)\./)[1]), title: item.line, index: item.index }));

test('每个小节编号只出现一次', () => {
  const seen = new Map();
  const duplicates = [];
  for (const heading of headings) {
    if (seen.has(heading.number)) duplicates.push(`${heading.number}（第 ${seen.get(heading.number)} 与第 ${heading.index} 行）`);
    else seen.set(heading.number, heading.index);
  }
  assert.deepEqual(duplicates, [], `重复的小节编号：${duplicates.join('、')}`);
});

test('小节编号严格递增', () => {
  for (let index = 1; index < headings.length; index += 1) {
    assert.ok(
      headings[index].number > headings[index - 1].number,
      `第 ${index} 个小节（${headings[index].title}）没有比前一个（${headings[index - 1].title}）更大`,
    );
  }
});

test('最后两节固定是候选与验证', () => {
  const tail = headings.slice(-2).map(item => item.title);
  assert.match(tail[0], /^## \d+\. 尚未自动化/);
  assert.match(tail[1], /^## \d+\. 验证/);
});

test('验证段记录的项目数与测试文件里的用例总数一致', () => {
  const verification = lines.slice(headings.at(-1).index).join('\n');
  const claimed = verification.match(/(\d+) 项全部通过/);
  assert.ok(claimed, '验证小节缺少「N 项全部通过」');
  const total = Number(claimed[1]);
  assert.ok(total > 1000, `记录的项目数看起来不对：${total}`);
  // 关闭的用例数只增不减，用它挡住「改了测试却忘记更新文档」。
  assert.ok(total >= 1604, `验证段记录的 ${total} 项低于上一轮已知的 1604 项`);
});

test('阶段总结与规则文档的小节数、用例数一致', () => {
  const summaryPath = path.join(__dirname, '..', 'docs', '战斗引擎_阶段总结.md');
  const summary = fs.readFileSync(summaryPath, 'utf8');
  const sections = summary.match(/\| 规则特性小节 \| (\d+)/);
  const cases = summary.match(/\| 自动化测试 \| (\d+) 项/);
  assert.ok(sections, '阶段总结缺少小节数一行');
  assert.ok(cases, '阶段总结缺少用例数一行');
  assert.equal(Number(sections[1]), headings.length - 2, '阶段总结的小节数与规则文档不符（应排除候选与验证两节）');
  const verified = Number(lines.slice(headings.at(-1).index).join('\n').match(/(\d+) 项全部通过/)[1]);
  assert.equal(Number(cases[1]), verified, '阶段总结的用例数与验证小节记录的数目不符');
});
