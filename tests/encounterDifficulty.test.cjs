const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { encounterDifficulty, difficultyText, encounterBudget, threatXp, partyLevels, levelBudget } = require('../apps/web/src/encounterDifficulty.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `difficulty-${++counter}`;

const hero = level => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: `char-diff-${level}`, revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: `英雄${level}`, species: '人类', characterClass: '战士', level,
    abilities: { str: 12, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 40, armorClass: 15, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，近战 5 尺', notes: '', details: {},
  },
});

function setup({ level = 4, foes = 1, cr } = {}) {
  let store = addMonsters(emptyStore(), card, { newBattleName: '难度', side: '敌方', count: foes }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero(level), { battleId, side: '友方' }, ids()).store;
  const battle = structuredClone(store.battles[0]);
  if (cr !== undefined) {
    for (const actor of battle.actors) if (actor.side === '敌方') actor.template = { ...actor.template, challengeRating: cr };
  }
  return battle;
}

/** 把某个单位写成已死亡。 */
function kill(battle, side) {
  const next = structuredClone(battle);
  const target = next.actors.find(actor => actor.side === side);
  target.combat = { ...(target.combat ?? {}), status: 'dead', conditions: [] };
  return next;
}

test('单只低挑战等级敌人对四级队伍属于「低」', () => {
  const battle = setup({ level: 4, foes: 1, cr: '1/8' });
  const result = encounterDifficulty(battle);
  assert.equal(result.xp, 25);
  assert.deepEqual(result.budget, { low: 250, moderate: 375, high: 500 });
  assert.equal(result.label, '低');
  assert.equal(result.ratio, 0.05);
});

test('敌人经验总和跨过预算档位后难度递进', () => {
  const low = encounterDifficulty(setup({ level: 4, foes: 1, cr: 1 }));
  assert.equal(low.xp, 200);
  assert.equal(low.label, '低');
  const moderate = encounterDifficulty(setup({ level: 5, foes: 1, cr: 3 }));
  assert.equal(moderate.xp, 700);
  assert.equal(moderate.budget.high, 1100);
  assert.equal(moderate.label, '中');
  const high = encounterDifficulty(setup({ level: 4, foes: 1, cr: 2 }));
  assert.equal(high.xp, 450);
  assert.equal(high.label, '高');
  const deadly = encounterDifficulty(setup({ level: 4, foes: 1, cr: 3 }));
  assert.equal(deadly.xp, 700);
  assert.equal(deadly.label, '致命');
});

test('队伍人数越多预算越高', () => {
  const one = setup({ level: 4, foes: 1, cr: 3 });
  const two = structuredClone(one);
  const ally = structuredClone(two.actors.find(actor => actor.side === '友方'));
  ally.id = 'ally-2';
  ally.name = '第二位英雄';
  ally.characterSnapshot = { ...ally.characterSnapshot, sheet: { ...ally.characterSnapshot.sheet, level: 4 } };
  two.actors.push(ally);
  assert.deepEqual(partyLevels(one), [4]);
  assert.deepEqual(encounterBudget(two), { low: 500, moderate: 750, high: 1000 });
  assert.equal(encounterDifficulty(one).label, '致命');
  assert.equal(encounterDifficulty(two).label, '中');
});

test('已死亡的敌人不再计入威胁经验', () => {
  const battle = setup({ level: 4, foes: 1, cr: 5 });
  assert.equal(threatXp(battle), 1800);
  assert.equal(threatXp(kill(battle, '敌方')), 0);
  assert.equal(encounterDifficulty(kill(battle, '敌方')).label, '低');
});

test('缺少等级的角色按一级计算，预算表越界会夹到 1–20', () => {
  const battle = setup({ level: 4, foes: 1, cr: '1/4' });
  const next = structuredClone(battle);
  delete next.actors.find(actor => actor.side === '友方').characterSnapshot;
  assert.deepEqual(partyLevels(next), [1]);
  assert.deepEqual(encounterBudget(next), { low: 50, moderate: 75, high: 100 });
  assert.deepEqual(levelBudget(0), { low: 50, moderate: 75, high: 100 });
  assert.deepEqual(levelBudget(99), { low: 6000, moderate: 8200, high: 16000 });
});

test('难度文案给出档次与经验对照，没有队伍成员时提示无法评估', () => {
  const battle = setup({ level: 5, foes: 1, cr: 3 });
  assert.equal(difficultyText(battle), '遭遇难度：中（700 / 高 1100 经验）');
  const empty = structuredClone(battle);
  empty.actors = empty.actors.filter(actor => actor.side !== '友方');
  assert.equal(difficultyText(empty), '遭遇难度：暂无队伍成员，无法评估。');
});
