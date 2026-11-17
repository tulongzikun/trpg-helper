const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, setObscured, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-obscured', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: { equipment: '长剑' },
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '遮蔽', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  const started = startCombat(withHero, initiatives);
  const friend = started.actors.find(actor => actor.side === '友方');
  const monster = started.actors.find(actor => actor.side === '敌方');
  return { battle: started, friend, monster };
}

const strike = (battle, friend, monster, deps) => attack(battle, {
  attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee',
}, deps);

test('重度遮蔽让攻击检定承受劣势', () => {
  const { battle, friend, monster } = setup();
  const dark = setObscured(battle, 'heavy');
  const result = strike(dark, friend, monster, { random: sequence(0.9, 0.1) });
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.ok(result.battle.combat.log.at(-1).detail.includes('重度遮蔽'));
});

test('轻度遮蔽不影响攻击检定', () => {
  const { battle, friend, monster } = setup();
  const dim = setObscured(battle, 'light');
  const result = strike(dim, friend, monster, { random: sequence(0.5) });
  assert.equal(result.outcome.mode, 'normal');
});

test('明亮环境下攻击检定正常', () => {
  const { battle, friend, monster } = setup();
  const result = strike(battle, friend, monster, { random: sequence(0.5) });
  assert.equal(result.outcome.mode, 'normal');
});

test('再次设为明亮会清除遮蔽', () => {
  const { battle } = setup();
  const dark = setObscured(battle, 'heavy');
  const bright = setObscured(dark, 'none');
  assert.equal(bright.obscured, undefined);
  assert.ok(bright.combat.log.at(-1).text.includes('明亮'));
});

test('非法遮蔽度会被拒绝', () => {
  const { battle } = setup();
  assert.throws(() => setObscured(battle, 'fog'), /遮蔽度取值无效/);
});
