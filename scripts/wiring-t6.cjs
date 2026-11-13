const fs = require('fs');
function patch(file, oldText, newText) {
  const s = fs.readFileSync(file, 'utf8');
  const n = s.split(oldText).length - 1;
  if (n !== 1) { console.error('ANCHOR FAIL', file, n, JSON.stringify(oldText.slice(0, 80))); process.exit(1); }
  fs.writeFileSync(file, s.split(oldText).join(newText));
  console.log('patched', file);
}

patch('apps/web/src/characters.ts',
  `import { fighterFeatureState } from './fighterFeatures.ts';`,
  `import { fighterFeatureState } from './fighterFeatures.ts';
import { metamagicLimit, arcaneWardMax } from './wizardSorcererFeatures.ts';`);

patch('apps/web/src/characters.ts',
  `advancements?:Record<string,[Ability|'',Ability|'']>;elementalFury?:`,
  `advancements?:Record<string,[Ability|'',Ability|'']>;metamagic?:string[];innateSorceryActive?:boolean;innateSorceryUses?:number;draconicAffinity?:'强酸'|'寒冷'|'火焰'|'闪电'|'毒素'|'';fleshRevelation?:{active:boolean;points:number;effects:string[]};wildSurgeEffect?:string;arcaneWardHp?:number;portent?:{values:number[];used:boolean[]};elementalFury?:`);

patch('apps/web/src/characters.ts',
  `const method=`,
  `if(config?.metamagic&&(!Array.isArray(config.metamagic)||config.metamagic.length>metamagicLimit(d.level)||new Set(config.metamagic.filter(Boolean)).size!==config.metamagic.filter(Boolean).length))return '超魔法数量或重复选择无效。';if(config?.innateSorceryUses!==undefined&&(!Number.isInteger(config.innateSorceryUses)||config.innateSorceryUses<0||config.innateSorceryUses>2))return '先天术法使用次数无效。';if(config?.portent){const expected=d.level>=14?3:2;if(!Array.isArray(config.portent.values)||config.portent.values.length!==expected||config.portent.values.some(v=>!Number.isInteger(v)||v<1||v>20)||!Array.isArray(config.portent.used)||config.portent.used.length!==expected)return '预兆骰记录无效。';}if(config?.arcaneWardHp!==undefined&&(!Number.isInteger(config.arcaneWardHp)||config.arcaneWardHp<0||config.arcaneWardHp>arcaneWardMax(d)))return '奥术守御生命值超过上限。';const method=`);

patch('apps/web/src/characterRest.ts',
  `const restDetails=next.details,rc=restDetails?.fighterCalculator;`,
  `const restDetails2=next.details,rc2=restDetails2?.fighterCalculator;if(restDetails2&&rc2&&(rc2.innateSorceryUses||rc2.fleshRevelation||rc2.portent||rc2.wildSurgeEffect))next={...next,details:{...restDetails2,fighterCalculator:{...rc2,innateSorceryActive:false,innateSorceryUses:0,fleshRevelation:undefined,wildSurgeEffect:'',portent:undefined}}};const restDetails=next.details,rc=restDetails?.fighterCalculator;`);
