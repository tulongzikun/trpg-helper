import type { CharacterDraft } from './characters';
import { abilityModifier, proficiencyBonus } from './characterRules.ts';
import { classSpellState, type PreparedClassSpell } from './classSpellChoices.ts';
import { classResources, changeClassResource } from './classResources.ts';

// 法师 / 术士非战斗特性（T6 组维护）。所有函数只读取或返回新的 CharacterDraft，不做战斗结算。
export type WizardSorcererClass = '法师' | '术士';
export const draconicAffinities = ['强酸', '寒冷', '火焰', '闪电', '毒素'] as const;
export type DraconicAffinity = typeof draconicAffinities[number];
export const fleshRevelationEffects = ['水生适应', '闪耀飞翔', '识破隐形', '蠕行移动'] as const;
export type FleshRevelationEffect = typeof fleshRevelationEffects[number];
export const wizardSubclassSchools: Record<string, string> = { abjurer: '防护', diviner: '预言', evoker: '塑能', illusionist: '幻术' };

export type WizardSorcererConfig = {
  characterClass?: string;
  subclass?: string;
  metamagic?: string[];
  innateSorceryActive?: boolean;
  innateSorceryUses?: number;
  draconicAffinity?: DraconicAffinity | '';
  fleshRevelation?: { active: boolean; points: number; effects: string[] };
  wildSurgeEffect?: string;
  epicBoon?: string;
  arcaneWardHp?: number;
  portent?: { values: number[]; used: boolean[] };
};
export type CatalogSpell = { name: string; level: number; school: string };

export function wizardSorcererConfig(draft: CharacterDraft): WizardSorcererConfig {
  const config = draft.details?.fighterCalculator as unknown as WizardSorcererConfig | undefined;
  return config ?? {};
}
export function wizardSorcererClass(draft: CharacterDraft): WizardSorcererClass | null {
  const cls = draft.details?.fighterCalculator?.characterClass;
  return cls === '法师' || cls === '术士' ? cls : null;
}
export function updateWizardSorcererConfig(draft: CharacterDraft, patch: Partial<WizardSorcererConfig>): CharacterDraft {
  const details = draft.details, config = details?.fighterCalculator;
  if (!details || !config) return draft;
  return { ...draft, details: { ...details, fighterCalculator: { ...config, ...patch } } };
}
function sorceryPointsRemaining(draft: CharacterDraft): number {
  return classResources(draft).find(r => r.id === 'sorcerer-points')?.remaining ?? 0;
}

// —— 施法 ——
export function spellcastingSummary(draft: CharacterDraft) {
  const cls = wizardSorcererClass(draft); if (!cls) return null;
  const ability = cls === '法师' ? 'int' as const : 'cha' as const;
  const modifier = abilityModifier(draft.abilities[ability]);
  const proficiency = proficiencyBonus(draft.level);
  const state = classSpellState(draft);
  return {
    cls, abilityName: ability === 'int' ? '智力' : '魅力', modifier, proficiency,
    saveDC: 8 + proficiency + modifier, attackBonus: proficiency + modifier,
    cantrips: state?.cantrips.length ?? 0, cantripLimit: state?.cantripLimit ?? 0,
    prepared: state?.prepared.length ?? 0, preparedLimit: state?.preparedLimit ?? 0,
    book: state?.book.length ?? 0,
  };
}

// —— 术士：超魔法 ——
export function metamagicLimit(level: number): number { return level >= 17 ? 6 : level >= 10 ? 4 : level >= 2 ? 2 : 0; }
export function metamagicState(draft: CharacterDraft) {
  const cls = wizardSorcererClass(draft);
  const limit = cls === '术士' ? metamagicLimit(draft.level) : 0;
  const chosen = (wizardSorcererConfig(draft).metamagic ?? []).filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
  const duplicates = new Set(chosen).size !== chosen.length;
  return { limit, chosen, remaining: Math.max(0, limit - chosen.length), invalid: cls === '术士' && (chosen.length > limit || duplicates) };
}
export function setMetamagic(draft: CharacterDraft, names: string[]): CharacterDraft {
  const state = metamagicState(draft);
  const cleaned = Array.from(new Set(names.map(name => name.trim()).filter(name => name.length > 0))).slice(0, state.limit);
  return wizardSorcererClass(draft) === '术士' ? updateWizardSorcererConfig(draft, { metamagic: cleaned }) : draft;
}
export function addMetamagic(draft: CharacterDraft, name: string): CharacterDraft {
  const trimmed = name.trim(), state = metamagicState(draft);
  if (!trimmed || state.chosen.includes(trimmed) || state.chosen.length >= state.limit) return draft;
  return setMetamagic(draft, [...state.chosen, trimmed]);
}
export function removeMetamagic(draft: CharacterDraft, name: string): CharacterDraft {
  return setMetamagic(draft, metamagicState(draft).chosen.filter(item => item !== name));
}

// —— 术士：先天术法（1 级）、术法化身（7 级）、奥术化神（20 级） ——
export function innateSorceryState(draft: CharacterDraft) {
  const cls = wizardSorcererClass(draft), available = cls === '术士';
  const spent = Math.max(0, Math.min(2, Math.floor(wizardSorcererConfig(draft).innateSorceryUses ?? 0)));
  return {
    available,
    active: available && !!wizardSorcererConfig(draft).innateSorceryActive,
    maximum: 2, spent, remaining: 2 - spent,
    sorceryPoints: sorceryPointsRemaining(draft),
    incarnation: available && draft.level >= 7,
    apotheosis: available && draft.level >= 20,
    saveDCBonus: 1, durationMinutes: 1,
  };
}
export function toggleInnateSorcery(draft: CharacterDraft): CharacterDraft {
  const state = innateSorceryState(draft);
  if (!state.available) return draft;
  if (state.active) return updateWizardSorcererConfig(draft, { innateSorceryActive: false });
  let next = draft;
  if (state.remaining > 0) next = updateWizardSorcererConfig(draft, { innateSorceryUses: state.spent + 1 });
  else if (state.incarnation && state.sorceryPoints >= 2) next = changeClassResource(draft, 'sorcerer-points', 2);
  else return draft;
  return updateWizardSorcererConfig(next, { innateSorceryActive: true });
}

// —— 术士：术法复苏（5 级） ——
export function sorcerousRestorationState(draft: CharacterDraft) {
  const available = wizardSorcererClass(draft) === '术士' && draft.level >= 5;
  const resource = classResources(draft).find(r => r.id === 'sorcerer-restoration');
  return { available, maximumPoints: Math.floor(draft.level / 2), used: (resource?.spent ?? 0) > 0, remaining: resource?.remaining ?? 0 };
}

// —— 法师：奥术回想、仪式学家、记忆法术 ——
export function arcaneRecoveryState(draft: CharacterDraft) {
  const available = wizardSorcererClass(draft) === '法师';
  const resource = classResources(draft).find(r => r.id === 'wizard-recovery');
  return { available, maximumTotalLevels: Math.ceil(draft.level / 2), used: (resource?.spent ?? 0) > 0, remaining: resource?.remaining ?? 0 };
}
export function ritualState(draft: CharacterDraft) {
  const available = wizardSorcererClass(draft) === '法师';
  const state = classSpellState(draft);
  return { available, bookCount: state?.book.length ?? 0, note: '法术书中带「仪式」标签的法术可不消耗法术位、无需准备地以仪式施放；法术数据暂无仪式标签，需按法术描述手动确认。' };
}
export function wizardMemorySpell(draft: CharacterDraft, fromName: string, toName: string): { draft: CharacterDraft; error?: string } {
  if (wizardSorcererClass(draft) !== '法师') return { draft, error: '记忆法术为法师特性。' };
  if (draft.level < 5) return { draft, error: '记忆法术 5 级起可用。' };
  const state = classSpellState(draft); if (!state) return { draft, error: '尚未选择法师法术。' };
  const from = state.prepared.find(spell => spell && spell.name === fromName);
  if (!from || from.level < 1) return { draft, error: '请选择一项已准备的 1 环及更高环阶法术。' };
  const to = state.book.find(spell => spell && spell.name === toName);
  if (!to || to.level < 1) return { draft, error: '替换目标必须是法术书中的 1 环及更高环阶法术。' };
  if (state.prepared.some(spell => spell && spell.name === toName)) return { draft, error: '目标法术已准备，无需替换。' };
  const details = draft.details, config = details?.fighterCalculator, selection = config?.classSpellChoices?.['法师'];
  if (!details || !config || !selection) return { draft, error: '缺少法师法术选择记录。' };
  const prepared = (selection.prepared ?? []).map<PreparedClassSpell>(spell => spell && spell.name === fromName ? { name: to.name, level: to.level, ...(to.source ? { source: to.source } : {}) } : spell);
  const next = { ...draft, details: { ...details, fighterCalculator: { ...config, classSpellChoices: { ...config.classSpellChoices, '法师': { ...selection, prepared } } } } };
  return { draft: next };
}

// —— 法师：法术精通（施法时间为动作的 1、2 环法术） ——
export function masteryCandidates(book: PreparedClassSpell[], descriptions: { name: string; level: number; actionType?: string }[], level: 1 | 2): { name: string }[] {
  return book.filter(spell => spell && spell.level === level && typeof spell.name === 'string').map(spell => {
    const english = spell.name.match(/[A-Za-z].*$/)?.[0];
    const description = english ? descriptions.find(item => item.level === spell.level && item.name.toLowerCase().replace(/[^a-z0-9]/g, '') === english.toLowerCase().replace(/[^a-z0-9]/g, '')) : undefined;
    return { name: spell.name, action: description?.actionType ?? '' };
  }).filter(entry => entry.name.length > 0);
}
export function masteryState(draft: CharacterDraft) {
  const state = classSpellState(draft); if (!state || wizardSorcererClass(draft) !== '法师' || draft.level < 18) return null;
  return { active: state.masteryActive, mastery: state.mastery, invalid: state.invalidMastery };
}
export function signatureState(draft: CharacterDraft) {
  const state = classSpellState(draft); if (!state || wizardSorcererClass(draft) !== '法师' || draft.level < 20) return null;
  return { active: state.signatureActive, signature: state.signature, invalid: state.invalidSignature };
}

// —— 法师子职：学者免费法术核对 ——
export function wizardScholarState(draft: CharacterDraft, catalog: CatalogSpell[]) {
  const config = draft.details?.fighterCalculator;
  const school = config?.characterClass === '法师' ? wizardSubclassSchools[config.subclass ?? ''] : undefined;
  if (!school || draft.level < 3) return null;
  const state = classSpellState(draft);
  const newSlotLevels = [5, 7, 9, 11, 13, 15, 17].filter(level => level <= draft.level).length;
  const required = 2 + newSlotLevels;
  const schoolNames = new Set(catalog.filter(spell => spell.school === school).map(spell => spell.name));
  const inBook = (state?.book ?? []).filter(spell => spell && typeof spell.name === 'string' && schoolNames.has(spell.name)).length;
  return { school, required, inBook, met: inBook >= required };
}

// —— 术士子职：龙族魔法 ——
export function draconicAffinityState(draft: CharacterDraft) {
  const config = draft.details?.fighterCalculator;
  const available = wizardSorcererClass(draft) === '术士' && config?.subclass === 'draconic' && draft.level >= 6;
  const chosen = wizardSorcererConfig(draft).draconicAffinity ?? '';
  return { available, chosen, options: draconicAffinities };
}
export function setDraconicAffinity(draft: CharacterDraft, affinity: DraconicAffinity | ''): CharacterDraft {
  return draconicAffinityState(draft).available ? updateWizardSorcererConfig(draft, { draconicAffinity: affinity }) : draft;
}

// —— 术士子职：异怪魔法（血肉启示） ——
export function fleshRevelationState(draft: CharacterDraft) {
  const config = draft.details?.fighterCalculator;
  const available = wizardSorcererClass(draft) === '术士' && config?.subclass === 'aberrant' && draft.level >= 14;
  const current = wizardSorcererConfig(draft).fleshRevelation;
  return {
    available,
    active: !!current?.active,
    points: current?.points ?? 0,
    effects: (current?.effects ?? []).filter((name): name is string => typeof name === 'string'),
    remainingPoints: sorceryPointsRemaining(draft),
    options: fleshRevelationEffects,
  };
}
export function activateFleshRevelation(draft: CharacterDraft, points: number, effects: string[]): { draft: CharacterDraft; error?: string } {
  const state = fleshRevelationState(draft);
  if (!state.available) return { draft, error: '血肉启示需异怪魔法术士 14 级。' };
  if (!Number.isInteger(points) || points < 1 || points > fleshRevelationEffects.length) return { draft, error: `消耗术法点须为 1 至 ${fleshRevelationEffects.length} 点。` };
  const unique = Array.from(new Set(effects));
  if (unique.length !== points) return { draft, error: '每消耗 1 点术法点须选择一项不同增益。' };
  if (unique.some(name => !(fleshRevelationEffects as readonly string[]).includes(name))) return { draft, error: '增益选项无效。' };
  if (state.remainingPoints < points) return { draft, error: '术法点不足。' };
  const next = changeClassResource(draft, 'sorcerer-points', points);
  return { draft: updateWizardSorcererConfig(next, { fleshRevelation: { active: true, points, effects: unique } }) };
}
export function endFleshRevelation(draft: CharacterDraft): CharacterDraft {
  const current = wizardSorcererConfig(draft).fleshRevelation;
  if (!current?.active) return draft;
  return updateWizardSorcererConfig(draft, { fleshRevelation: { ...current, active: false } });
}

// —— 术士子职：狂野魔法（浪涌效果记录） ——
export function wildSurgeState(draft: CharacterDraft) {
  const config = draft.details?.fighterCalculator;
  const available = wizardSorcererClass(draft) === '术士' && config?.subclass === 'wild-magic' && draft.level >= 3;
  return { available, effect: wizardSorcererConfig(draft).wildSurgeEffect ?? '' };
}
export function setWildSurgeEffect(draft: CharacterDraft, text: string): CharacterDraft {
  return wildSurgeState(draft).available ? updateWizardSorcererConfig(draft, { wildSurgeEffect: text.slice(0, 200) }) : draft;
}

// —— 传奇恩惠（19 级） ——
export function epicBoonState(draft: CharacterDraft) {
  const available = wizardSorcererClass(draft) !== null && draft.level >= 19;
  const chosen = wizardSorcererConfig(draft).epicBoon ?? '';
  return { available, chosen };
}
export function setEpicBoon(draft: CharacterDraft, text: string): CharacterDraft {
  return epicBoonState(draft).available ? updateWizardSorcererConfig(draft, { epicBoon: text.slice(0, 120) }) : draft;
}

// —— 归复平衡（发条 3 级）：次数上限 = 魅力调整值，至少 1 ——
export function clockworkBalanceLimit(draft: CharacterDraft): number {
  return Math.max(1, abilityModifier(draft.abilities.cha));
}
// —— 奥术守御（防护 3 级）：结界生命值 = 法师等级 × 2 + 智力调整值 ——
export function arcaneWardMax(draft: CharacterDraft): number {
  return draft.level * 2 + Math.max(0, abilityModifier(draft.abilities.int));
}
export function arcaneWardState(draft: CharacterDraft) {
  const config = draft.details?.fighterCalculator;
  const available = wizardSorcererClass(draft) === '法师' && config?.subclass === 'abjurer' && draft.level >= 3;
  const maximum = arcaneWardMax(draft);
  const raw = wizardSorcererConfig(draft).arcaneWardHp;
  const hp = typeof raw === 'number' && Number.isInteger(raw) ? Math.max(0, Math.min(maximum, raw)) : 0;
  return { available, maximum, hp, remainingPoints: 0 };
}
export function setArcaneWardHp(draft: CharacterDraft, hp: number): CharacterDraft {
  const state = arcaneWardState(draft);
  if (!state.available || !Number.isFinite(hp)) return draft;
  return updateWizardSorcererConfig(draft, { arcaneWardHp: Math.max(0, Math.min(state.maximum, Math.round(hp))) });
}

// —— 预言师：预兆（3 级）与高等预兆（14 级） ——
export function portentState(draft: CharacterDraft) {
  const config = draft.details?.fighterCalculator;
  const available = wizardSorcererClass(draft) === '法师' && config?.subclass === 'diviner' && draft.level >= 3;
  const count = available ? (draft.level >= 14 ? 3 : 2) : 0;
  const saved = wizardSorcererConfig(draft).portent;
  const values = Array.from({ length: count }, (_, index) => {
    const value = saved?.values?.[index];
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 20 ? value : 0;
  });
  const used = values.map((_, index) => !!saved?.used?.[index]);
  return { available, count, values, used, remaining: values.filter((value, index) => value > 0 && !used[index]).length, higher: available && draft.level >= 14 };
}
export function setPortentValue(draft: CharacterDraft, index: number, value: number): CharacterDraft {
  const state = portentState(draft);
  if (!state.available || index < 0 || index >= state.count || !Number.isInteger(value) || value < 1 || value > 20) return draft;
  const values = [...state.values], used = [...state.used];
  values[index] = value; used[index] = false;
  return updateWizardSorcererConfig(draft, { portent: { values, used } });
}
export function togglePortentUsed(draft: CharacterDraft, index: number): CharacterDraft {
  const state = portentState(draft);
  if (!state.available || index < 0 || index >= state.count || state.values[index] < 1) return draft;
  const used = [...state.used];
  used[index] = !used[index];
  return updateWizardSorcererConfig(draft, { portent: { values: state.values, used } });
}
export function clearPortent(draft: CharacterDraft): CharacterDraft {
  const state = portentState(draft);
  if (!state.available) return draft;
  return updateWizardSorcererConfig(draft, { portent: { values: Array.from({ length: state.count }, () => 0), used: Array.from({ length: state.count }, () => false) } });
}

// —— 子职被动特性一览（显示与提示） ——
export type SubclassFeatureNote = { name: string; level: number; text: string };
const subclassNotes: Record<string, SubclassFeatureNote[]> = {
  aberrant: [
    { name: '灵能法术', level: 3, text: '灵能法术表中的法术始终准备，且不计入准备法术数量。' },
    { name: '灵能术法', level: 6, text: '施展灵能法术表中的一环或更高环法术时，可花等同环阶的术法点代替法术位，并可忽略言语、姿势与无价值的材料成分。' },
    { name: '心灵防御', level: 6, text: '获得心灵伤害抗性；为避免或结束魅惑与恐慌状态而进行的豁免具有优势。' },
  ],
  clockwork: [
    { name: '时械法术', level: 3, text: '时械法术表中的法术始终准备，且不计入准备法术数量。' },
    { name: '归复平衡', level: 3, text: '反应：使 60 尺内一名可见生物一次带优势或劣势的 D20 检定改为无优势也无劣势；使用次数见职业资源区。' },
    { name: '律令之壁', level: 6, text: '魔法动作花 1~5 点术法点创造屏障，每点提供 1d8 减伤，受伤时消耗；相关结算在战斗轮内进行。' },
    { name: '序列意识', level: 14, text: '附赠动作获得 1 分钟增益：针对你的攻击没有优势；你的 D20 检定掷出 9 或以下时视为 10。' },
    { name: '时械矩阵', level: 18, text: '魔法动作在 30 尺立方内选择一项：治愈（合计 100 点生命值任意分配）、修复物件或结束 6 环及以下法术。' },
  ],
  draconic: [
    { name: '龙族法术', level: 3, text: '龙族法术表中的法术始终准备，且不计入准备法术数量。' },
    { name: '龙族体魄', level: 3, text: '生命值上限增加 3，此后每获得一个术士等级再 +1；无甲防御 = 10 + 敏捷调整值 + 魅力调整值（已计入生命值与防御值）。' },
    { name: '龙族伙伴', level: 18, text: '施展龙类召唤术无需材料成分，且可免法术位施展一次；也可改为无需专注，持续 1 分钟。' },
  ],
  'wild-magic': [
    { name: '狂野魔法浪涌', level: 3, text: '消耗法术位施展术士法术后可掷 d20，掷出 20 时掷浪涌表；每回合一次。' },
    { name: '混乱之潮', level: 3, text: '可在掷 D20 前使自身一次 D20 检定获得优势；长休恢复，消耗法术位施展术士法术时也会恢复，但恢复时立即掷浪涌表。' },
    { name: '扭曲幸运', level: 6, text: '反应花 1 点术法点，使 60 尺内一名可见生物的一次 D20 检定加或减 1d4。' },
    { name: '受控混沌', level: 14, text: '掷浪涌表时骰两次，并选择其中一项效果。' },
    { name: '驯服浪涌', level: 18, text: '用尽法术位施展术士法术后，可立即选择浪涌表效果（最后一行除外）代替掷骰；长休恢复一次。' },
  ],
  abjurer: [
    { name: '投射守御', level: 6, text: '反应：30 尺内一名可见生物受到伤害时，由奥术守御结界代替承受该伤害。' },
    { name: '破法者', level: 10, text: '始终准备法术反制与解除魔法；可以附赠动作施展解除魔法，并进行智力检定（加熟练加值）；施展法术被反制时不消耗法术位。' },
    { name: '法术抗性', level: 14, text: '对抗法术的豁免具有优势；对法术造成的伤害具有抗性。' },
  ],
  diviner: [],
  evoker: [
    { name: '强力戏法', level: 3, text: '造成伤害的戏法攻击失手或目标豁免成功时，目标仍受一半伤害（无其他效应）。' },
    { name: '法术塑形', level: 6, text: '施展塑能法术时，可选择 1 + 法术环阶个生物，使其豁免成功且不受一半伤害。' },
    { name: '强效塑能', level: 10, text: '施展法师法术表中的塑能法术时，可将智力调整值加到该法术的一次伤害骰上。' },
    { name: '超限导能', level: 14, text: '施展 1–5 环伤害法术时可取最大伤害；长休前再次使用则每环受 2d12 黯蚀伤害，每多用一次每环 +1d12。' },
  ],
  illusionist: [
    { name: '强化幻术', level: 3, text: '幻术法术无需言语成分；施法距离 10 尺以上的幻术距离增加 60 尺；已知次级幻象且不占戏法数量；次级幻象可同时产生声音与影像，并可以附赠动作施展。' },
    { name: '魅影生灵', level: 6, text: '始终准备野兽召唤术与妖精召唤术；两道幻术版本各可免法术位施展一次（该版本召唤物生命值减半），长休恢复。' },
    { name: '幻影化形', level: 10, text: '被攻击命中时可用反应插入幻象，使该攻击自动失手；长休恢复一次，或消耗一个 2 环及以上法术位重置。' },
    { name: '亦真亦幻', level: 14, text: '用法术位施展幻术法术时，可使幻象中一个非活化、非魔法物件变为真实，持续 1 分钟；持续期间可用附赠动作再次使用。' },
  ],
};
export function subclassFeatureNotes(draft: CharacterDraft): SubclassFeatureNote[] {
  const config = wizardSorcererConfig(draft);
  const list = subclassNotes[String(config.subclass ?? '')] ?? [];
  return list.filter(note => draft.level >= note.level);
}
export function telepathyState(draft: CharacterDraft) {
  const config = wizardSorcererConfig(draft);
  const available = wizardSorcererClass(draft) === '术士' && config.subclass === 'aberrant' && draft.level >= 3;
  const rangeMiles = Math.max(0, abilityModifier(draft.abilities.cha));
  return { available, durationMinutes: draft.level, rangeMiles, linkRangeFeet: 30 };
}
export function psionicSorceryCost(spellLevel: number): number {
  return Math.max(1, Math.floor(spellLevel));
}
export function psionicSorceryState(draft: CharacterDraft) {
  const config = wizardSorcererConfig(draft);
  return { available: wizardSorcererClass(draft) === '术士' && config.subclass === 'aberrant' && draft.level >= 6 };
}
