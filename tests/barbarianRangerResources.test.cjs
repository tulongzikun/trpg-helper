const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newDraft } = require('../apps/web/src/characters.ts');
const { barbarianRangerResourceDefs } = require('../apps/web/src/groups/resources/barbarianRanger.ts');

function build(level, characterClass, subclass, patch = {}) {
  const d = newDraft();
  d.level = level;
  d.abilities = { str: 18, dex: 14, con: 16, int: 10, wis: 16, cha: 8 };
  d.details.fighterCalculator = {
    species: '人类', elfLineage: '', armor: 'none', shield: false,
    characterClass, subclass, classSkills: [], ...patch,
  };
  return d;
}

const defsOf = (draft) => barbarianRangerResourceDefs(draft);
const ids = (draft) => defsOf(draft).map((x) => x.id);
const get = (draft, id) => defsOf(draft).find((x) => x.id === id);

test('野蛮人获得狂暴资源，短休恢复一次、长休回满', () => {
  const rage = get(build(15, '野蛮人', 'berserker'), 'barbarian-rage');
  assert.ok(rage);
  assert.equal(rage.maximum, 5);
  assert.equal(rage.shortRest, 'one');
  assert.match(rage.note, /狂暴伤害 \+3/);
});

test('15 级野蛮人获得持久狂暴重置标记', () => {
  assert.ok(ids(build(15, '野蛮人', 'zealot')).includes('barbarian-persistent-rage'));
  assert.ok(!ids(build(14, '野蛮人', 'zealot')).includes('barbarian-persistent-rage'));
});

test('狂战士与狂热者资源按子职等级出现', () => {
  assert.ok(ids(build(14, '野蛮人', 'berserker')).includes('berserker-intimidating-presence'));
  assert.ok(!ids(build(14, '野蛮人', 'zealot')).includes('berserker-intimidating-presence'));

  assert.equal(get(build(3, '野蛮人', 'zealot'), 'zealot-healing-pool').maximum, 4);
  assert.ok(!ids(build(3, '野蛮人', 'zealot')).includes('zealot-zealous-presence'));
  assert.ok(ids(build(10, '野蛮人', 'zealot')).includes('zealot-zealous-presence'));
  assert.ok(ids(build(14, '野蛮人', 'zealot')).includes('zealot-rage-of-gods'));
});

test('游侠资源：自然面纱、妖精与幽域追猎者的免费施法', () => {
  const level14 = build(14, '游侠', 'hunter');
  assert.equal(get(level14, 'ranger-natures-veil').maximum, 3);

  const fey = build(15, '游侠', 'fey-wanderer');
  assert.equal(get(fey, 'fey-misty-wanderer').maximum, 3);
  assert.equal(get(fey, 'fey-reinforcements').maximum, 1);

  const gloom = build(3, '游侠', 'gloom-stalker');
  assert.equal(get(gloom, 'gloom-dread-ambusher').maximum, 3);
  assert.match(get(gloom, 'gloom-dread-ambusher').note, /2d6/);
});

test('非野蛮人/游侠不产生本组资源', () => {
  assert.deepEqual(defsOf(build(6, '战士', '')), []);
  assert.deepEqual(defsOf(build(6, '牧师', '')), []);
});
