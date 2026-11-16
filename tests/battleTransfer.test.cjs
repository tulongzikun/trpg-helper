const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, validateBattle } = require('../apps/web/src/battle.ts');
const { startCombat, attack, currentActorId } = require('../apps/web/src/combat.ts');
const { battleExportSchema, exportBattle, importBattle, battleTranscript } = require('../apps/web/src/battleTransfer.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const battle = addMonsters(emptyStore(), card, { newBattleName: '测试战斗', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const started = startCombat(battle, {});
  const attacker = currentActorId(started) ?? started.actors[0].id;
  const target = started.actors.find(actor => actor.id !== attacker).id;
  const fought = attack(started, { attackerId: attacker, targetId: target, attackBonus: 5, damageExpression: '1d6+2', damageType: '挥砍' }, { random: sequence(0.5, 0.5), makeId: ids() }).battle;
  return fought;
}

const withoutUndo = battle => JSON.parse(JSON.stringify({ ...battle, combat: battle.combat ? { ...battle.combat, undo: [] } : undefined }));

test('导出的档案可以原样导入，并清空撤销历史', () => {
  const battle = setup();
  assert.ok(battle.combat.undo.length > 0);
  const text = exportBattle(battle, new Date('2026-02-01T00:00:00Z'));
  const payload = JSON.parse(text);
  assert.equal(payload.schema, battleExportSchema);
  assert.equal(payload.exportedAt, '2026-02-01T00:00:00.000Z');
  assert.deepEqual(payload.battle.combat.undo, []);
  assert.deepEqual(importBattle(text), withoutUndo(battle));
});

test('导入兼容裸战斗对象，并自动避开已存在的 id', () => {
  const battle = setup();
  const imported = importBattle(JSON.stringify(battle), [battle.id, `${battle.id}-2`]);
  assert.equal(imported.id, `${battle.id}-3`);
  assert.equal(imported.name, battle.name);
  assert.equal(imported.actors.length, 2);
});

test('拒绝不是 JSON 的文本', () => {
  assert.throws(() => importBattle('这不是档案'), /战斗档案不是有效的 JSON。/);
});

test('拒绝未知格式版本', () => {
  const text = JSON.stringify({ schema: 'trpg-helper.battle-export/v2', battle: {} });
  assert.throws(() => importBattle(text), /战斗档案的格式或版本不受支持。/);
});

test('拒绝结构损坏的战斗数据', () => {
  const battle = setup();
  const broken = JSON.parse(JSON.stringify(battle));
  broken.actors[0].maxHp = '不知道';
  assert.throws(() => importBattle(JSON.stringify(broken)), /战斗数据格式无效，无法导入。/);
  assert.throws(() => validateBattle({ id: 'x' }), /战斗数据格式无效，无法导入。/);
});

test('战报包含标题、单位、轮次与日志明细', () => {
  const battle = setup();
  const text = battleTranscript(battle);
  assert.match(text, /^# 战斗记录：测试战斗/m);
  assert.match(text, /- 进度：第 1 轮/);
  assert.match(text, /## 参战单位/);
  assert.match(text, /### 第 1 轮/);
  assert.match(text, new RegExp(`- ${entry.statBlocks[0].name}`));
  assert.match(text, /HP \d+\/\d+/);
  assert.ok(text.endsWith('\n'));
});

test('未开始的战斗也能导出与生成战报', () => {
  const battle = addMonsters(emptyStore(), card, { newBattleName: '准备中', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const imported = importBattle(exportBattle(battle));
  assert.equal(imported.combat, undefined);
  const text = battleTranscript(battle);
  assert.match(text, /- 进度：尚未开始/);
  assert.match(text, /（暂无记录）/);
});
