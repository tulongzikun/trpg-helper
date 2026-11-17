const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, startCombat, endTurn, suppressingFire, takeLongRest, hostileTargets } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `suppress-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-suppress', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '莉娅', species: '人类', characterClass: '战士', level: 4,
    abilities: { str: 12, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 40, armorClass: 15, speedFt: 30, actions: '长弓：+5 命中，1d8+2 穿刺伤害，射程 150 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '压制', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  let next = configureGrid(added.store.battles[0], { width: 14, height: 10, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = startCombat(next, initiatives);
  next = structuredClone(next);
  const heroActor = next.actors.find(actor => actor.side === '友方');
  const foe = next.actors.find(actor => actor.side === '敌方');
  heroActor.position = { x: 0, y: 0 };
  foe.position = { x: 6, y: 0 };
  return { battle: next, hero: heroActor, foe };
}

const logs = battle => battle.combat.log.map(line => line.text).join('\n');
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

test('压制成功时目标获得劣势并消耗动作', () => {
  const { battle, hero, foe } = setup();
  const result = suppressingFire(battle, hero.id, foe.id, { random: sequence(0.9) });
  const state = result.battle.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(result.outcome.success, true);
  assert.equal(state.suppressed, true);
  assert.equal(result.battle.actors.find(actor => actor.id === hero.id).combat.actionUsed, true);
  assert.match(logs(result.battle), /掩护射击/);
});

test('检定失败时不给目标施加压制', () => {
  const { battle, hero, foe } = setup();
  const result = suppressingFire(battle, hero.id, foe.id, { random: sequence(0.05) });
  const state = result.battle.actors.find(actor => actor.id === foe.id).combat;
  assert.equal(result.outcome.success, false);
  assert.equal(state.suppressed, undefined);
  assert.match(logs(result.battle), /没有奏效/);
});

test('被压制的单位攻击时处于劣势', () => {
  const { battle, hero, foe } = setup();
  const first = suppressingFire(battle, hero.id, foe.id, { random: sequence(0.9) });
  const foeTurn = endTurn(first.battle, { random: sequence(0.9, 0.5, 0.5) });
  const ready = structuredClone(foeTurn);
  ready.actors.find(actor => actor.id === foe.id).position = { x: 1, y: 0 };
  const result = attack(ready, {
    attackerId: foe.id, targetId: hero.id, attackBonus: 4, damageExpression: '1d6+2', damageType: '挥砍',
  }, { random: sequence(0.9, 0.5, 0.5) });
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.ok(result.outcome.notes.some(note => note.includes('被压制')));
});

test('压制在目标回合结束时解除', () => {
  const { battle, hero, foe } = setup();
  const first = suppressingFire(battle, hero.id, foe.id, { random: sequence(0.9) });
  const foeTurn = endTurn(first.battle, { random: sequence(0.9) });
  assert.equal(foeTurn.actors.find(actor => actor.id === foe.id).combat.suppressed, true);
  const afterFoe = endTurn(foeTurn, { random: sequence(0.9) });
  assert.equal(afterFoe.actors.find(actor => actor.id === foe.id).combat.suppressed, undefined);
  assert.match(logs(afterFoe), /摆脱了掩护射击的压制/);
});

test('超出射程、自己或同伴都会被拒绝', () => {
  const { battle, hero, foe } = setup();
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === foe.id).position = { x: 13, y: 0 };
  assert.throws(() => suppressingFire(far, hero.id, foe.id, { random: sequence(0.9) }), /掩护射击的射程是 60 尺。/);
  assert.throws(() => suppressingFire(battle, hero.id, hero.id, { random: sequence(0.9) }), /不能压制自己。/);
  const ally = structuredClone(battle);
  ally.actors.push({ ...ally.actors.find(actor => actor.id === hero.id), id: 'ally-suppress', name: '同伴' });
  assert.throws(() => suppressingFire(ally, hero.id, 'ally-suppress', { random: sequence(0.9) }), /只能压制敌对单位。/);
});

test('长休清除压制状态', () => {
  const { battle, hero, foe } = setup();
  const first = suppressingFire(battle, hero.id, foe.id, { random: sequence(0.9) });
  const rested = takeLongRest(first.battle, {});
  assert.equal(rested.actors.find(actor => actor.id === foe.id).combat.suppressed, undefined);
});

test('hostileTargets 能筛出 60 尺内的敌人作为默认目标', () => {
  const { battle, hero, foe } = setup();
  const targets = hostileTargets(battle, hero.id, 60);
  assert.deepEqual(targets.map(item => item.id), [foe.id]);
});
