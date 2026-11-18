import { useMemo, useState } from 'react';
import { findSpellDescription, type SpellDescription } from './spellDescriptions';

type SpellIndex = Record<string, { cantrips: string[]; level1: string[]; spells?: { name: string; level: number; school: string }[]; url: string }>;
type SpellEntry = { name: string; level: number; school: string; classes: string[] };
const files = import.meta.glob('./data/imported-origin-spells.json', { eager: true, import: 'default' }) as Record<string, SpellIndex>;
const data = Object.values(files)[0];
const descriptions = Object.values(import.meta.glob('./data/imported-spell-descriptions.json', { eager: true, import: 'default' })).flatMap(value => Array.isArray(value) ? value as SpellDescription[] : []);
const artStyles = ['mist', 'ember', 'stone', 'tide', 'moss'];
const symbols = ['✧', '✺', '⬡', '◌', '✳'];
const pageSize = 24;
const levelLabel = (level: number) => level === 0 ? '戏法' : `${level} 环法术`;
const splitName = (name: string) => { const index = name.search(/[A-Za-z]/); return index < 0 ? { chinese: name, english: '' } : { chinese: name.slice(0, index).trim(), english: name.slice(index).trim() }; };

function SpellDetail({ spell, close }: { spell: SpellEntry; close: () => void }) {
 const { chinese, english } = splitName(spell.name);
 const description = findSpellDescription(descriptions, spell.name, spell.level);
 return <article className="detail spell-detail"><button type="button" className="back" onClick={close}>← 返回法术库</button><div className="detail-top"><div><div className="eyebrow">SPELL LIBRARY / 法术资料</div><h1>{chinese}</h1>{english && <p className="english">{english}</p>}</div><div className="detail-cr"><small>法术环阶</small>{spell.level === 0 ? '戏法' : `${spell.level} 环`}</div></div><div className="detail-grid"><section className="statblock"><div className="stat-header"><span>SPELL COMPENDIUM</span><span>法术资料 / 01</span></div><h2>{chinese}</h2><p className="stat-sub">{levelLabel(spell.level)} · {spell.school || '学派未提供'}</p><div className="spell-detail-meta"><div><small>施法时间</small><strong>{description?.actionType || '未提供'}</strong></div><div><small>射程</small><strong>{description?.range || '未提供'}</strong></div><div><small>持续时间</small><strong>{description?.duration || '未提供'}</strong></div></div><section className="feature-section"><h3>法术描述</h3>{description ? <><p className="sheet-text">{description.description}</p>{description.higherLevelSlot && <><h3>升环施法</h3><p className="sheet-text">{description.higherLevelSlot}</p></>}<p className="spell-credit">英文规则：D&D SRD 5.2，Wizards of the Coast LLC，CC BY 4.0。</p></> : <p className="sheet-text">暂无匹配的 SRD 描述。请运行 pnpm import:spell-descriptions 导入英文资料，或查看原始来源。</p>}</section></section><div><section className="story"><div className="section-label">01 / 法术档案</div><h2>法术来源</h2><p>此法术出现于以下职业的法术列表。导入数据可能存在遗漏，请以原始规则为准。</p><div className="spell-source-list">{spell.classes.map(cls => <a key={cls} href={data?.[cls]?.url} target="_blank" rel="noreferrer">{cls}法术列表 <span>↗</span></a>)}</div></section><div className="notice"><span>✦</span><div><strong>关于这些资料</strong><p>法术名称和分类来自本地索引；具体施法条件与效果请核对来源。</p></div></div></div></div></article>;
}

export function SpellLibrary() {
 const [query, setQuery] = useState('');
 const [level, setLevel] = useState('');
 const [cls, setClass] = useState('');
 const [school, setSchool] = useState('');
 const [sort, setSort] = useState('level');
 const [page, setPage] = useState(1);
 const [selected, setSelected] = useState<SpellEntry | null>(null);
 const allEntries = useMemo(() => {
  const map = new Map<string, SpellEntry>();
  for (const [name, index] of Object.entries(data ?? {})) for (const { name: spell, level: spellLevel, school: spellSchool } of (index.spells ?? [...index.cantrips.map(name => ({ name, level: 0, school: '' })), ...index.level1.map(name => ({ name, level: 1, school: '' }))])) {
   const key = `${spellLevel}:${spell}`;
   const item = map.get(key) ?? { name: spell, level: spellLevel, school: spellSchool, classes: [] };
   item.classes.push(name); map.set(key, item);
  }
  return [...map.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'zh-CN'));
 }, []);
 const schools = useMemo(() => [...new Set(allEntries.map(x => x.school).filter(Boolean))].sort(), [allEntries]);
 const results = useMemo(() => allEntries.filter(x => (!query || x.name.toLowerCase().includes(query.toLowerCase())) && (!level || String(x.level) === level) && (!cls || x.classes.includes(cls)) && (!school || x.school === school)).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'zh-CN') || a.level - b.level : a.level - b.level || a.name.localeCompare(b.name, 'zh-CN')), [allEntries, query, level, cls, school, sort]);
 const clear = () => { setQuery(''); setLevel(''); setClass(''); setSchool(''); setPage(1); };
 const changeFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
 if (selected) return <SpellDetail spell={selected} close={() => { setSelected(null); window.scrollTo(0, 0); }}/>;
 return <><div className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> THE ADVENTURER'S ARCHIVE <span className="dot">✦</span> VOL. 02</div><h1>法术图鉴<span>。</span></h1><p>翻阅魔法的篇章，探索每一道法术的奥秘。</p></div><div className="hero-emblem" aria-hidden="true"><span>✧</span><small>ARCANE NOTES<br/>FOR ADVENTURERS</small></div><div className="hero-index">INDEX <strong>{allEntries.length} 条法术</strong></div></div>
 {!data ? <div className="spell-missing empty"><span>✧</span><h3>尚无法术数据</h3><p>请先运行 pnpm import:origin-spells，完成后刷新页面。</p></div> : <div className="content"><aside className="filters"><div className="filters-head"><div><span className="section-label">REFINE YOUR SEARCH</span><h2>筛选法术</h2></div><button type="button" className="clear" onClick={clear}>清除</button></div><label>法术环阶<select value={level} onChange={e => changeFilter(setLevel, e.target.value)}><option value="">全部环阶</option>{Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{i === 0 ? '戏法' : `${i} 环`}</option>)}</select></label><label>法术学派<select value={school} onChange={e => changeFilter(setSchool, e.target.value)}><option value="">全部学派</option>{schools.map(x => <option key={x}>{x}</option>)}</select></label><label>施法职业<select value={cls} onChange={e => changeFilter(setClass, e.target.value)}><option value="">全部职业</option>{Object.keys(data).map(x => <option key={x}>{x}</option>)}</select></label><div className="filter-note"><span>✦</span><p>每一段咒文，都藏着一种可能。</p></div></aside><section className="results"><div className="search-row"><label className="search"><span aria-hidden="true">⌕</span><input aria-label="搜索法术名称" placeholder="搜索法术名称或英文名..." value={query} onChange={e => changeFilter(setQuery, e.target.value)}/>{query && <button type="button" aria-label="清除搜索" onClick={() => changeFilter(setQuery, '')}>×</button>}</label><label className="sort-label">排序 <select aria-label="排序" value={sort} onChange={e => changeFilter(setSort, e.target.value)}><option value="level">法术环阶</option><option value="name">名称</option></select></label></div><div className="results-heading"><div><span className="section-label">THE COLLECTION</span><h2>探索法术 <span>／ {String(results.length).padStart(2, '0')}</span></h2></div><p>共 {results.length} 条资料 <span>·</span> 数据来自本地</p></div>{results.length ? <div className="card-grid">{results.slice((page - 1) * pageSize, page * pageSize).map(spell => { const index = allEntries.indexOf(spell), name = splitName(spell.name); return <button type="button" className="monster-card spell-card" key={`${spell.level}:${spell.name}`} onClick={() => { setSelected(spell); window.scrollTo(0, 0); }}><div className={`card-art art-${artStyles[index % artStyles.length]}`}><div className="art-top"><span>NO. {String(index + 1).padStart(3, '0')}</span><span>✦</span></div><div className="art-symbol">{symbols[index % symbols.length]}</div><div className="art-bottom"><span>ARCANE ARCHIVE</span><span>{levelLabel(spell.level)}</span></div></div><div className="card-body"><div className="card-kicker">{levelLabel(spell.level)} <span>·</span> {spell.school || '学派未提供'}</div><div className="card-title"><h3>{name.chinese}</h3><span>↗</span></div><p className="card-english">{name.english || 'Spell'}</p><div className="card-footer"><span>{spell.classes.join(' / ')}</span><span>查看法术 <b>↗</b></span></div></div></button>; })}</div> : <div className="empty"><span>✧</span><h3>没有找到匹配的法术</h3><p>试试其他名称或调整筛选条件。</p><button type="button" onClick={clear}>清除筛选</button></div>}{results.length > pageSize && <div className="pagination"><button type="button" disabled={page === 1} onClick={() => { setPage(page - 1); window.scrollTo(0, 0); }}>← 上一页</button><span>第 {page} / {Math.ceil(results.length / pageSize)} 页</span><button type="button" disabled={page >= Math.ceil(results.length / pageSize)} onClick={() => { setPage(page + 1); window.scrollTo(0, 0); }}>下一页 →</button></div>}</section></div>}</>;
}
