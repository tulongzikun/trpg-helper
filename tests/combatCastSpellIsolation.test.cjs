const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat } = require('../apps/web/src/combat.ts');
const { castSpell, setSpellSlots } = require('../apps/web/src/combatSpells.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `cast-${++counter}`;

const casterSnapshot = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-caster', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '塞拉', species: '人类', characterClass: '法师', level: 5,
    abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
    maxHp: 30, armorClass: 13, speedFt: 30, actions: '法杖：+2 命中，1d6 钝击伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '施法', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const added = addCharacter(store, casterSnapshot, { battleId: store.battles[0].id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const casterId = battle.actors.find(actor => actor.name === '塞拉').id;
  const targetId = battle.actors.find(actor => actor.side === '敌方').id;
  const initiatives = {};
  battle.actors.forEach((actor) => { initiatives[actor.id] = actor.id === casterId ? 20 : 10; });
  const started = startCombat(battle, initiatives);
  return { battle: started, casterId, targetId };
}

const withSlots = (battle, casterId, slots) => setSpellSlots(battle, casterId, slots);

test('施放法术不会改动传入的战斗对象', () => {
  const { battle, casterId, targetId } = setup();
  const ready = withSlots(battle, casterId, [2, 1]);
  const snapshotSlots = [...ready.actors.find(actor => actor.id === casterId).combat.spellSlots];
  const snapshotLog = ready.combat.log.length;
  castSpell(ready, {
    casterId, spell: '魔法飞弹', level: 1, save: { targetIds: [targetId], ability: 'dex', dc: 13, damageExpression: '3d4+3', damageType: '力场' },
  }, { random: () => 0.99 });
  const after = ready.actors.find(actor => actor.id === casterId).combat.spellSlots;
  assert.deepEqual(after, snapshotSlots, '传入对象的法术位被改动了');
  assert.equal(ready.combat.log.length, snapshotLog, '传入对象的日志被追加了');
});

test('施放一环法术后返回的档案扣掉一个一环法术位', () => {
  const { battle, casterId, targetId } = setup();
  const ready = withSlots(battle, casterId, [2, 0]);
  const result = castSpell(ready, {
    casterId, spell: '魔法飞弹', level: 1, save: { targetIds: [targetId], ability: 'dex', dc: 13, damageExpression: '3d4+3', damageType: '力场' },
  }, { random: () => 0.99 });
  assert.deepEqual(result.battle.actors.find(actor => actor.id === casterId).combat.spellSlots, [1, 0]);
});

test('没有登记法术位时施法照常进行也不报错', () => {
  const { battle, casterId, targetId } = setup();
  const result = castSpell(battle, {
    casterId, spell: '灼热射线', level: 2, save: { targetIds: [targetId], ability: 'dex', dc: 13, damageExpression: '2d6', damageType: '火焰' },
  }, { random: () => 0.99 });
  assert.ok(result.battle.combat.log.some(entry => entry.text.includes('施放「灼热射线」')));
});

test('戏法不消耗法术位', () => {
  const { battle, casterId, targetId } = setup();
  const ready = withSlots(battle, casterId, [1]);
  const result = castSpell(ready, {
    casterId, spell: '火焰箭', level: 0, save: { targetIds: [targetId], ability: 'dex', dc: 13, damageExpression: '1d10', damageType: '火焰' },
  }, { random: () => 0.99 });
  assert.deepEqual(result.battle.actors.find(actor => actor.id === casterId).combat.spellSlots, [1]);
});

test('法术位用尽时拒绝施法', () => {
  const { battle, casterId, targetId } = setup();
  const ready = withSlots(battle, casterId, [0]);
  assert.throws(() => castSpell(ready, {
    casterId, spell: '魔法飞弹', level: 1, save: { targetIds: [targetId], ability: 'dex', dc: 13, damageExpression: '3d4+3', damageType: '力场' },
  }, { random: () => 0.99 }), /1 环法术位已经用完。/);
});
