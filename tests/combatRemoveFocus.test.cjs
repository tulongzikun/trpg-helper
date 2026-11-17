const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, castBless, castFogCloud, markSummon, removeCombatant } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `rmf-${++counter}`;

const cleric = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-rmf', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '赛拉', species: '人类', characterClass: '牧师', level: 5,
    abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 16, cha: 12 },
    maxHp: 36, armorClass: 16, speedFt: 30, actions: '锤矛：+4 命中，1d6+2 钝击伤害，触及 5 尺', notes: '', details: {},
  },
};
const ally = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-rmf-ally', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '布兰', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 44, armorClass: 17, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '移除专注', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const withCleric = addCharacter(store, cleric, { battleId: battle.id, side: '友方' }, ids());
  const withAlly = addCharacter(withCleric.store, ally, { battleId: battle.id, side: '友方' }, ids());
  const full = withAlly.store.battles[0];
  const clericId = full.actors.find(actor => actor.name === '赛拉').id;
  const allyId = full.actors.find(actor => actor.name === '布兰').id;
  const foeId = full.actors.find(actor => actor.side === '敌方').id;
  const initiatives = {};
  full.actors.forEach((actor) => { initiatives[actor.id] = actor.id === clericId ? 20 : actor.id === allyId ? 15 : 10; });
  const started = startCombat(full, initiatives);
  const placed = {
    ...started,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: started.actors.map(actor => actor.id === clericId ? { ...actor, position: { x: 0, y: 0 } }
      : actor.id === allyId ? { ...actor, position: { x: 0, y: 1 } }
        : { ...actor, position: { x: 0, y: 3 } }),
  };
  return { battle: placed, clericId, allyId, foeId };
}

const textsOf = battle => (battle.combat?.log ?? []).map(item => item.text);

test('移除正在专注的施法者会中断专注并解除祝福', () => {
  const { battle, clericId, allyId } = setup();
  const blessed = castBless(battle, clericId, [allyId]);
  assert.ok(blessed.actors.find(actor => actor.id === allyId).combat.blessed >= 1, '祝福应已生效');
  const removed = removeCombatant(blessed, clericId);
  assert.equal(removed.actors.find(actor => actor.id === allyId).combat.blessed, undefined);
  assert.ok(textsOf(removed).some(text => text.includes('中断了对「祝福术」的专注')));
});

test('移除施法者会清掉它留下的云雾', () => {
  const { battle, clericId } = setup();
  const fogged = castFogCloud(battle, clericId, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
  assert.ok(fogged.fog?.length);
  const removed = removeCombatant(fogged, clericId);
  assert.equal(removed.fog, undefined);
});

test('没有专注的单位被移除时不写专注日志', () => {
  const { battle, allyId } = setup();
  const removed = removeCombatant(battle, allyId);
  assert.ok(!textsOf(removed).some(text => text.includes('中断了对')));
});

test('移除召唤者会一并移除它的召唤物', () => {
  const { battle, clericId, allyId, foeId } = setup();
  // markSummon 要求召唤者已经在维持专注
  const blessed = castBless(battle, clericId, [allyId]);
  const withSummon = markSummon(blessed, foeId, { ownerId: clericId, name: '天界犬' });
  const summon = withSummon.actors.find(actor => actor.summon?.ownerId === clericId);
  assert.ok(summon, '应已生成召唤物');
  const summonId = summon.id;
  const removed = removeCombatant(withSummon, clericId);
  assert.equal(removed.actors.some(actor => actor.id === summonId), false);
  assert.ok(textsOf(removed).some(text => text.includes('离开战场')));
});

test('移除后剩余单位仍能继续行动', () => {
  const { battle, clericId, allyId } = setup();
  const removed = removeCombatant(battle, clericId);
  assert.ok(removed.actors.find(actor => actor.id === allyId));
  assert.ok(removed.combat.order.includes(allyId));
});
