const fs = require('fs');
function patch(file, oldText, newText) {
  const s = fs.readFileSync(file, 'utf8');
  const n = s.split(oldText).length - 1;
  if (n !== 1) { console.error('ANCHOR FAIL', file, n, JSON.stringify(oldText.slice(0, 80))); process.exit(1); }
  fs.writeFileSync(file, s.split(oldText).join(newText));
  console.log('patched', file);
}

patch('apps/web/src/characters.ts',
  `import { wildShapeState, type KnownWildShape } from './wildShapeForms.ts';`,
  `import { monkBardError } from './monkBardFeatures.ts';
import { paladinMasteryProperties, paladinFightingStyles } from './paladinFeatures.ts';
import { fighterFeatureState } from './fighterFeatures.ts';
import { warlockFeatureState } from './warlockFeatures.ts';
import { weaponMasteryError } from './barbarianFeatures.ts';
import { rangerWeaponMasteryError, fightingStyleError } from './rangerFeatures.ts';
import { wildShapeState, type KnownWildShape } from './wildShapeForms.ts';`);

patch('apps/web/src/characters.ts',
  `advancements?:Record<string,[Ability|'',Ability|'']>}; rolls?:`,
  `advancements?:Record<string,[Ability|'',Ability|'']>;elementalFury?:'potent'|'primal'|'';wildShapeActive?:string;wildCompanionActive?:boolean;natureMagicianUsed?:boolean;seaWrathActive?:boolean;oathCapstoneActive?:boolean;weaponMasteries?:{weapon:string;property:string}[];weaponMastery?:string[];weaponMasteryChoices?:string[];fightingStyle?:string;fightingStyles?:string[];maneuvers?:string[];martialTool?:string;martialSkill?:string;weaponBond?:string[];hexAbility?:string;fiendResistance?:string;druidicCantrips?:string[];hunterPrey?:string;hunterDefense?:string;beastCompanion?:string;feyGift?:number;clericBlessedStrike?:'divine'|'potent'|'';epicBoon?:string;monkBard?:{elementalAttunement?:boolean;elementalResistance?:'强酸'|'寒冷'|'火焰'|'闪电'|'雷鸣'|''}}; rolls?:`);

patch('apps/web/src/characters.ts',
  `return '请选择该职业规定数量的职业技能。';}const method=`,
  `return '请选择该职业规定数量的职业技能。';}if(config?.epicBoon&&d.level<19)return '传奇恩惠需 19 级才能选择。';if(config?.clericBlessedStrike&&!['divine','potent'].includes(config.clericBlessedStrike))return '受祝击选择无效。';const weaponMasteryMessage=weaponMasteryError(d)??rangerWeaponMasteryError(d)??fightingStyleError(d);if(weaponMasteryMessage)return weaponMasteryMessage;const fighterState=fighterFeatureState(d);if(fighterState.errors.length)return fighterState.errors[0];const warlockState=warlockFeatureState(d);if(warlockState.errors.length)return warlockState.errors[0];const monkBardMessage=monkBardError(d);if(monkBardMessage)return monkBardMessage;if(config?.characterClass==='圣武士'&&config.fightingStyle&&!paladinFightingStyles.includes(config.fightingStyle))return '战斗风格选择无效。';if(config?.characterClass==='圣武士'&&config.weaponMasteries&&(!Array.isArray(config.weaponMasteries)||config.weaponMasteries.length>2||new Set(config.weaponMasteries.map(m=>m.weapon)).size!==config.weaponMasteries.length||config.weaponMasteries.some(m=>!m.weapon||!paladinMasteryProperties.includes(m.property))))return '武器精通选择无效。';const method=`);

patch('apps/web/src/characterRest.ts',
  `if(rest==='long'){next=restoreSpeciesResources(next);const details=next.details,c=details?.fighterCalculator;if(details&&c?.species==='人类')next={...next,details:{...details,fighterCalculator:{...c,heroicInspiration:true}}};}`,
  `if(rest==='long'){next=restoreSpeciesResources(next);const details=next.details,c=details?.fighterCalculator;if(details&&c?.species==='人类')next={...next,details:{...details,fighterCalculator:{...c,heroicInspiration:true}}};const restDetails=next.details,rc=restDetails?.fighterCalculator;if(restDetails&&rc&&(rc.wildShapeActive||rc.wildCompanionActive||rc.seaWrathActive||rc.natureMagicianUsed||rc.oathCapstoneActive))next={...next,details:{...restDetails,fighterCalculator:{...rc,wildShapeActive:undefined,wildCompanionActive:false,seaWrathActive:false,natureMagicianUsed:false,oathCapstoneActive:false}}};}`);

patch('apps/web/src/fighterRules.ts',
  `if(armor==='none'&&characterClass==='术士'&&config.subclass==='draconic'&&draft.level>=3)armorClass=10+mod(draft.abilities.dex)+mod(draft.abilities.cha);`,
  `if(armor==='none'&&characterClass==='术士'&&config.subclass==='draconic'&&draft.level>=3)armorClass=10+mod(draft.abilities.dex)+mod(draft.abilities.cha);
 if(armor==='none'&&!config.shield&&characterClass==='吟游诗人'&&config.subclass==='dance'&&draft.level>=3)armorClass=10+mod(draft.abilities.dex)+mod(draft.abilities.cha);`);
