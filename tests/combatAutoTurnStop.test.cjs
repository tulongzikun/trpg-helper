const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat } = require('../apps/web/src/combat.ts');
const { autoTurn } = require('../apps/web/src/combatAuto.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot() {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '艾拉', species: '人类', characterClass: '游侠', level: 5,
      abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 8 },
      maxHp: 40, armorClass: 15, speedFt: 30,
      actions: '短弓：+7 命中，1d8+3 穿刺伤害，射程 80/320 尺', notes: '',
      details: { equipment: '短弓' },
    },
  };
}

function setup() {
  const base = addMonsters(emptyStore(), card, { newBattleName: '回合停止', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [foe.id]: 10 });
  return { battle: started, hero, foe };
}

test('自动回合说明为什么停下', () => {
  const { battle, hero } = setup();
  const result = autoTurn(battle, hero.id, { random: sequence(0.9, 0.5, 0.5, 0.5) });
  assert.ok(result.stopped, '应当给出停止原因');
  assert.ok(['finished', 'done', 'handoff', 'limit'].includes(result.stopped.reason));
  assert.ok(result.stopped.text.length > 0);
});

test('动作已经用完时报 done', () => {
  const { battle, hero } = setup();
  const spent = {
    ...battle,
    actors: battle.actors.map(actor => (actor.id === hero.id
      ? { ...actor, combat: { ...actor.combat, actionUsed: true } }
      : actor)),
  };
  const result = autoTurn(spent, hero.id, { random: sequence(0.5) });
  assert.equal(result.stopped.reason, 'done');
  assert.match(result.stopped.text, /动作已经用完/);
});

test('战斗结束后说明已结束', () => {
  const { battle, hero, foe } = setup();
  const wiped = {
    ...battle,
    actors: battle.actors.map(actor => (actor.id === foe.id
      ? { ...actor, combat: { ...actor.combat, status: 'dead', currentHp: 0 } }
      : actor)),
  };
  const result = autoTurn(wiped, hero.id, { random: sequence(0.5) });
  assert.equal(result.stopped.reason, 'finished');
});
