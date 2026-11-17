const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, endTurn, startCombat, takeAim } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `aim-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-aim', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '游侠', level: 5,
    abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长弓：+7 命中，1d8+3 穿刺伤害，射程 150/600 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '瞄准', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  const started = startCombat(withHero, initiatives);
  const first = started.actors.find(actor => actor.side === '友方');
  const second = started.actors.find(actor => actor.side === '敌方');
  return { battle: started, first, second };
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;
const logs = battle => battle.combat.log.map(line => line.text).join('\n');
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

test('瞄准消耗附赠动作并写入状态与日志', () => {
  const { battle, first } = setup();
  const aimed = takeAim(battle, first.id);
  const state = stateOf(aimed, first.id);
  assert.equal(state.aimed, true);
  assert.equal(state.bonusUsed, true);
  assert.ok(logs(aimed).includes('瞄准'));
});

test('瞄准后远程攻击获得优势，且用掉即清除', () => {
  const { battle, first, second } = setup();
  const aimed = takeAim(battle, first.id);
  const shot = attack(aimed, { attackerId: first.id, targetId: second.id, attackBonus: 7, damageExpression: '1d8', damageType: '穿刺', range: 'ranged', ignoreDistanceCheck: true }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  assert.equal(shot.outcome.mode, 'advantage');
  assert.ok(shot.outcome.notes.includes('瞄准：远程攻击检定优势'));
  assert.equal(stateOf(shot.battle, first.id).aimed, undefined);
});

test('近战攻击不吃瞄准优势', () => {
  const { battle, first, second } = setup();
  const aimed = takeAim(battle, first.id);
  const stab = attack(aimed, { attackerId: first.id, targetId: second.id, attackBonus: 7, damageExpression: '1d8', damageType: '穿刺', ignoreDistanceCheck: true }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  assert.equal(stab.outcome.mode, 'normal');
  assert.equal(stateOf(stab.battle, first.id).aimed, true);
});

test('重复瞄准与附赠动作已用时被拒', () => {
  const { battle, first } = setup();
  const aimed = takeAim(battle, first.id);
  assert.throws(() => takeAim(aimed, first.id), /已经在瞄准/);
  const spent = structuredClone(battle);
  spent.actors.find(actor => actor.id === first.id).combat.bonusUsed = true;
  assert.throws(() => takeAim(spent, first.id), /附赠动作/);
});

test('下一回合开始时瞄准失效', () => {
  const { battle, first } = setup();
  const aimed = takeAim(battle, first.id);
  const toMonster = endTurn(aimed, { random: sequence(0.5) });
  assert.equal(stateOf(toMonster, first.id).aimed, true);
  const back = endTurn(toMonster, { random: sequence(0.5) });
  assert.equal(stateOf(back, first.id).aimed, undefined);
  assert.equal(stateOf(back, first.id).bonusUsed, false);
});

test('非当前回合单位无法瞄准', () => {
  const { battle, second } = setup();
  assert.throws(() => takeAim(battle, second.id), /只有当前回合的单位可以瞄准/);
});
