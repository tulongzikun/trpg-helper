const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, saveAttackPreset, removeAttackPreset, attackWithPreset } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `pr-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '常用', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const enemy = { ...base.actors[0], currentHp: 60, maxHp: 60 };
  const hero = { ...enemy, id: 'hero', name: '艾拉', side: '友方' };
  return startCombat({ ...base, actors: [hero, enemy] }, { hero: 20, [enemy.id]: 5 });
}

function input(battle, overrides = {}) {
  const hero = battle.actors.find(item => item.id === 'hero');
  const enemy = battle.actors.find(item => item.side === '敌方');
  return { name: '长剑猛砍', attackerId: hero.id, targetId: enemy.id, attackBonus: 7, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', ...overrides };
}

test('保存常用攻击后可以一键结算', () => {
  const battle = setup();
  const saved = saveAttackPreset(battle, input(battle), ids());
  assert.equal(saved.battle.attackPresets.length, 1);
  assert.ok(saved.battle.combat.log.some(item => item.text.includes('保存了常用攻击「长剑猛砍」')));
  const enemy = saved.battle.actors.find(item => item.side === '敌方');
  const attacked = attackWithPreset(saved.battle, saved.presetId, { random: () => 0.9 });
  const after = attacked.battle.actors.find(item => item.id === enemy.id);
  assert.ok(after.currentHp < enemy.currentHp);
  assert.ok(attacked.battle.combat.log.some(item => item.text.includes('长剑猛砍') || item.text.includes('命中')));
});

test('同名同攻击者会覆盖而不是新增', () => {
  const battle = setup();
  const first = saveAttackPreset(battle, input(battle), ids());
  const second = saveAttackPreset(first.battle, input(first.battle, { attackBonus: 9 }), ids());
  assert.equal(second.battle.attackPresets.length, 1);
  assert.equal(second.battle.attackPresets[0].attackBonus, 9);
  assert.equal(second.presetId, first.presetId);
});

test('删除后无法再使用', () => {
  const battle = setup();
  const saved = saveAttackPreset(battle, input(battle), ids());
  const removed = removeAttackPreset(saved.battle, saved.presetId);
  assert.equal(removed.attackPresets, undefined);
  assert.throws(() => attackWithPreset(removed, saved.presetId), /该常用攻击不存在。/);
  assert.throws(() => removeAttackPreset(removed, saved.presetId), /该常用攻击不存在。/);
});

test('输入校验会拒绝非法参数', () => {
  const battle = setup();
  assert.throws(() => saveAttackPreset(battle, input(battle, { name: '  ' }), ids()), /请填写常用攻击的名称。/);
  assert.throws(() => saveAttackPreset(battle, input(battle, { name: '名'.repeat(31) }), ids()), /不能超过 30 个字符/);
  assert.throws(() => saveAttackPreset(battle, input(battle, { attackBonus: 99 }), ids()), /攻击加值须为 -10 至 30 的整数/);
  assert.throws(() => saveAttackPreset(battle, input(battle, { damageExpression: 'abc' }), ids()), /伤害骰格式无效/);
  assert.throws(() => saveAttackPreset(battle, input(battle, { damageType: '圣光' }), ids()), /伤害类型无效。/);
});

test('最多保存 10 个常用攻击', () => {
  const battle = setup();
  let current = battle;
  for (let index = 0; index < 10; index++) {
    current = saveAttackPreset(current, input(current, { name: `招式${index}` }), ids()).battle;
  }
  assert.equal(current.attackPresets.length, 10);
  assert.throws(() => saveAttackPreset(current, input(current, { name: '多余招式' }), ids()), /最多保存 10 个常用攻击。/);
});
