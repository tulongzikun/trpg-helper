const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseAttackText, monsterAttackSources, characterWeaponSources, characterTextSources, attackSources } = require('../apps/web/src/attackSources.ts');

function monsterActor(actions = []) {
  return {
    id: 'm1', name: '雾爪兽', side: '敌方', currentHp: 20, maxHp: 20,
    source: { entryId: 'e1', blockId: 'b1', entryName: '雾爪兽', source: { name: '测试' }, revision: 1 },
    template: { armorClass: 14, proficiencyBonus: 2, abilities: { str: 14, dex: 12, con: 12, int: 6, wis: 10, cha: 6 }, actions },
  };
}
function characterActor(sheet = {}) {
  return {
    id: 'c1', name: '艾拉', side: '友方', currentHp: 40, maxHp: 40,
    source: { entryId: 'char-1', blockId: 'char-1', entryName: '艾拉', source: { name: '角色库' }, revision: 1 },
    template: { armorClass: 16 },
    characterSnapshot: {
      schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
      sheet: { name: '艾拉', level: 5, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, details: {}, actions: '', ...sheet },
    },
  };
}

test('解析近战攻击描述中的加值、伤害骰、类型与触及', () => {
  const parsed = parseAttackText('近战武器攻击：+5 命中，触及 5 尺，一个目标。命中：7 (1d8 + 3) 钝击伤害。');
  assert.equal(parsed.attackBonus, 5);
  assert.equal(parsed.damageExpression, '1d8+3');
  assert.equal(parsed.damageType, '钝击');
  assert.equal(parsed.range, 'melee');
  assert.equal(parsed.distanceFt, 5);
});

test('解析远程攻击描述中的射程', () => {
  const parsed = parseAttackText('远程武器攻击：+4 命中，射程 80/320 尺，一个目标。命中：5 (1d6 + 2) 穿刺伤害。');
  assert.equal(parsed.attackBonus, 4);
  assert.equal(parsed.damageExpression, '1d6+2');
  assert.equal(parsed.damageType, '穿刺');
  assert.equal(parsed.range, 'ranged');
  assert.equal(parsed.distanceFt, 80);
});

test('没有命中信息的描述不会产出攻击加值', () => {
  const parsed = parseAttackText('多重攻击：该生物发动两次爪击。');
  assert.equal(parsed.attackBonus, undefined);
  assert.equal(parsed.damageExpression, undefined);
});

test('怪物动作只有可解析的才成为攻击来源', () => {
  const actor = monsterActor([
    { id: 'claw', name: '爪击', description: '近战武器攻击：+6 命中，触及 5 尺，一个目标。命中：8 (1d8 + 4) 挥砍伤害。', automation: 'manual' },
    { id: 'multi', name: '多重攻击', description: '该生物发动两次爪击。', automation: 'manual' },
  ]);
  const sources = monsterAttackSources(actor);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].label, '爪击');
  assert.equal(sources[0].attackBonus, 6);
  assert.equal(sources[0].damageExpression, '1d8+4');
  assert.equal(sources[0].damageType, '挥砍');
  assert.equal(sources[0].origin, 'monster-action');
});

test('角色装备文本识别武器并按属性与熟练计算', () => {
  const actor = characterActor({ details: { equipment: '长剑、长弓、盾牌' } });
  const sources = characterWeaponSources(actor);
  assert.deepEqual(sources.map(item => item.label), ['长剑', '长弓']);
  assert.equal(sources[0].attackBonus, 6, '力量 16 调整值 +3，5 级熟练 +3');
  assert.equal(sources[0].damageExpression, '1d8+3');
  assert.equal(sources[0].range, 'melee');
  assert.equal(sources[1].attackBonus, 5, '敏捷 14 调整值 +2，5 级熟练 +3');
  assert.equal(sources[1].damageExpression, '1d8+2');
  assert.equal(sources[1].range, 'ranged');
  assert.equal(sources[1].distanceFt, 150);
});

test('角色「攻击与法术」文本中的自定义攻击也会被解析', () => {
  const actor = characterActor({ actions: '火焰射线：+6 命中，射程 120 尺，一个目标。命中：10 (3d6) 火焰伤害。' });
  const sources = characterTextSources(actor);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].label, '火焰射线');
  assert.equal(sources[0].attackBonus, 6);
  assert.equal(sources[0].damageExpression, '3d6');
  assert.equal(sources[0].damageType, '火焰');
  assert.equal(sources[0].distanceFt, 120);
});

test('没有可用来源时回落到按属性估算', () => {
  const actor = characterActor({ details: {}, actions: '' });
  const sources = attackSources(actor);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].origin, 'estimate');
  assert.equal(sources[0].attackBonus, 6);
  const monster = attackSources(monsterActor([]));
  assert.equal(monster[0].origin, 'estimate');
  assert.equal(monster[0].attackBonus, 4, '力量 14 调整值 +2，熟练 +2');
});
