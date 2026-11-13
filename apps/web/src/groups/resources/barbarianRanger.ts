import type { CharacterDraft } from '../../characters';
import type { ClassResourceDef } from '../../classResources';
import { config } from '../../barbarianRangerConfig.ts';
import { rageDamageBonus, rageUses } from '../../barbarianFeatures.ts';
import { naturesVeilUses } from '../../rangerFeatures.ts';
import { zealotState } from '../../barbarianSubclasses.ts';
import { feyWandererState, gloomStalkerState } from '../../rangerSubclasses.ts';

// 野蛮人 + 游侠 的额外职业资源定义（T1 组维护；classResources.ts 会合并此函数的结果）。
// 猎人印记免费施法（ranger-mark）与不知疲倦（ranger-tireless）已在 classResources.ts 中定义，此处不重复。
export function barbarianRangerResourceDefs(draft: CharacterDraft): ClassResourceDef[] {
  const c = config(draft);
  if (!c) return [];
  const level = draft.level;
  const defs: ClassResourceDef[] = [];

  if (c.characterClass === '野蛮人') {
    defs.push({
      id: 'barbarian-rage',
      name: '狂暴',
      maximum: rageUses(level),
      shortRest: 'one',
      unit: '次',
      note: `狂暴伤害 +${rageDamageBonus(level)}；短休恢复 1 次，长休恢复全部。伤害抗性、力量检定与豁免优势、不能专注等只在战斗轮内生效，需手动处理。`,
    });
    if (level >= 15) {
      defs.push({
        id: 'barbarian-persistent-rage',
        name: '持久狂暴：重获狂暴次数',
        maximum: 1,
        shortRest: false,
        unit: '次',
        note: '投掷先攻时可重获全部狂暴次数；使用后到长休前不能再次这样做。',
      });
    }
    if (c.subclass === 'berserker' && level >= 14) {
      defs.push({
        id: 'berserker-intimidating-presence',
        name: '威慑之姿',
        maximum: 1,
        shortRest: false,
        unit: '次',
        note: '附赠动作使 30 尺内敌人感知豁免（DC = 8 + 力量调整值 + 熟练加值），失败恐慌 1 分钟；长休恢复，也可消耗一次狂暴次数重置。',
      });
    }
    const zealot = zealotState(draft);
    if (zealot) {
      defs.push({
        id: 'zealot-healing-pool',
        name: '神之勇者：治疗池',
        maximum: zealot.healingPoolDice,
        shortRest: false,
        unit: '枚 d12',
        note: '附赠动作消耗任意枚骰恢复生命值；长休恢复全部。需要多枚时连续点击消耗。',
      });
    }
    if (zealot?.zealousPresence) {
      defs.push({
        id: 'zealot-zealous-presence',
        name: '狂热威仪',
        maximum: 1,
        shortRest: false,
        unit: '次',
        note: '附赠动作使 60 尺内至多 10 名生物攻击与豁免具有优势，持续至你的下一回合开始；长休恢复，也可消耗一次狂暴次数重置。',
      });
    }
    if (zealot?.rageOfGods) {
      defs.push({
        id: 'zealot-rage-of-gods',
        name: '神之狂暴',
        maximum: 1,
        shortRest: false,
        unit: '次',
        note: '狂暴时呈现圣斗士姿态 1 分钟（生命值归零时结束）；长休恢复。',
      });
    }
  }

  if (c.characterClass === '游侠') {
    if (level >= 14) {
      defs.push({
        id: 'ranger-natures-veil',
        name: '自然面纱',
        maximum: naturesVeilUses(draft),
        shortRest: false,
        unit: '次',
        note: '附赠动作隐形至你的下一回合结束；长休恢复全部。',
      });
    }
    const fey = feyWandererState(draft);
    if (fey?.mistyStepFreeUses) {
      defs.push({
        id: 'fey-misty-wanderer',
        name: '雾行漫游：免费迷踪步',
        maximum: fey.mistyStepFreeUses,
        shortRest: false,
        unit: '次',
        note: '免费施放迷踪步，并可携带 5 尺内一名自愿生物；长休恢复全部。',
      });
    }
    if (fey?.feyReinforcements) {
      defs.push({
        id: 'fey-reinforcements',
        name: '精宸所与：免费妖精召唤术',
        maximum: 1,
        shortRest: false,
        unit: '次',
        note: '免材料免费施放妖精召唤术；可无需专注使其持续 1 分钟。长休恢复。',
      });
    }
    const gloom = gloomStalkerState(draft);
    if (gloom) {
      defs.push({
        id: 'gloom-dread-ambusher',
        name: '恐惧打击',
        maximum: gloom.dreadAmbusherUses,
        shortRest: false,
        unit: '次',
        note: `武器命中时额外造成 ${gloom.dreadStrikeDie} 心灵伤害，每回合一次；长休恢复全部。`,
      });
    }
  }

  return defs;
}
