import type { CharacterDraft } from './characters';

// Exploration invocations from the 2024 rules. Other invocation slots remain available.
export const explorationInvocations=[
 {id:'pact-chain',name:'锁链契约',level:1,note:'习得寻获魔宠，可用魔法动作不消耗法术位施放；可选择规则允许的特殊魔宠形态。'},
 {id:'armor-shadows',name:'暗影护甲',level:1,note:'可不消耗法术位对自己施展法师护甲；护甲效果持续期间的 AC 需按法术规则处理。'},
 {id:'eldritch-mind',name:'魔能心智',level:1,note:'维持专注的体质豁免具有优势。'},
 {id:'devils-sight',name:'魔鬼视觉',level:2,note:'120 尺内可在普通及魔法黑暗中正常视物。'},
 {id:'ascendant-step',name:'升腾之步',level:5,note:'可不消耗法术位对自己施展浮空术。'},
 {id:'gift-depths',name:'深海赐礼',level:5,note:'能够水下呼吸；获得等同速度的游泳速度；水下呼吸可免费施放一次，长休恢复。'},
 {id:'gaze-two-minds',name:'双心凝视',level:5,note:'可通过自愿生物的感官感知，须持续维系连接。'},
 {id:'mask-many-faces',name:'千面假面',level:2,note:'可不消耗法术位施展易容术。'},
 {id:'myriad-forms',name:'万形之主',level:5,note:'可不消耗法术位施展变身术。'},
 {id:'misty-visions',name:'迷雾幻景',level:2,note:'可不消耗法术位施展无声幻影。'},
 {id:'one-shadows',name:'暗影同体',level:5,note:'身处微光或黑暗时，可不消耗法术位对自己施展隐形术。'},
 {id:'otherworldly-leap',name:'异界跳跃',level:2,note:'可不消耗法术位对自己施展跳跃术。'},
 {id:'distant-realms',name:'遥境幻视',level:9,note:'可不消耗法术位施展秘法眼。'},
 {id:'whispers-grave',name:'亡者低语',level:7,note:'可不消耗法术位施展死者交谈。'},
 {id:'witch-sight',name:'巫术视觉',level:15,note:'获得 30 尺真实视觉。'},
] as const;
export function invocationLimit(level:number){return level>=18?10:level>=15?9:level>=12?8:level>=9?7:level>=7?6:level>=5?5:level>=2?3:1;}
export function invocationState(draft:CharacterDraft){
 const config=draft.details?.fighterCalculator;if(config?.characterClass!=='邪术师')return {selected:[] as string[],active:[] as string[],invalid:false,limit:0};
 const raw=config.explorationInvocations,selected=Array.isArray(raw)?raw:[];const limit=invocationLimit(draft.level);
 const invalid=(raw!==undefined&&!Array.isArray(raw))||selected.length>limit||new Set(selected).size!==selected.length||selected.some(id=>!explorationInvocations.some(x=>x.id===id&&draft.level>=x.level));
 const active=selected.filter(id=>explorationInvocations.some(x=>x.id===id&&draft.level>=x.level));
 return {selected,active,invalid,limit};
}
