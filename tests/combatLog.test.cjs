const { test } = require('node:test');
const assert = require('node:assert/strict');
const { filterLog, logRounds } = require('../apps/web/src/combatLog.ts');

const entries = [
  { id: 'a', round: 1, text: '先攻顺序：艾拉、雾影兽。' },
  { id: 'b', round: 1, text: '艾拉攻击雾影兽。', detail: '命中，造成 8 点挥砍伤害' },
  { id: 'c', round: 2, text: '雾影兽攻击艾拉。', detail: '未命中' },
  { id: 'd', round: 2, text: '艾拉饮下治疗药水，恢复 8 点生命值。' },
  { id: 'e', round: 3, text: '战斗结束。' },
];

test('不加筛选时返回全部记录并保持原顺序', () => {
  const result = filterLog(entries);
  assert.deepEqual(result.map(item => item.id), ['a', 'b', 'c', 'd', 'e']);
});

test('关键字同时匹配正文与明细，且不区分大小写', () => {
  assert.deepEqual(filterLog(entries, { keyword: '生命值' }).map(item => item.id), ['d']);
  assert.deepEqual(filterLog(entries, { keyword: '挥砍' }).map(item => item.id), ['b']);
  assert.deepEqual(filterLog(entries, { keyword: '未命中' }).map(item => item.id), ['c']);
});

test('按轮次筛选，并列出出现过的轮次', () => {
  assert.deepEqual(filterLog(entries, { round: 2 }).map(item => item.id), ['c', 'd']);
  assert.deepEqual(logRounds(entries), [3, 2, 1]);
});

test('按单位名筛选正文或明细', () => {
  assert.deepEqual(filterLog(entries, { actorName: '雾影兽' }).map(item => item.id), ['a', 'b', 'c']);
  assert.deepEqual(filterLog(entries, { actorName: '艾拉', round: 1 }).map(item => item.id), ['a', 'b']);
});

test('limit 只保留最后若干条，0 返回空数组', () => {
  assert.deepEqual(filterLog(entries, { limit: 2 }).map(item => item.id), ['d', 'e']);
  assert.deepEqual(filterLog(entries, { limit: 0 }), []);
  assert.deepEqual(filterLog(entries, { keyword: '  ' }).map(item => item.id), ['a', 'b', 'c', 'd', 'e']);
});
