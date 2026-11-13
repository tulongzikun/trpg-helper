import type { CharacterDraft } from './characters';

// 2024 魔能祈唤目录。选择、数量上限与先决在角色卡自动化；战斗与叙事效果仍需按规则手动结算。
export type Invocation = {
 id: string;
 name: string;
 level: number;
 note: string;
 requires?: readonly string[];
};

export const explorationInvocations: readonly Invocation[] = [
 { id: 'pact-blade', name: '锋刃契约', level: 1, note: '可召唤契约武器，并可用魅力进行攻击与伤害掷骰。' },
 { id: 'pact-chain', name: '锁链契约', level: 1, note: '习得寻获魔宠，可用魔法动作不消耗法术位施放；可选择规则允许的特殊魔宠形态。' },
 { id: 'pact-tome', name: '书之魔契', level: 1, note: '获得影之书，内含三道戏法与两道仪式法术；书可作施法法器。' },
 { id: 'armor-shadows', name: '暗影护甲', level: 1, note: '可不消耗法术位对自己施展法师护甲；护甲效果持续期间的 AC 需按法术规则处理。' },
 { id: 'agonizing-blast', name: '苦痛魔爆', level: 1, note: '魔能爆命中时将魅力调整值加入伤害；战斗结算需人工。先决：已知魔能爆戏法。' },
 { id: 'eldritch-spear', name: '魔能长矛', level: 1, note: '魔能爆射程增加 60 尺；战斗结算需人工。先决：已知魔能爆戏法。' },
 { id: 'repelling-blast', name: '斥力魔爆', level: 1, note: '魔能爆命中时可把目标推离至多 10 尺；战斗结算需人工。先决：已知魔能爆戏法。' },
 { id: 'eldritch-mind', name: '魔能心智', level: 1, note: '维持专注的体质豁免具有优势。' },
 { id: 'fiendish-vigor', name: '恶魔活力', level: 1, note: '可随意不消耗法术位对自身施展虚假生命（以 1 环施放）。' },
 { id: 'mask-many-faces', name: '千面假面', level: 2, note: '可不消耗法术位施展易容术。' },
 { id: 'misty-visions', name: '迷雾幻景', level: 2, note: '可不消耗法术位施展无声幻影。' },
 { id: 'otherworldly-leap', name: '异界跳跃', level: 2, note: '可不消耗法术位对自己施展跳跃术。' },
 { id: 'lessons-first-ones', name: '先民教诲', level: 2, note: '获得一项自选起源专长；所选专长需人工记录到角色卡。' },
 { id: 'thief-five-fates', name: '五运窃贼', level: 2, note: '可不消耗法术位施放一次灾祸术；长休恢复。' },
 { id: 'devils-sight', name: '魔鬼视觉', level: 2, note: '120 尺内可在普通及魔法黑暗中正常视物。' },
 { id: 'ascendant-step', name: '升腾之步', level: 5, note: '可不消耗法术位对自己施展浮空术。' },
 { id: 'gift-depths', name: '深海赐礼', level: 5, note: '能够水下呼吸；获得等同速度的游泳速度；水下呼吸可免费施放一次，长休恢复。' },
 { id: 'gaze-two-minds', name: '双心凝视', level: 5, note: '可通过自愿生物的感官感知，须持续维系连接。' },
 { id: 'myriad-forms', name: '万形之主', level: 5, note: '可不消耗法术位施展变身术。' },
 { id: 'one-shadows', name: '暗影同体', level: 5, note: '身处微光或黑暗时，可不消耗法术位对自己施展隐形术。' },
 { id: 'eldritch-smite', name: '魔能斩', level: 5, requires: ['pact-blade'], note: '消耗契约法术位，命中时造成额外力场伤害并可能击倒；战斗结算需人工。先决：锋刃契约、魔契师 5 级。' },
 { id: 'thirsting-blade', name: '贪欲之刃', level: 5, requires: ['pact-blade'], note: '以契约武器执行攻击动作时可攻击两次。先决：锋刃契约、魔契师 5 级。' },
 { id: 'investment-chain-master', name: '锁链主投资', level: 5, requires: ['pact-chain'], note: '强化寻获魔宠的魔宠；具体战斗收益需人工结算。先决：锁链契约。' },
 { id: 'whispers-grave', name: '亡者低语', level: 7, note: '可不消耗法术位施展死者交谈。' },
 { id: 'distant-realms', name: '遥境幻视', level: 9, note: '可不消耗法术位施展秘法眼。' },
 { id: 'lifedrinker', name: '生命窃取', level: 9, requires: ['pact-blade'], note: '契约武器命中时额外造成暗蚀伤害；需人工结算。先决：锋刃契约。' },
 { id: 'gift-protectors', name: '守护者赠礼', level: 9, requires: ['pact-tome'], note: '影之书中获得守护者赠礼仪式；队友濒死时可代为承受。先决：书之魔契。' },
 { id: 'devouring-blade', name: '吞噬之刃', level: 12, requires: ['thirsting-blade'], note: '贪欲之刃的额外攻击增至两次。先决：贪欲之刃。' },
 { id: 'witch-sight', name: '巫术视觉', level: 15, note: '获得 30 尺真实视觉。' },
];

export function invocationLimit(level: number) {
 return level >= 18 ? 10 : level >= 15 ? 9 : level >= 12 ? 8 : level >= 9 ? 7 : level >= 7 ? 6 : level >= 5 ? 5 : level >= 2 ? 3 : 1;
}

export function invocationDefinition(id: string) {
 return explorationInvocations.find((item) => item.id === id);
}

export function invocationState(draft: CharacterDraft) {
 const config = draft.details?.fighterCalculator;
 if (config?.characterClass !== '邪术师') return { selected: [] as string[], active: [] as string[], invalid: false, limit: 0, errors: [] as string[] };
 const raw = config.explorationInvocations;
 const selected = Array.isArray(raw) ? raw : [];
 const limit = invocationLimit(draft.level);
 const errors: string[] = [];
 if (raw !== undefined && !Array.isArray(raw)) errors.push('魔能祈唤记录格式无效。');
 if (selected.length > limit) errors.push(`魔能祈唤最多选择 ${limit} 项。`);
 if (new Set(selected).size !== selected.length) errors.push('魔能祈唤不能重复选择。');
 const active = selected.filter((id) => {
  const item = invocationDefinition(id);
  if (!item || draft.level < item.level) return false;
  if (item.requires && !item.requires.every((need) => selected.includes(need))) return false;
  return true;
 });
 if (active.length !== selected.length) errors.push('存在等级不足或先决不满足的魔能祈唤。');
 return { selected, active, invalid: errors.length > 0, limit, errors };
}

// 角色卡显示：已生效祈唤与需要人工留意的战斗类祈唤分组。
export function invocationSheetLines(draft: CharacterDraft): string[] {
 if (draft.details?.fighterCalculator?.characterClass !== '邪术师') return [];
 const state = invocationState(draft);
 if (!state.selected.length) return [];
 const names = state.selected.map((id) => invocationDefinition(id)?.name ?? id);
 return [`魔能祈唤（${state.selected.length}/${state.limit}）：${names.join('、')}`];
}
