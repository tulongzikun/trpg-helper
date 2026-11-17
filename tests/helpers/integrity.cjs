// 战斗档案的引用完整性检查：任何指向「已不在场的单位」的字段都算破口。
// 这类断言能一次性抓住「擒抱者死了、坐骑走了、灵光持有者撤离」之类悬挂引用。
const BY_FIELDS = [
  'grappledBy', 'riderId', 'mountedOn', 'sleepingBy', 'blessedBy', 'hastedBy', 'invisibleBy',
  'slowedBy', 'charmedBy', 'frightenedBy', 'paralyzedBy', 'blindedBy', 'deafenedBy',
  'barkskinBy', 'polymorphedBy', 'vexTargetId', 'grappledBy',
];

function danglingFields(battle) {
  const ids = new Set(battle.actors.map(actor => actor.id));
  const problems = [];
  for (const actor of battle.actors) {
    const state = actor.combat;
    if (!state) continue;
    for (const field of BY_FIELDS) {
      const value = state[field];
      if (value === undefined) continue;
      if (typeof value !== 'string') continue;
      if (!ids.has(value)) problems.push(`${actor.name}.${field} → ${value}`);
    }
  }
  return problems;
}

function danglingAuras(battle) {
  const ids = new Set(battle.actors.map(actor => actor.id));
  return (battle.auras ?? []).filter(aura => !ids.has(aura.ownerId)).map(aura => aura.name);
}

function danglingOrder(battle) {
  if (!battle.combat) return [];
  const ids = new Set(battle.actors.map(actor => actor.id));
  return battle.combat.order.filter(id => !ids.has(id));
}

function currentMissing(battle) {
  if (!battle.combat) return false;
  const current = battle.combat.order[battle.combat.turnIndex];
  if (!current) return true;
  return !battle.actors.some(actor => actor.id === current);
}

module.exports = { BY_FIELDS, danglingFields, danglingAuras, danglingOrder, currentMissing };
