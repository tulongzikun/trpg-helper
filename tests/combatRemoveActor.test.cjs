const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, grapple, removeCombatant, currentActorId, moveActorToCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `rm-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-rm', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '布兰', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '移除', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const heroId = withHero.actors.find(actor => actor.side === '友方').id;
  const foes = withHero.actors.filter(actor => actor.side === '敌方');
  const initiatives = {};
  withHero.actors.forEach((actor) => { initiatives[actor.id] = actor.id === heroId ? 20 : actor.id === foes[0].id ? 10 : 5; });
  const started = startCombat(withHero, initiatives);
  const placed = {
    ...started,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: started.actors.map(actor => actor.id === heroId ? { ...actor, position: { x: 0, y: 0 } } : actor.id === foes[0].id ? { ...actor, position: { x: 0, y: 1 } } : { ...actor, position: { x: 3, y: 3 } }),
  };
  return { battle: placed, heroId, foeA: foes[0].id, foeB: foes[1].id };
}

const textsOf = battle => (battle.combat?.log ?? []).map(item => item.text);

test('移除单位后不再出现在战场与先攻顺序里', () => {
  const { battle, foeB } = setup();
  const removed = removeCombatant(battle, foeB);
  assert.equal(removed.actors.some(actor => actor.id === foeB), false);
  assert.equal(removed.combat.order.includes(foeB), false);
  assert.ok(textsOf(removed).some(text => text.includes('从战斗中移除')));
});

test('移除当前行动者会把回合交给下一个单位', () => {
  const { battle, heroId, foeA } = setup();
  assert.equal(currentActorId(battle), heroId);
  const removed = removeCombatant(battle, heroId);
  assert.equal(currentActorId(removed), foeA);
  assert.ok(textsOf(removed).some(text => text.includes('轮到')));
});

test('移除被擒抱的目标会清理擒抱关系', () => {
  const { battle, heroId, foeA } = setup();
  const grabbed = grapple(battle, { attackerId: heroId, targetId: foeA }, { random: () => 0.99 }).battle;
  const removed = removeCombatant(grabbed, foeA);
  const heroState = removed.actors.find(actor => actor.id === heroId).combat;
  assert.equal(heroState.grappledBy, undefined);
});

test('移除擒抱者会解除受害者的擒抱状态', () => {
  const { battle, heroId, foeA } = setup();
  const grabbed = grapple(battle, { attackerId: heroId, targetId: foeA }, { random: () => 0.99 }).battle;
  const removed = removeCombatant(grabbed, heroId);
  const foeState = removed.actors.find(actor => actor.id === foeA).combat;
  assert.equal(foeState.grappledBy, undefined);
  assert.equal(foeState.conditions.includes('擒抱'), false);
});

test('未知单位会被拒绝', () => {
  const { battle } = setup();
  assert.throws(() => removeCombatant(battle, 'nobody'), /未找到战斗单位。/);
});

test('移除后剩下的单位仍能正常行动', () => {
  const { battle, heroId, foeB } = setup();
  const removed = removeCombatant(battle, foeB);
  const moved = moveActorToCell(removed, heroId, 0, 2);
  assert.deepEqual(moved.actors.find(actor => actor.id === heroId).position, { x: 0, y: 2 });
});
