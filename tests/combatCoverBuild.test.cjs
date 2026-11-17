const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { buildCover, coverAt, coverFromWalls, configureGrid, startCombat, attack } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `cover-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-cover', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '布鲁诺', species: '人类', characterClass: '战士', level: 3,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 32, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const base = addMonsters(emptyStore(), card, { newBattleName: '掩体', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = base.battles[0];
  const added = addCharacter(base, hero, { battleId: battle.id, side: '友方' }, ids());
  let next = configureGrid(added.store.battles[0], { width: 10, height: 10, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = startCombat(next, initiatives);
  const heroActor = next.actors.find(actor => actor.side === '友方');
  const foe = next.actors.find(actor => actor.side === '敌方');
  next = structuredClone(next);
  next.actors.find(actor => actor.id === heroActor.id).position = { x: 0, y: 0 };
  next.actors.find(actor => actor.id === foe.id).position = { x: 4, y: 0 };
  return { battle: next, hero: heroActor, foe };
}

const logs = battle => battle.combat.log.map(line => line.text).join('\n');
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

test('架设掩体会写入掩体格并消耗动作', () => {
  const { battle, hero } = setup();
  const next = buildCover(battle, hero.id, [{ x: 0, y: 0 }]);
  assert.equal(coverAt(next, 0, 0), true);
  assert.equal(next.actors.find(actor => actor.id === hero.id).combat.actionUsed, true);
  assert.ok(logs(next).includes('架设掩体'));
  assert.ok(logs(next).includes('半掩体'));
});

test('重复架设同一格不会重复记录，新格子会追加', () => {
  const { battle, hero } = setup();
  const once = buildCover(battle, hero.id, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  assert.equal(once.cover.length, 2);
  const again = structuredClone(once);
  again.actors.find(actor => actor.id === hero.id).combat.actionUsed = false;
  const twice = buildCover(again, hero.id, [{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  assert.deepEqual(twice.cover.map(cell => `${cell.x},${cell.y}`).sort(), ['0,0', '1,0', '2,0']);
});

test('工事格让目标获得半掩体', () => {
  const { battle, hero } = setup();
  assert.equal(coverFromWalls(battle, { x: 0, y: 0 }, { x: 4, y: 0 }), '无');
  const next = buildCover(battle, hero.id, [{ x: 4, y: 0 }]);
  assert.equal(coverFromWalls(next, { x: 0, y: 0 }, { x: 4, y: 0 }), '半掩体');
});

test('自动掩体会把半掩体的 AC 加值算进攻击结果', () => {
  const { battle, hero, foe } = setup();
  const plain = attack(battle, { attackerId: hero.id, targetId: foe.id, range: 'ranged', autoCover: true, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍' }, { random: sequence(0.5) });
  assert.equal(plain.outcome.notes.some(note => note.includes('掩体')), false);
  const built = buildCover(battle, hero.id, [{ x: 4, y: 0 }]);
  const sheltered = structuredClone(built);
  sheltered.actors.find(actor => actor.id === hero.id).combat.actionUsed = false;
  const covered = attack(sheltered, { attackerId: hero.id, targetId: foe.id, range: 'ranged', autoCover: true, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍' }, { random: sequence(0.5) });
  assert.equal(covered.outcome.targetAc, plain.outcome.targetAc + 2);
});

test('拒绝非法架设：无方格、空选择、超量、越界、非整数', () => {
  const { battle, hero } = setup();
  assert.throws(() => buildCover({ ...battle, grid: undefined }, hero.id, [{ x: 0, y: 0 }]), /请先启用方格战场/);
  assert.throws(() => buildCover(battle, hero.id, []), /请选择要架设掩体的格子/);
  assert.throws(() => buildCover(battle, hero.id, [1, 2, 3, 4, 5].map(x => ({ x, y: 0 }))), /一次最多架设 4 格掩体/);
  assert.throws(() => buildCover(battle, hero.id, [{ x: 99, y: 0 }]), /掩体的格子超出战场范围/);
  assert.throws(() => buildCover(battle, hero.id, [{ x: 0.5, y: 0 }]), /掩体的格子坐标须为整数/);
});

test('非当前回合与已用动作都会被拒绝', () => {
  const { battle, hero, foe } = setup();
  assert.throws(() => buildCover(battle, foe.id, [{ x: 4, y: 0 }]), /只有当前回合的单位可以架设掩体/);
  const spent = structuredClone(battle);
  spent.actors.find(actor => actor.id === hero.id).combat.actionUsed = true;
  assert.throws(() => buildCover(spent, hero.id, [{ x: 0, y: 0 }]), /本回合已经使用过动作/);
});
