const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, damageActor, jumpBack, currentActorId } = require('../apps/web/src/combat.ts');
const { replayFrames, replayText, replayDepth } = require('../apps/web/src/combatReplay.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `rp-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '回放', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const enemy = { ...base.actors[0], currentHp: 60, maxHp: 60 };
  const ally = { ...enemy, id: 'ally', name: '艾拉', side: '友方' };
  const battle = startCombat({ ...base, actors: [ally, enemy] }, { ally: 20, [enemy.id]: 5 });
  return { battle, allyId: 'ally', enemyId: enemy.id };
}

test('未操作时只有当前局面一帧', () => {
  const { battle } = setup();
  const frames = replayFrames(battle);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].index, 1);
  assert.equal(frames[0].actor, '艾拉');
  assert.ok(frames[0].added.length >= 1);
  assert.equal(replayDepth(battle), 0);
});

test('每步新增日志分别记录在对应帧里', () => {
  const { battle, enemyId } = setup();
  const first = damageActor(battle, enemyId, 5, '挥砍').battle;
  const second = damageActor(first, enemyId, 7, '挥砍').battle;
  const frames = replayFrames(second);
  assert.equal(frames.length, 3);
  assert.deepEqual(frames.map(frame => frame.index), [1, 2, 3]);
  assert.ok(frames[1].added.some(text => text.includes('5 点')));
  assert.ok(frames[2].added.some(text => text.includes('7 点')));
  assert.equal(replayDepth(second), 2);
});

test('回放摘要包含步数、轮次与日志', () => {
  const { battle, enemyId } = setup();
  const next = damageActor(battle, enemyId, 5, '挥砍').battle;
  const text = replayText(next);
  assert.match(text, /第 1 步（第 1 轮/);
  assert.match(text, /第 2 步（第 1 轮/);
  assert.match(text, /5 点/);
});

test('jumpBack 回退到指定步', () => {
  const { battle, enemyId } = setup();
  const first = damageActor(battle, enemyId, 5, '挥砍').battle;
  const second = damageActor(first, enemyId, 7, '挥砍').battle;
  const restored = jumpBack(second, 1);
  const hp = restored.actors.find(item => item.id === enemyId).currentHp;
  assert.equal(hp, 55);
  assert.equal(replayDepth(restored), 1);
  const back = jumpBack(second, 2);
  assert.equal(back.actors.find(item => item.id === enemyId).currentHp, 60);
  assert.equal(currentActorId(back), 'ally');
});

test('非法步数会被拒绝', () => {
  const { battle, enemyId } = setup();
  const next = damageActor(battle, enemyId, 5, '挥砍').battle;
  assert.throws(() => jumpBack(next, 0), /撤销步数须为正整数。/);
  assert.throws(() => jumpBack(next, 5), /撤销步数超出可回退范围。/);
});

test('没有可回退步骤时摘要给出提示', () => {
  const { battle } = setup();
  assert.equal(replayText(battle), '暂无可回放的步骤。');
});
