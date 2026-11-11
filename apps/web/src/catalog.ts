import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import common from '../../../packages/contracts/schemas/common.schema.json';
import schema from '../../../packages/contracts/schemas/monster-entry.schema.json';
import raw from './data/monsters.json';

export type Feature = { id: string; name: string; description: string; automation: 'manual' | 'partial' | 'supported'; automationNotes?: string };
export type Block = { id: string; name: string; size: string; creatureTypes: string[]; challengeRating?: string; armorClass: number; hitPoints: { average: number; dice?: string }; abilities: Record<string, number>; speedFt: Record<string, number>; initiativeBonus?: number; proficiencyBonus?: number; experiencePoints?: number; savingThrows?: Record<string, number>; skills?: Record<string, number>; senses?: string[]; languages?: string[]; damageResistances?: string[]; damageImmunities?: string[]; damageVulnerabilities?: string[]; conditionImmunities?: string[]; gear?: string[]; traits?: Feature[]; actions: Feature[]; bonusActions?: Feature[]; reactions?: Feature[]; legendaryActions?: Feature[]; rule: { edition: string } };
export type Entry = { id: string; name: string; englishName?: string; aliases?: string[]; familyId?: string; habitats?: string[]; treasure?: string; description?: string; lair?: string; source: { name: string }; statBlocks: Block[] };
export type Card = { entry: Entry; block: Block };

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv); ajv.addSchema(common);
const validate = ajv.compile(schema);
export const entries: Entry[] = [];
export const errors: string[] = [];
raw.forEach((item, i) => { if (validate(item)) entries.push(item as Entry); else errors.push(`第 ${i + 1} 条：${ajv.errorsText(validate.errors)}`); });
export const cards: Card[] = entries.flatMap(entry => entry.statBlocks.map(block => ({ entry, block })));
export const crValue = (value?: string) => value?.includes('/') ? Number(value.split('/')[0]) / Number(value.split('/')[1]) : value === undefined ? Infinity : Number(value);
export function filterCards(items: Card[], query: string, type: string, cr: string, habitat: string, sort: string) {
  const q = query.trim().toLocaleLowerCase();
  return items.filter(({ entry, block }) => (!q || [entry.name, entry.englishName, entry.familyId, block.name, ...(entry.aliases ?? [])].some(x => x?.toLocaleLowerCase().includes(q))) && (!type || block.creatureTypes.includes(type)) && (!cr || block.challengeRating === cr) && (!habitat || entry.habitats?.includes(habitat)))
    .sort((a, b) => sort === 'cr' ? crValue(a.block.challengeRating) - crValue(b.block.challengeRating) || a.block.name.localeCompare(b.block.name, 'zh-CN') : a.block.name.localeCompare(b.block.name, 'zh-CN'));
}
