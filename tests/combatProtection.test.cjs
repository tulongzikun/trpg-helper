const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, attack, protectAlly, configureGrid, moveActorToCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup(protectorStyles = ['保护'], gap = 1) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '保护', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const hero = styles => ({
    ...base.actors[0], id: 'hero', name: '艾拉', side: '友方', currentHp: 40, maxHp: 40,
    template: { ...base.actors[0].template, armorClass: 16 },
    characterSnapshot: { sheet: { level: 5, characterClass: '战士', abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 10, cha: 10 }, details: { equipment: '长剑', fightingStyles: styles } } }
  });
  const ally = {
    ...base.actors[0], id: 'ally', name: '同伴', side: '友方', currentHp: 40, maxHp: 40,
    template: { ...base.actors[0].template, armorClass: 16 }
  };
  const enemy = {
    ...base.actors[0], id: 'enemy', name: '敌人', side: '敌方', currentHp: 200, maxHp: 200,
    template: { ...base.actors[0].template, armorClass: 12, hitPoints: { ...base.actors[0].template.hitPoints, average: 200 } }
  };
  let battle = startCombat({ ...base, actors: [hero(protectorStyles), ally, enemy] }, { hero: 20, ally: 15, enemy: 1 });
  battle = configureGrid(battle, { width: 10, height: 10, cellFt: 5 });
  battle = moveActorToCell(battle, 'hero', 1, 1);
  battle = moveActorToCell(battle, 'ally', 1 + gap, 1);
  battle = moveActorToCell(battle, 'enemy', 1 + gap + 1, 1);
  return battle;
}

test('保护消耗反应并写入 guarding 标记', () => {
  const battle = protectAlly(setup(), 'hero', 'ally');
  const state = battle.actors.find(item => item.id === 'hero').combat;
  assert.equal(state.reactionUsed, true);
  assert.equal(state.guarding, 'ally');
  assert.match(battle.combat.log.at(-1).text, /保护风格挡在/);
});

test('针对被保护同伴的攻击具有劣势并在结算后清除保护', () => {
  let battle = protectAlly(setup(), 'hero', 'ally');
  battle = endEnemyTurn(battle);
  const result = attack(battle, { attackerId: 'enemy', targetId: 'ally', attackBonus: 5, damageExpression: '1d6+3', damageType: '挥砍', range: 'melee' }, { random: sequence(0.9, 0.1, 0.5) });
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.match(result.battle.combat.log.at(-1).detail, /保护风格挡下攻击/);
  assert.equal(result.battle.actors.find(item => item.id === 'hero').combat.guarding, undefined);
});

test('没有保护风格时无法保护同伴', () => {
  assert.throws(() => protectAlly(setup([]), 'hero', 'ally'), /只有选择「保护」战斗风格的单位可以保护同伴。/);
});

test('不能保护自己，也不能保护 5 尺外的同伴', () => {
  assert.throws(() => protectAlly(setup(), 'hero', 'hero'), /不能保护自己。/);
  assert.throws(() => protectAlly(setup(['保护'], 3), 'hero', 'ally'), /保护的目标需要在 5 尺内。/);
});

test('同一回合只能使用一次反应保护', () => {
  const battle = protectAlly(setup(), 'hero', 'ally');
  assert.throws(() => protectAlly(battle, 'hero', 'ally'), /该单位本回合已经使用过反应。/);
});

function endEnemyTurn(battle) {
  const { endTurn } = require('../apps/web/src/combat.ts');
  let next = battle;
  for (let index = 0; index < 2; index += 1) next = endTurn(next);
  return next;
}
