const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, validateBattle } = require('../apps/web/src/battle.ts');
const { startCombat, attack, currentActorId, configureGrid, setTerrain, setObscured, toggleWallCell, addAura } = require('../apps/web/src/combat.ts');
const { setSpellSlots } = require('../apps/web/src/combatSpells.ts');
const { battleExportSchema, exportBattle, importBattle, battleTranscript, upgradeBattlePayload } = require('../apps/web/src/battleTransfer.ts');
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

test('战报包含战场信息：地形、遮蔽、墙体与灵光', () => {
  const battle = setup();
  let next = configureGrid(battle, { width: 8, height: 8, cellFt: 5 });
  next = setTerrain(next, 'underwater');
  next = setObscured(next, 'heavy');
  next = toggleWallCell(next, 2, 2);
  const owner = next.actors[0];
  next = addAura(next, { name: '守护灵光', ownerId: owner.id, radiusFt: 10, bonus: 2, kind: 'ac' });
  const text = battleTranscript(next);
  assert.match(text, /## 战场/);
  assert.match(text, /地形：水下/);
  assert.match(text, /遮蔽：重度/);
  assert.match(text, /墙体 1 格/);
  assert.match(text, /灵光：守护灵光（AC \+2，半径 10 尺）/);
  assert.ok(text.indexOf('## 战场') < text.indexOf('## 参战单位'));
});

test('战报的单位行记录动作资源', () => {
  const battle = setup();
  const text = battleTranscript(battle);
  assert.match(text, /资源：动作/);
  assert.match(text, /附赠/);
  assert.match(text, /反应/);
  assert.match(text, /移动已用 \d+ 尺/);
});

test('记录了法术位时战报会显示剩余法术位', () => {
  const battle = setup();
  const actorId = battle.actors[0].id;
  const next = setSpellSlots(battle, actorId, [2, 1]);
  const text = battleTranscript(next);
  assert.match(text, /法术位：2\/1/);
});

test('旧版档案缺少撤销栈、日志与行动顺序时会被补齐', () => {
  const battle = setup();
  const legacy = JSON.parse(JSON.stringify(battle));
  delete legacy.combat.undo;
  delete legacy.combat.log;
  delete legacy.combat.order;
  delete legacy.combat.round;
  delete legacy.combat.turnIndex;
  legacy.actors.forEach(actor => { if (actor.combat) delete actor.combat.conditions; });
  const upgraded = upgradeBattlePayload(legacy);
  assert.deepEqual(upgraded.combat.undo, []);
  assert.deepEqual(upgraded.combat.log, []);
  assert.equal(upgraded.combat.round, 1);
  assert.equal(upgraded.combat.turnIndex, 0);
  assert.deepEqual(upgraded.combat.order, upgraded.actors.map(actor => actor.id));
  assert.deepEqual(upgraded.actors[0].combat.conditions, []);
});

test('升级后的旧档案可以正常导入', () => {
  const battle = setup();
  const legacy = JSON.parse(JSON.stringify(battle));
  delete legacy.combat.undo;
  delete legacy.combat.log;
  const imported = importBattle(JSON.stringify(legacy));
  assert.equal(imported.id, battle.id);
  assert.deepEqual(imported.combat.log, []);
});

test('升级不会破坏当前格式的档案', () => {
  const battle = setup();
  const upgraded = upgradeBattlePayload(JSON.parse(JSON.stringify(battle)));
  assert.deepEqual(upgraded.combat.order, battle.combat.order);
  assert.equal(upgraded.combat.round, battle.combat.round);
  assert.deepEqual(upgraded.actors[0].combat.conditions, battle.actors[0].combat.conditions);
});

test('升级后仍然拒绝损坏的数据', () => {
  const battle = setup();
  const broken = JSON.parse(JSON.stringify(battle));
  broken.actors[0].combat.status = '不知道';
  assert.throws(() => importBattle(JSON.stringify(broken)), /战斗数据格式无效，无法导入。/);
});
