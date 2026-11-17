const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, castAid, aidTargets, damageActor, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `aid-${++counter}`;

const cleric = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-aid', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '米拉', species: '人类', characterClass: '牧师', level: 5,
    abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 16, cha: 12 },
    maxHp: 32, armorClass: 16, speedFt: 30, actions: '锤矛：+5 命中，1d6+2 钝击伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '援助', side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, cleric, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 10, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = 20 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const first = next.actors[0];
  first.position = { x: 0, y: 0 };
  next.actors.forEach((actor, index) => { if (index > 0) actor.position = { x: index, y: 0 }; });
  return { battle: next, caster: first, ally: next.actors[1] };
}

test('援助术提高目标的生命上限与当前生命', () => {
  const { battle, caster, ally } = setup();
  const joined = structuredClone(battle);
  joined.combat.order.unshift(ally.id);
  joined.combat.order = [...new Set(joined.combat.order)];
  joined.combat.current = ally.id;
  joined.combat.turnIndex = joined.combat.order.indexOf(ally.id);
  const before = { max: ally.maxHp, hp: ally.currentHp };
  const next = castAid(joined, ally.id, [ally.id]);
  const after = next.actors.find(item => item.id === ally.id);
  assert.equal(after.maxHp, before.max + 5);
  assert.equal(after.currentHp, before.hp + 5);
  assert.equal(after.combat.aided, 5);
});

test('一次最多援助三名单位', () => {
  const { battle, ally } = setup();
  assert.throws(() => castAid(battle, ally.id, [ally.id, 'x1', 'x2', 'x3']), /最多影响 3 名单位/);
});

test('重复援助同一目标会被拒绝', () => {
  const { battle, caster, ally } = setup();
  const once = castAid(battle, caster.id, [caster.id, ally.id]);
  const again = structuredClone(once);
  const other = again.actors.find(item => item.id === ally.id);
  other.combat.actionUsed = false;
  again.combat.current = other.id;
  again.combat.turnIndex = again.combat.order.indexOf(other.id);
  assert.throws(() => castAid(again, other.id, [caster.id]), /已经受到援助术的影响/);
});

test('长休移除额外生命上限', () => {
  const { battle, caster, ally } = setup();
  const buffed = castAid(battle, caster.id, [caster.id, ally.id]);
  const target = buffed.actors.find(item => item.id === ally.id);
  const expected = target.maxHp;
  const rested = takeLongRest(buffed);
  const after = rested.actors.find(item => item.id === ally.id);
  assert.equal(after.maxHp, expected - 5);
  assert.equal(after.combat.aided, undefined);
  assert.equal(after.currentHp, after.maxHp);
});

test('援助的额外生命会先被伤害消耗', () => {
  const { battle, caster, ally } = setup();
  const buffed = castAid(battle, caster.id, [ally.id]);
  const target = buffed.actors.find(item => item.id === ally.id);
  const hurt = damageActor(buffed, ally.id, 8, '挥砍').battle;
  const after = hurt.actors.find(item => item.id === ally.id);
  assert.equal(after.currentHp, target.currentHp - 8);
  assert.ok(after.currentHp > 0);
});

test('目标列表只含 30 尺内的同阵营单位', () => {
  const { battle, caster, ally } = setup();
  const targets = aidTargets(battle, caster.id);
  const idsList = targets.map(item => item.id);
  assert.ok(idsList.includes(caster.id));
  assert.ok(idsList.includes(ally.id));
  const far = structuredClone(battle);
  far.actors.find(item => item.id === ally.id).position = { x: 9, y: 7 };
  assert.ok(!aidTargets(far, caster.id).some(item => item.id === ally.id));
});
