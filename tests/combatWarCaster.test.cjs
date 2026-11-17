const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, setWarCaster, startConcentration, damageActor, currentActorId } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const battle = addMonsters(emptyStore(), card, { newBattleName: '战地施法者', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const hero = { ...battle.actors[0], id: 'hero', name: '艾拉', side: '友方', currentHp: 40, maxHp: 40 };
  const withHero = { ...battle, actors: [hero, ...battle.actors] };
  const initiatives = Object.fromEntries(withHero.actors.map((item, index) => [item.id, item.id === 'hero' ? 20 : 1]));
  const started = startCombat(withHero, initiatives);
  return startConcentration(started, 'hero', '护盾术');
}

test('开启战地施法者会写入标记与日志', () => {
  const battle = setup();
  const after = setWarCaster(battle, 'hero', true);
  assert.equal(after.actors.find(item => item.id === 'hero').combat.warCaster, true);
  assert.match(after.combat.log.at(-1).text, /使用战地施法者：专注检定具有优势。/);
});

test('关闭后标记被移除', () => {
  const battle = setWarCaster(setup(), 'hero', true);
  const after = setWarCaster(battle, 'hero', false);
  assert.equal(after.actors.find(item => item.id === 'hero').combat.warCaster, undefined);
  assert.match(after.combat.log.at(-1).text, /不再享受战地施法者的专注优势。/);
});

test('开启后专注检定取两颗 d20 的较高值并标注优势', () => {
  const battle = setWarCaster(setup(), 'hero', true);
  const after = damageActor(battle, 'hero', 10, '钝击', { random: sequence(0.0, 0.9) }).battle;
  assert.ok(after.combat.log.some(item => /战地施法者：优势/.test(item.detail ?? '')), JSON.stringify(after.combat.log.slice(-3)));
  assert.ok(after.actors.find(item => item.id === 'hero').combat.concentration, '应维持专注');
});

test('未开启时专注检定只掷一颗 d20', () => {
  const battle = setup();
  const after = damageActor(battle, 'hero', 10, '钝击', { random: sequence(0.0) }).battle;
  assert.ok(!after.combat.log.some(item => /战地施法者/.test(item.detail ?? '')));
  assert.equal(after.actors.find(item => item.id === 'hero').combat.concentration, undefined);
});

test('战地施法者不会影响没有专注的单位', () => {
  const battle = setWarCaster(setup(), 'hero', true);
  const ended = { ...battle, actors: battle.actors.map(item => item.id === 'hero' ? { ...item, combat: { ...item.combat, concentration: undefined } } : item) };
  const after = damageActor(ended, 'hero', 10, '钝击', { random: sequence(0.5) }).battle;
  assert.equal(after.combat.log.at(-1).detail ? /战地施法者/.test(after.combat.log.at(-1).detail) : false, false);
});
