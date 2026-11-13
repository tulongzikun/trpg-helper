const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newDraft } = require('../apps/web/src/characters.ts');
const rules = require('../apps/web/src/clericRogueRules.ts');
const actions = require('../apps/web/src/clericRogue.ts');
const { classResources, changeClassResource } = require('../apps/web/src/classResources.ts');

function draft(cls, level, subclass = '', extra = {}) {
 const d = newDraft();
 d.level = level;
 d.abilities = { str: 10, dex: 16, con: 12, int: 10, wis: 16, cha: 10 };
 d.details.fighterCalculator = { species: '人类', elfLineage: '', armor: 'none', shield: false, characterClass: cls, subclass, ...extra };
 return d;
}
const resource = (d, id) => classResources(d).find(x => x.id === id);

test('sneak attack dice and cunning strike table by level', () => {
 assert.equal(rules.sneakAttackDice(1), 1);
 assert.equal(rules.sneakAttackDice(5), 3);
 assert.equal(rules.sneakAttackDice(11), 6);
 assert.equal(rules.sneakAttackDice(20), 10);
 assert.equal(rules.cunningStrikeOptions(4).length, 0);
 assert.deepEqual(rules.cunningStrikeOptions(5).map(x => x.name), ['淬毒', '摔绊', '撤步']);
 assert.deepEqual(rules.cunningStrikeOptions(14).map(x => x.name), ['淬毒', '摔绊', '撤步', '恍惚', '击昏', '眩目']);
 assert.deepEqual(rules.cunningStrikeOptions(14, true).map(x => x.name), ['淬毒', '摔绊', '撤步', '恍惚', '击昏', '眩目', '无声袭击']);
 assert.equal(rules.cunningStrikeOptions(11, true).at(-1).name, '无声袭击');
 assert.equal(rules.cunningStrikeOptions(8, true).some(x => x.name === '无声袭击'), false);
 const rogue = rules.rogueState(draft('游荡者', 14, 'thief'));
 assert.equal(rogue.cunningStrikeDC, 8 + 5 + 3);
 assert.equal(rogue.sneakDice, 7);
 assert.equal(rogue.advanced, true);
 assert.equal(rogue.deadly, true);
 assert.equal(rogue.reliable, true);
 assert.equal(rogue.slipperyMind, false);
 assert.equal(rogue.options.at(-1).name, '无声袭击');
});

test('cleric divine order, channel divinity and blessed strike numbers', () => {
 const cleric = draft('牧师', 14, 'life', { classOrder: 'thaumaturge', clericBlessedStrike: 'divine' });
 assert.equal(rules.divineOrderState(cleric).bonus, 3);
 const channel = rules.channelDivinityState(cleric);
 assert.equal(channel.sparkDice, 3);
 assert.equal(channel.sparkHeal, '3d8+3');
 assert.equal(channel.searDice, 3);
 assert.equal(channel.saveDC, 8 + 5 + 3);
 const strike = rules.blessedStrikeState(cleric);
 assert.equal(strike.improved, true);
 assert.equal(strike.divineDice, 2);
 assert.equal(strike.tempHp, 6);
 assert.equal(rules.blessedStrikeState(draft('牧师', 6)), null);
 assert.equal(rules.channelDivinityState(draft('牧师', 1)), null);
});

test('life domain healing bonuses and preserve pool', () => {
 const life = draft('牧师', 17, 'life');
 assert.deepEqual(rules.lifeHealingBonus(life, 3, 'other'), { disciple: 5, healer: 5, maximized: true });
 assert.deepEqual(rules.lifeHealingBonus(draft('牧师', 5, 'life'), 3, 'self'), { disciple: 5, healer: 0, maximized: false });
 assert.equal(rules.lifeHealingBonus(life, 0, 'other'), null);
 assert.equal(rules.lifeHealingBonus(draft('牧师', 17, 'light'), 3, 'other'), null);
 assert.equal(rules.lifePreserveHealing(life), 85);
 assert.equal(rules.lifePreserveHealing(draft('牧师', 2, 'life')), 0);
});

test('light, trickery and war domain state by level', () => {
 const light = draft('牧师', 17, 'light');
 const l = rules.lightDomainState(light);
 assert.equal(l.wardingUses, 3);
 assert.equal(l.improved, true);
 assert.equal(l.wardingTempHp, '2d6+3');
 assert.equal(l.radianceDamage, '2d10+17');
 assert.equal(l.corona, true);
 assert.equal(rules.lightDomainState(draft('牧师', 5, 'light')).improved, false);
 assert.deepEqual(rules.trickeryDomainState(draft('牧师', 6, 'trickery')), { blessing: true, duplicity: true, swap: true, improved: false });
 const war = rules.warDomainState(draft('牧师', 17, 'war'));
 assert.equal(war.warPriestUses, 3);
 assert.equal(war.guidedStrikeBonus, 10);
 assert.equal(war.godBlessing, true);
 assert.equal(war.avatar, true);
});

test('soulknife psi dice, feature gates and arcane/assassin/thief state', () => {
 assert.deepEqual(rules.psiDiceFor(3), { count: 4, die: 6 });
 assert.deepEqual(rules.psiDiceFor(9), { count: 8, die: 8 });
 assert.deepEqual(rules.psiDiceFor(11), { count: 8, die: 10 });
 assert.deepEqual(rules.psiDiceFor(17), { count: 12, die: 12 });
 const soul = rules.soulknifeState(draft('游荡者', 17, 'soulknife'));
 assert.equal(soul.count, 12);
 assert.equal(soul.die, 12);
 assert.equal(soul.soulBlades, true);
 assert.equal(soul.veil, true);
 assert.equal(soul.rendMind, true);
 assert.equal(soul.veilCost, 1);
 assert.equal(soul.rendCost, 3);
 assert.equal(rules.soulknifeState(draft('游荡者', 9, 'soulknife')).veil, false);
 assert.equal(rules.arcaneTricksterState(draft('游荡者', 9, 'arcane-trickster')).cantripLimit, 2);
 assert.equal(rules.arcaneTricksterState(draft('游荡者', 10, 'arcane-trickster')).cantripLimit, 3);
 assert.equal(rules.arcaneTricksterState(draft('游荡者', 17, 'arcane-trickster')).spellThief, true);
 assert.equal(rules.assassinState(draft('游荡者', 9, 'assassin')).infiltration, true);
 assert.equal(rules.assassinState(draft('游荡者', 17, 'assassin')).deathStrike, true);
 assert.equal(rules.thiefState(draft('游荡者', 13, 'thief')).useMagicDevice, true);
 assert.equal(rules.thiefState(draft('游荡者', 17, 'thief')).reflexes, true);
});

test('resources reflect subclass gates and rest recovery', () => {
 assert.equal(resource(draft('牧师', 3, 'light'), 'cleric-light-warding').maximum, 3);
 assert.equal(resource(draft('牧师', 5, 'light'), 'cleric-light-warding').shortRest, false);
 assert.equal(resource(draft('牧师', 6, 'light'), 'cleric-light-warding').shortRest, true);
 assert.equal(resource(draft('牧师', 17, 'light'), 'cleric-light-corona').maximum, 3);
 assert.equal(resource(draft('牧师', 3, 'war'), 'cleric-war-priest').shortRest, true);
 const soul = draft('游荡者', 9, 'soulknife');
 assert.equal(resource(soul, 'soulknife-psi').maximum, 8);
 assert.equal(resource(soul, 'soulknife-psi').shortRest, 'one');
 assert.equal(resource(soul, 'soulknife-veil'), undefined);
 assert.equal(resource(draft('游荡者', 17, 'soulknife'), 'soulknife-rend-mind').maximum, 1);
 assert.equal(resource(draft('游荡者', 17, 'arcane-trickster'), 'rogue-spell-thief').maximum, 1);
 assert.equal(resource(draft('游荡者', 20, 'thief'), 'rogue-lucky-strike').shortRest, true);
 assert.equal(resource(draft('游荡者', 19, 'thief'), 'rogue-lucky-strike'), undefined);
});

test('cleric channel actions spend and stop at the resource limit', () => {
 let d = draft('牧师', 3, 'life');
 assert.equal(resource(d, 'cleric-channel').remaining, 2);
 d = actions.useLifePreserve(d);
 assert.equal(resource(d, 'cleric-channel').remaining, 1);
 d = actions.useRadianceOfDawn(d);
 assert.equal(resource(d, 'cleric-channel').remaining, 0);
 assert.equal(actions.useGuidedStrike(d), d);
 const rogue = draft('游荡者', 3);
 assert.equal(actions.useClericChannel(rogue), rogue);
});

test('config writes persist blessed strike, divine order and weapon mastery', () => {
 let d = draft('牧师', 7, 'life');
 d = actions.setBlessedStrike(d, 'potent');
 assert.equal(rules.clericRogueConfig(d).clericBlessedStrike, 'potent');
 assert.equal(rules.blessedStrikeState(d).choice, 'potent');
 d = actions.setDivineOrder(d, 'protector');
 assert.equal(d.details.fighterCalculator.classOrder, 'protector');
 d = actions.setBlessedStrike(d, 'bogus');
 assert.equal(rules.blessedStrikeState(d).choice, '');
 let r = draft('游荡者', 3, 'thief');
 r = actions.setRogueWeaponMastery(r, 0, '短剑');
 r = actions.setRogueWeaponMastery(r, 1, '匕首');
 assert.deepEqual(rules.clericRogueConfig(r).weaponMasteryChoices, ['短剑', '匕首']);
 assert.deepEqual(rules.rogueState(r).weaponMasteryChoices, ['短剑', '匕首']);
 assert.equal(actions.setRogueWeaponMastery(r, 4, '长剑'), r);
});

test('soulknife psi spending and feature reset costs', () => {
 let d = draft('游荡者', 17, 'soulknife');
 assert.equal(resource(d, 'soulknife-psi').remaining, 12);
 d = actions.spendSoulknifePsi(d, 2);
 assert.equal(resource(d, 'soulknife-psi').remaining, 10);
 d = changeClassResource(d, 'soulknife-veil', 1);
 const reset = actions.resetSoulknifeFeature(d, 'veil');
 assert.equal(resource(reset, 'soulknife-veil').remaining, 1);
 assert.equal(resource(reset, 'soulknife-psi').remaining, 9);
 assert.equal(actions.resetSoulknifeFeature(reset, 'veil'), reset);
 d = changeClassResource(actions.spendSoulknifePsi(d, 1), 'soulknife-rend-mind', 1);
 const rend = actions.resetSoulknifeFeature(d, 'rend-mind');
 assert.equal(resource(rend, 'soulknife-rend-mind').remaining, 1);
 assert.equal(resource(rend, 'soulknife-psi').remaining, 6);
 const poor = changeClassResource(actions.spendSoulknifePsi(draft('游荡者', 17, 'soulknife'), 10), 'soulknife-rend-mind', 1);
 assert.equal(actions.resetSoulknifeFeature(poor, 'rend-mind'), poor);
});
