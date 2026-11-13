import type { Ability, CharacterDraft } from './characters';
import { classSpellState } from './classSpellChoices.ts';
import { alwaysPreparedSpells } from './preparedSpells.ts';
import { magicSources } from './magicInitiate.ts';
import { innateMagic } from './innateMagic.ts';
import { spellSlotResources } from './spellSlotResources.ts';

// 「法术与法术位」的自动摘要：把角色卡上已经勾选/记录的法术选择、常备法术、魔法学徒、物种天赋与法术位汇总成一段文字。
// 未手动填写时由界面直接显示这段文字；手动编辑后以手动文本为准。
const abilityNames: Record<string, string> = { int: '智力', wis: '感知', cha: '魅力' };
function named(entries: { name: string; level: number }[] | undefined): string[] {
  return (entries ?? []).filter((x): x is { name: string; level: number } => !!x && typeof x.name === 'string' && !!x.name.trim()).map(x => `${x.name}（${x.level} 环）`);
}
export function spellSummary(draft: CharacterDraft): string {
  const blocks: string[] = [];
  const state = classSpellState(draft);
  if (state) {
    const lines: string[] = [];
    const cantrips = [...(state.fixedMageHand ? ['法师之手（固定）'] : []), ...state.cantrips.filter((x): x is string => typeof x === 'string' && !!x.trim())];
    if (cantrips.length) lines.push(`戏法：${cantrips.join('、')}`);
    if (state.cls === '法师') lines.push(`法术书：${named(state.book).join('、') || '未记录'}`);
    if (state.prepared.length) lines.push(`准备法术：${named(state.prepared).join('、')}`);
    if (state.loreActive) lines.push(`魔法发现：${named(state.lore).join('、') || '未选择'}`);
    if (state.masteryActive) lines.push(`法术精通：${[1, 2].map(level => `${level} 环 ${state.mastery[String(level)] || '未选择'}`).join(' · ')}`);
    if (state.signatureActive) lines.push(`招牌法术：${state.signature.filter(x => typeof x === 'string' && !!x.trim()).join('、') || '未选择'}`);
    if (state.arcanumLevels.length) lines.push(`秘法：${state.arcanumLevels.map(level => `${level} 环 ${state.arcanum[String(level)] || '未选择'}`).join(' · ')}`);
    if (lines.length) blocks.push(`【${state.cls}戏法与准备法术】\n${lines.join('\n')}`);
  }
  const always = alwaysPreparedSpells(draft);
  if (always.length) blocks.push(`常备法术：${always.map(spell => spell.usage ? `${spell.name}（${spell.usage}）` : spell.name).join('、')}`);
  for (const source of magicSources(draft)) {
    const choice = source.choice;
    if (!choice) continue;
    const parts: string[] = [];
    const cantrips = (choice.cantrips ?? []).filter((x): x is string => typeof x === 'string' && !!x.trim());
    if (cantrips.length) parts.push(`戏法：${cantrips.join('、')}`);
    if (typeof choice.spell === 'string' && choice.spell.trim()) parts.push(`一环法术：${choice.spell}`);
    if (parts.length) blocks.push(`魔法学徒（${source.list}，${abilityNames[choice.ability] ?? '未选施法属性'}）：${parts.join('；')}`);
  }
  const innate = innateMagic(draft);
  if (innate?.spells?.length) blocks.push(`物种天赋：${innate.spells.map(spell => spell.level === 0 ? `${spell.name}（${spell.usage}）` : `${spell.level} 环 ${spell.name}（${spell.usage}）`).join('、')}`);
  const slots = spellSlotResources(draft);
  if (slots.length) blocks.push(`法术位：${slots.map(resource => `${resource.label} ${resource.remaining}/${resource.maximum}`).join(' · ')}`);
  return blocks.join('\n\n');
}
export function abilityLabel(ability: Ability): string {
  return abilityNames[ability] ?? ability;
}
