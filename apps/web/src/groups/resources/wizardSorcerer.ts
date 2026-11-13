import type { CharacterDraft } from '../../characters.ts';
import type { ClassResourceDef } from '../../classResources.ts';
import { abilityModifier } from '../../characterRules.ts';
// 归复平衡次数上限 = 魅力调整值（至少 1）；在此就地计算，避免与 wizardSorcererFeatures 形成运行时循环导入。
function clockworkBalanceLimit(draft: CharacterDraft): number {
  return Math.max(1, abilityModifier(draft.abilities.cha));
}
// 法师 + 术士 的额外职业资源定义（T6 组维护；classResources.ts 会合并此函数的结果）。
// 现有术法点/术法回想/奥术回想/天眼通/招牌法术由 classResources.ts 提供，此处不重复。
export function wizardSorcererResourceDefs(draft: CharacterDraft): ClassResourceDef[] {
  const config = draft.details?.fighterCalculator, level = draft.level;
  if (!config) return [];
  const defs: ClassResourceDef[] = [];
  if (config.characterClass === '术士') {
    // 先天术法的次数记录在 fighterCalculator.innateSorceryUses（见 wizardSorcererFeatures.ts），
    // 不在此追加基础资源，以免改变术士基础资源列表的既有接口。
    if (config.subclass === 'dragon' && level >= 14) defs.push({ id: 'draconic-wings', name: '龙翼', maximum: 1, shortRest: false, unit: '次', note: '附赠动作获得 1 小时飞行速度；长休恢复此使用次数，或花 3 术法点代替。' });
    if (config.subclass === 'clockwork' && level >= 3) defs.push({ id: 'clockwork-balance', name: '归复平衡', maximum: clockworkBalanceLimit(draft), shortRest: false, unit: '次', note: '反应把 60 尺内可见生物带优/劣势的检定改为无优劣势；长休恢复全部。' });
    if (config.subclass === 'clockwork' && level >= 14) defs.push({ id: 'clockwork-awareness', name: '序列意识', maximum: 1, shortRest: false, unit: '次', note: '附赠动作获得 1 分钟增益；长休恢复此使用次数，或花 5 术法点代替。' });
    if (config.subclass === 'clockwork' && level >= 18) defs.push({ id: 'clockwork-matrix', name: '时械矩阵', maximum: 1, shortRest: false, unit: '次', note: '魔法动作使用；长休恢复此使用次数，或花 7 术法点代替。' });
    if (config.subclass === 'wild-magic' && level >= 3) defs.push({ id: 'wild-tide', name: '混乱之潮', maximum: 1, shortRest: false, unit: '次', note: '自身 D20 检定掷前宣布以获得优势；长休恢复，使用法术位施展术士法术时也会恢复（同时掷狂野魔法浪涌表）。' });
    if (config.subclass === 'wild-magic' && level >= 18) defs.push({ id: 'tamed-surge', name: '驯服浪涌', maximum: 1, shortRest: false, unit: '次', note: '施术后选择浪涌表效果（最后一行除外）；长休恢复。' });
    if (config.subclass === 'aberrant' && level >= 18) defs.push({ id: 'aberrant-implosion', name: '扭曲内爆', maximum: 1, shortRest: false, unit: '次', note: '魔法动作传送并造成力场伤害；长休恢复此使用次数，或花 5 术法点代替。' });
    if (config.subclass === 'draconic' && level >= 18) defs.push({ id: 'draconic-companion', name: '龙族伙伴', maximum: 1, shortRest: false, unit: '次', note: '龙类召唤术免材料与法术位施放一次；长休恢复。' });
  }
  return defs;
}
