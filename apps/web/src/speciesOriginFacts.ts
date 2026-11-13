import type { CharacterDraft } from './characters';
import { proficiencyBonus } from './characterRules.ts';
import { getBackground, originFeatDescription } from './backgrounds.ts';
import { derivedCharacter } from './characterDerived.ts';
import { dragonbornBreath } from './dragonbornBreath.ts';
import { giantAncestry, speciesExploration } from './speciesExploration.ts';
import { innateMagic } from './innateMagic.ts';
import { toolProficiencies } from './toolProficiencies.ts';

// 物种与起源特性的只读事实：用于「物种特性与起源」面板与测试；可自动计算的部分在此汇总，其余写清需手动处理的环节。
export type TraitStatus = '自动' | '部分' | '手动' | '战斗';
export type TraitFact = { name: string; status: TraitStatus; detail: string };
const abilityNames: Record<string, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };

export function speciesTraitFacts(draft: CharacterDraft): TraitFact[] {
  const c = draft.details?.fighterCalculator;
  if (!c) return [];
  const pb = proficiencyBonus(draft.level);
  const derived = derivedCharacter(draft);
  const resistance = speciesExploration(draft)?.resistance;
  const innate = innateMagic(draft);
  const spells = (innate?.spells ?? []).map(s => `${s.name}（${s.usage}）`).join('、');
  const facts: TraitFact[] = [];
  const add = (name: string, status: TraitStatus, detail: string) => facts.push({ name, status, detail });
  switch (c.species) {
    case '阿斯莫': {
      add('黑暗视觉', '自动', `${derived?.darkvision ?? 60} 尺`);
      add('天界抗性', '自动', '黯蚀与光耀伤害抗性（DerivedStats「物种伤害抗性」）');
      add('治疗之手', '手动', `魔法动作触碰一个生物，恢复 ${pb}d4 生命值；1 次/长休（物种与起源特性次数）。治疗结果需手动掷骰`);
      add('光明使者', '自动', '光亮术戏法（血统法术，随意施放，魅力施法）');
      if (draft.level >= 3) add('天界启示', '手动', '消耗 1 次，持续 1 分钟；形态为天界之翼、内在光辉或黯蚀斗篷，天界之翼的飞行速度等于当前速度；形态效果需手动结算');
      break;
    }
    case '龙裔': {
      const breath = dragonbornBreath(draft);
      add('龙族血脉', '自动', breath?.ancestry ? `已选 ${breath.ancestry}（${breath.damageType}）` : '尚未选择龙族血脉');
      add('吐息武器', '自动', breath ? `次数 ${breath.uses}/长休；${breath.dice} ${breath.damageType ?? '伤害'}；敏捷豁免 DC ${breath.dc}；15 尺锥形或 30 尺线形；范围与伤害结算需手动` : '需先选择龙族血脉');
      add('伤害抗性', '自动', `${resistance ?? '未选择血脉'}伤害抗性（DerivedStats）`);
      add('黑暗视觉', '自动', `${derived?.darkvision ?? 60} 尺`);
      if (draft.level >= 5) add('龙族飞行', '手动', '消耗 1 次，获得等于当前速度的飞行速度，持续 10 分钟；失能、收回或长休结束需手动记录');
      break;
    }
    case '矮人': {
      add('黑暗视觉', '自动', `${derived?.darkvision ?? 120} 尺`);
      add('矮人韧性', '自动', '毒素伤害抗性（DerivedStats）；避免或结束中毒状态的豁免优势需手动');
      add('矮人坚韧', '自动', `生命上限每级 +1（已计入生命上限）`);
      add('石中精明', '手动', `激活后 10 分钟内需处于石面或接触石面，获得 60 尺震颤感知；次数 ${pb}/长休，接触状态需手动记录`);
      break;
    }
    case '精灵': {
      add('黑暗视觉', '自动', `${derived?.darkvision ?? 60} 尺`);
      add('精灵血统', '自动', `${c.elfLineage || '未选血统'}：${spells || '血统法术未选'}${c.elfLineage === '高等精灵' ? '；长休后可替换一个法师戏法（界面已提供）' : c.elfLineage === '木精灵' ? '；速度 35 尺' : ''}`);
      add('妖精血脉', '手动', '对避免或结束魅惑状态的豁免具有优势；掷骰需手动');
      add('敏锐感官', '自动', `已选技能熟练：${c.speciesSkill || '未选（洞悉/察觉/求生）'}`);
      add('出神', '手动', '不需睡眠且魔法无法使你睡眠；保持冥想时长休 4 小时即可完成，长休结算仍按长休按钮');
      break;
    }
    case '侏儒': {
      add('黑暗视觉', '自动', `${derived?.darkvision ?? 60} 尺`);
      add('侏儒狡黠', '手动', '智力、感知、魅力豁免具有优势；掷骰需手动');
      add('侏儒血统', '自动', `${c.gnomeLineage || '未选血统'}：${spells || '血统法术未选'}${c.gnomeLineage === '岩石侏儒' ? '；用魔法伎俩制作的小型发条装置需手动记录' : ''}`);
      break;
    }
    case '歌利亚': {
      const giant = c.giantAncestry && Object.hasOwn(giantAncestry, c.giantAncestry) ? giantAncestry[c.giantAncestry as keyof typeof giantAncestry] : undefined;
      add('巨人血脉', '手动', giant ? `${c.giantAncestry}：${giant} 次数 ${pb}/长休` : '尚未选择巨人血脉');
      if (draft.level >= 5) add('巨人形态', '手动', `消耗 1 次变为大型，力量检定具有优势且速度 +10 尺（当前速度 ${derived?.currentSpeed ?? draft.speedFt} 尺），持续 10 分钟`);
      add('强壮体格', '自动', `负重上限 ${draft.abilities.str * 30} 磅；结束擒抱的检定优势需手动`);
      break;
    }
    case '半身人': {
      add('勇敢', '手动', '对避免或结束恐慌状态的豁免具有优势；掷骰需手动');
      add('半身人灵活', '手动', '可穿过体型比你大的生物所在空间，但不能停在其中；移动结算需手动');
      add('幸运', '手动', 'D20 掷出 1 时可重掷一次并采用新结果；掷骰需手动');
      add('天生潜行', '手动', '仅被体型比你大的生物遮掩时也可尝试隐匿；判定需手动');
      break;
    }
    case '人类': {
      add('足智多谋', '手动', '长休后获得英雄激励（勾选记录，来源面板「起源特性」）');
      add('技能多才', '自动', `已选技能熟练：${c.speciesSkill || '未选'}`);
      add('多面手', '自动', `额外起源专长：${c.humanOriginFeat || '未选'}`);
      break;
    }
    case '兽人': {
      add('肾上腺素激增', '手动', `附赠动作疾走并获得 ${pb} 临时生命值；次数 ${pb}，短休或长休恢复，临时生命值需手动记录`);
      add('黑暗视觉', '自动', `${derived?.darkvision ?? 120} 尺`);
      add('不懈耐力', '手动', '生命值降至 0 且未被直接杀死时可改为 1；1 次/长休（战斗结算与次数记录）');
      break;
    }
    case '提夫林': {
      add('黑暗视觉', '自动', `${derived?.darkvision ?? 60} 尺`);
      add('异界传承', '自动', `${c.tieflingLegacy || '未选传承'}：${innate?.resistance ?? '未选'}抗性；${spells || '血统法术未选'}`);
      add('邪魔遗艺', '自动', '奇术戏法（血统法术，随意施放），施法属性随异界传承所选属性');
      break;
    }
    default:
      return [];
  }
  return facts;
}

const featStatus: Record<string, TraitStatus> = { '工匠': '部分', '音乐家': '部分', '娴熟': '部分', '魔法学徒': '部分', '幸运': '部分', '强韧': '自动', '警觉': '战斗', '医者': '手动', '野蛮攻击者': '战斗', '酒馆斗殴者': '战斗' };
const featNote: Record<string, string> = {
  '工匠': '三项工匠工具熟练可选（工具熟练）；非魔法物品折扣与快速制作需手动。',
  '音乐家': '三项乐器熟练可选；休息后可激励盟友，盟友状态需分别手动记录。',
  '娴熟': '三项技能或工具熟练可选并检查重复；由背景/职业重复熟练引起的替换需手动核对。',
  '魔法学徒': '施法属性、两个戏法与一个一环法术可选，免费次数已记录；法术替换时机需手动核对。',
  '幸运': '幸运点上限等于熟练加值，消耗与长休恢复已接入；影响掷骰或攻击的效果需人工处理。',
  '强韧': '生命上限每级 +2（已计入生命上限）。',
  '警觉': '先攻加熟练加值并可与自愿盟友交换先攻；仅在战斗轮内结算。',
  '医者': '使用医疗包急救与治疗骰重掷需手动记录医疗包次数并掷骰。',
  '野蛮攻击者': '每回合一次武器伤害骰重掷；仅在战斗轮内结算。',
  '酒馆斗殴者': '强化徒手打击与擒抱/推撞；仅在战斗轮内结算。',
};
function featKey(name: string): string { return name.startsWith('魔法学徒') ? '魔法学徒' : name; }
export function featFact(name: string): TraitFact {
  const key = featKey(name);
  return { name, status: featStatus[key] ?? '手动', detail: featNote[key] ?? originFeatDescription(name) };
}
export function originFacts(draft: CharacterDraft): {
  background: { name: string; abilities: string; skills: string; feat: string; tool: string; note: string } | null;
  feats: TraitFact[];
} {
  const c = draft.details?.fighterCalculator;
  const background = getBackground(draft.details?.background);
  const tools = toolProficiencies(draft);
  const featNames: string[] = [];
  if (background) featNames.push(background.feat);
  if (c?.species === '人类' && c.humanOriginFeat) featNames.push(c.humanOriginFeat);
  const unique = [...new Set(featNames)];
  return {
    background: background ? {
      name: draft.details?.background ?? '',
      abilities: background.abilities.map(a => abilityNames[a] ?? a).join('、'),
      skills: background.skills.join('、'),
      feat: background.feat,
      tool: tools.backgroundChoice ? `${background.tool}：${tools.backgroundChoice}` : background.tool,
      note: '属性候选、技能、起源专长与工具数据已接入；初始装备需写入装备栏，重复熟练替换需手动核对。',
    } : null,
    feats: unique.map(featFact),
  };
}
