import type { Card, Block, Entry } from './catalog';
import type { CharacterSnapshot } from './characters';

export type Side = '友方' | '敌方' | '中立';
export type Actor = { id: string; name: string; side: Side; currentHp: number; maxHp: number; source: { entryId: string; blockId: string; entryName: string; source: Entry['source']; revision: number }; template: Pick<Block,'armorClass'>; characterSnapshot?: CharacterSnapshot };
export type Battle = { id: string; name: string; createdAt: string; actors: Actor[] };
export type BattleStore = { version: 1; battles: Battle[] };
export const storageKey = 'trpg-helper.battles.v1';
export const emptyStore = (): BattleStore => ({ version: 1, battles: [] });
export function readBattles(storage: Pick<Storage, 'getItem'>): BattleStore {
  const raw = storage.getItem(storageKey);
  if (raw === null) return emptyStore();
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('battles' in value) || !Array.isArray(value.battles) || !value.battles.every((b: unknown) => !!b && typeof b === 'object' && 'id' in b && typeof b.id === 'string' && 'name' in b && typeof b.name === 'string' && 'createdAt' in b && typeof b.createdAt === 'string' && 'actors' in b && Array.isArray(b.actors) && b.actors.every((a: unknown) => !!a && typeof a === 'object' && 'id' in a && typeof a.id === 'string' && 'name' in a && typeof a.name === 'string' && 'side' in a && ['友方', '敌方', '中立'].includes(String(a.side)) && 'currentHp' in a && typeof a.currentHp === 'number' && Number.isInteger(a.currentHp) && a.currentHp >= 0 && 'maxHp' in a && typeof a.maxHp === 'number' && Number.isInteger(a.maxHp) && a.maxHp >= a.currentHp && 'source' in a && !!a.source && typeof a.source === 'object' && 'source' in a.source && !!a.source.source && typeof a.source.source === 'object' && 'name' in a.source.source && typeof a.source.source.name === 'string' && 'template' in a && !!a.template && typeof a.template === 'object' && 'armorClass' in a.template && typeof a.template.armorClass === 'number'))) throw new Error('本地战斗数据格式无效或版本不支持，请保留原数据并修复后重试。');
  return value as BattleStore;
}
export function writeBattles(storage: Pick<Storage, 'setItem'>, store: BattleStore) { storage.setItem(storageKey, JSON.stringify(store)); }
export function addMonsters(store: BattleStore, card: Card, options: { battleId?: string; newBattleName?: string; side: Side; count: number }, makeId: () => string = () => crypto.randomUUID(), now: () => string = () => new Date().toISOString()): { store: BattleStore; battleId: string } {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 50) throw new Error('数量须为 1 到 50 的整数。');
  if (!['友方', '敌方', '中立'].includes(options.side)) throw new Error('请选择有效阵营。');
  if (!card.block.id || !Number.isInteger(card.block.hitPoints.average) || card.block.hitPoints.average < 1) throw new Error('怪物数据卡缺少有效的生命值或标识。');
  const result = structuredClone(store);
  let battle = result.battles.find(b => b.id === options.battleId);
  if (options.battleId && !battle) throw new Error('战斗不存在，请重新选择。');
  if (!options.battleId) {
    const name = options.newBattleName?.trim();
    if (!name) throw new Error('请输入战斗名称。');
    battle = { id: makeId(), name, createdAt: now(), actors: [] };
    result.battles.push(battle);
  }
  if (!battle) throw new Error('无法创建战斗。');
  for (let i = 0; i < options.count; i++) {
    const template = structuredClone(card.block);
    battle.actors.push({ id: makeId(), name: card.block.name, side: options.side, currentHp: template.hitPoints.average, maxHp: template.hitPoints.average, source: { entryId: card.entry.id, blockId: card.block.id, entryName: card.entry.name, source: structuredClone(card.entry.source), revision: card.entry.revision }, template });
  }
  return { store: result, battleId: battle.id };
}
export function updateActorHp(store: BattleStore, battleId: string, actorId: string, hp: number): BattleStore {
  const result = structuredClone(store); const actor = result.battles.find(b => b.id === battleId)?.actors.find(a => a.id === actorId);
  if (!actor || !Number.isInteger(hp) || hp < 0 || hp > actor.maxHp) throw new Error('生命值须为 0 至最大生命值之间的整数。');
  actor.currentHp = hp; return result;
}
export function addCharacter(store:BattleStore,snapshot:CharacterSnapshot,options:{battleId?:string;newBattleName?:string;side:Side},makeId:()=>string=()=>crypto.randomUUID(),now:()=>string=()=>new Date().toISOString()):{store:BattleStore;battleId:string}{
  if(snapshot.schemaVersion!=='manual-character-snapshot/v1'||!snapshot.characterId||!Number.isInteger(snapshot.revision)||snapshot.revision<1||!snapshot.sheet.name.trim()||!Number.isInteger(snapshot.sheet.maxHp)||snapshot.sheet.maxHp<1||!Number.isInteger(snapshot.sheet.armorClass)||snapshot.sheet.armorClass<0)throw Error('角色快照无效，无法导入。');
  if(!['友方','敌方','中立'].includes(options.side))throw Error('请选择有效阵营。');
  const result=structuredClone(store);let battle=result.battles.find(b=>b.id===options.battleId);
  if(options.battleId&&!battle)throw Error('战斗不存在，请重新选择。');
  if(!options.battleId){const name=options.newBattleName?.trim();if(!name)throw Error('请输入战斗名称。');battle={id:makeId(),name,createdAt:now(),actors:[]};result.battles.push(battle);}
  if(!battle)throw Error('无法创建战斗。');const copy=structuredClone(snapshot);battle.actors.push({id:makeId(),name:copy.sheet.name,side:options.side,currentHp:copy.sheet.maxHp,maxHp:copy.sheet.maxHp,source:{entryId:copy.characterId,blockId:copy.characterId,entryName:copy.sheet.name,source:{name:'角色库'},revision:copy.revision},template:{armorClass:copy.sheet.armorClass},characterSnapshot:copy});return {store:result,battleId:battle.id};
}
export function removeActor(store: BattleStore, battleId: string, actorId: string): BattleStore {
  const result = structuredClone(store); const battle = result.battles.find(b => b.id === battleId);
  if (!battle || !battle.actors.some(a => a.id === actorId)) throw new Error('未找到战斗单位。');
  battle.actors = battle.actors.filter(a => a.id !== actorId); return result;
}
