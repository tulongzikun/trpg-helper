#!/usr/bin/env node
// Import the 2025 bestiary pages. Unparseable blocks are reported, never invented.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const cheerio = require('cheerio');
const Ajv = require('ajv/dist/2020');
const formats = require('ajv-formats');
const common = require('../packages/contracts/schemas/common.schema.json');
const schema = require('../packages/contracts/schemas/monster-entry.schema.json');
const origin = 'https://5echm.kagangtuya.top/';
const outDir = path.resolve(__dirname, '../apps/web/src/data');
const args = process.argv.slice(2);
const getArg = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };
const output = path.resolve(getArg('--output', path.join(outDir, 'imported-monsters.json')));
const reportPath = path.resolve(getArg('--report', path.join(outDir, 'import-report.json')));
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true }); formats(ajv); ajv.addSchema(common);
const valid = ajv.compile(schema);
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const compact = s => (s || '').replace(/\s+/g, ' ').trim();
const rule = { edition:'dnd5e-2024', ruleSetId:'external-mm2025', rulePackVersion:'source-unverified', rulePackHash:'unverified-source-not-a-rule-pack' };
const abilityMap = {'力量':'str','敏捷':'dex','体质':'con','智力':'int','感知':'wis','魅力':'cha'};
async function get(url) { for (let i=0;i<3;i++) { try { const res=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'TRPGHelperImporter/1.0'}}); if(!res.ok) throw Error(`HTTP ${res.status}`); return await res.text(); } catch(e) { if(i===2) throw e; await new Promise(r=>setTimeout(r,500*(i+1))); } } }
function parseBlock($, el, url, index) {
 const root=$(el); const rawTitle=compact(root.find('h5').first().text()); const sub=compact(root.find('.sub-line').first().text());
 const title=rawTitle.replace(/[。．]+$/,'').match(/^([^A-Za-z]+?)\s*([A-Za-z][\s\S]*)?$/); const name=compact(title?.[1] || rawTitle);
 const size=sub.match(/^(超巨型|超大型|超小型|微型|小型|中型|大型|巨型)(?:或(?:超巨型|超大型|超小型|微型|小型|中型|大型|巨型))?/)?.[0];
 const typeText=sub.slice(size?.length || 0).split(/[（(，,]/)[0].trim();
 const types=[...new Set(typeText.match(/异怪|天族|构装|龙类|元素|妖精|邪魔|巨人|类人|怪兽|泥怪|植物|亡灵|野兽/g) || [])];
 const top=compact(root.find('table').first().text());
 const ac=top.match(/AC\s*(\d+)/i)?.[1]; const hp=top.match(/HP\s*(\d+)(?:\s*[（(]([^）)]+)[）)])?/i); const init=top.match(/先攻\s*([+−-]?\d+)/)?.[1];
 const speedText=top.match(/速度\s*(.*)$/)?.[1] || ''; const speeds={};
 for (const m of speedText.matchAll(/(掘穴|攀爬|飞行|游泳|步行)?\s*(\d+)\s*尺/g)) speeds[m[1] || '步行']=Number(m[2]);
 const abilities={}; const saves={};
 root.find('table.stat-abilities tr').each((_,tr)=>{ const cells=$(tr).find('td').toArray(); cells.forEach((cell,i)=>{ const a=abilityMap[compact($(cell).text())]; if(!a) return; const score=compact($(cells[i+1]).text()).match(/^\d+$/); const save=compact($(cells[i+3]).text()).replace('−','-').match(/^[+-]?\d+$/); if(score) abilities[a]=Number(score[0]); if(save) saves[a]=Number(save[0]); }); });
 if (!name || !size || !types.length || !ac || !hp || Object.keys(abilities).length!==6 || !Object.keys(speeds).length) throw Error(`缺少基础字段：${name || '未知'} size=${size} type=${typeText} ac=${ac} hp=${!!hp} abilities=${Object.keys(abilities).length} speed=${speedText}`);
 const block={ id:`mm25-${hash(url+'#'+index).slice(0,20)}`, name, rule, size, creatureTypes:types, armorClass:Number(ac), hitPoints:{average:Number(hp[1])}, abilities, speedFt:speeds, savingThrows:saves, actions:[], sourceText: root.text().replace(/\n[ \t]*/g,'\n').replace(/\n{3,}/g,'\n\n').trim() };
 if(hp[2]) block.hitPoints.dice=hp[2]; if(init) block.initiativeBonus=Number(init.replace('−','-'));
 const rows={}; root.find('table').not('.stat-abilities').find('tr').each((_,tr)=>{ $(tr).find('td').each((__,td)=>{ const strong=$(td).find('strong').first(); const key=compact(strong.text()); if(key) rows[key]=compact($(td).text()).slice(key.length).trim(); }); });
 const crText=rows.CR || root.text().match(/\bCR\s*(?:1\/8|1\/4|1\/2|\d+)[^\n]*/i)?.[0]?.replace(/^CR\s*/i,'') || ''; const cr=crText.match(/^(1\/8|1\/4|1\/2|\d+)/); if(cr) block.challengeRating=cr[1]; const xp=crText.match(/XP\s*([\d,]+)/i); if(xp) block.experiencePoints=Number(xp[1].replace(/,/g,'')); const pb=crText.match(/PB\s*\+?(\d+)/i); if(pb) block.proficiencyBonus=Number(pb[1]);
 for(const [src,dst] of [['感官','senses'],['语言','languages'],['装备','gear'],['抗性','damageResistances'],['易伤','damageVulnerabilities']]) if(rows[src]) block[dst]=[rows[src]];
 if(rows['技能']) { const skills={}; for(const m of rows['技能'].matchAll(/([^，,；;]+?)\s*([+−-]\d+)/g)) skills[compact(m[1])]=Number(m[2].replace('−','-')); if(Object.keys(skills).length) block.skills=skills; }
 let current=null; const sections={'动作':'actions','附赠动作':'bonusActions','反应':'reactions','传奇动作':'legendaryActions','特性':'traits','特质':'traits'};
 root.find('h6,p').each((_,child)=>{ const node=$(child); if(child.tagName==='h6') { const t=compact(node.text()); const key=Object.keys(sections).find(k=>t.startsWith(k)); current=key ? sections[key] : null; return; } if(child.tagName!=='p' || !current) return; const content=node.html() || ''; for(const part of content.split(/<br\s*\/?\s*>/i)) { const p=cheerio.load(`<div>${part}</div>`); const strong=p('strong').first(); const label=compact(strong.text()).replace(/[。．.]$/,''); const text=compact(p('div').text()); if(!label || !text) continue; (block[current] ||= []).push({id:`feature-${hash(url+'#'+index+'#'+current+'#'+text).slice(0,16)}`,name:label,description:compact(text.slice(compact(strong.text()).length)),automation:'manual'}); } });
 return {block, englishName:compact(title?.[2])};
}
function parsePage(html,url) { const $=cheerio.load(html); const blocks=[]; const warnings=[]; $('.stat-block').each((i,el)=>{try {blocks.push(parseBlock($,el,url,i));}catch(e){warnings.push({url,index:i,error:e.message});}}); if(!blocks.length) return {entries:[],warnings,hasBlocks:$('.stat-block').length>0};
 const h=compact($('body h1, body h2').first().text()); const chinese=h.match(/^([^A-Za-z]+?)\s*(?:[A-Za-z]|$)/)?.[1]?.trim() || blocks[0].block.name; const body=$('body'); const paras=body.children('p').toArray().map(p=>compact($(p).text())).filter(Boolean); const meta=compact($('div.HT').first().text()) || paras.find(x=>x.includes('栖息地')) || ''; const habitat=meta.match(/栖息地[：:]\s*([^；;。]+)/)?.[1]; const treasure=meta.match(/宝藏[：:]\s*([^；;。]+)/)?.[1]; const description=paras.filter(x=>!x.includes('栖息地')).join('\n');
 const entry={schemaVersion:'monster-entry/v1',id:`mm25-entry-${hash(url).slice(0,20)}`,revision:1,origin:'builtin',name:chinese,source:{name:'怪物图鉴2025 / 5E不全书',license:'未核实',url},statBlocks:blocks.map(x=>x.block)}; if(blocks[0].englishName) entry.englishName=blocks[0].englishName; if(habitat) entry.habitats=habitat.split(/[，,、]/).map(x=>x.trim()).filter(Boolean); if(treasure) entry.treasure=treasure; if(description) entry.description=description;
 if(!valid(entry)) { warnings.push({url,error:ajv.errorsText(valid.errors)}); return {entries:[],warnings,hasBlocks:true}; } return {entries:[entry],warnings,hasBlocks:true}; }
async function main(){ const toc=await get(new URL('webhelpcontents.htm',origin)); const $=cheerio.load(toc); const links=[...new Set($('a[href]').toArray().map(el=>$(el).attr('href')).filter(h=>{try{const p=decodeURI(h); return p.startsWith('topics/怪物图鉴2025/') && !p.includes('/前言/')}catch{return false}}).map(h=>new URL(h,origin).href))]; const entries=[];const errors=[];let noBlocks=0;let cursor=0; console.log(`发现 ${links.length} 个目录页面，开始检查。`);
 async function worker(){while(cursor<links.length){ const n=cursor++; const url=links[n]; try {const html=await get(url);const result=parsePage(html,url);entries.push(...result.entries);errors.push(...result.warnings);if(!result.hasBlocks) noBlocks++;}catch(e){errors.push({url,error:String(e.message)});} if((n+1)%50===0) console.log(`已处理 ${n+1}/${links.length}`); }} await Promise.all(Array.from({length:4},worker)); entries.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')); const report={source:origin,generatedAt:new Date().toISOString(),pages:links.length,withoutStatBlocks:noBlocks,entries:entries.length,statBlocks:entries.reduce((a,e)=>a+e.statBlocks.length,0),errors}; await fs.mkdir(path.dirname(reportPath),{recursive:true}); await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n'); if(errors.length || !entries.length){ console.error('导入不完整，保留原有数据文件；请查看报告。'); process.exitCode=2; } else { await fs.mkdir(path.dirname(output),{recursive:true}); const temp=output+'.tmp'; await fs.writeFile(temp,JSON.stringify(entries,null,2)+'\n'); await fs.rename(temp,output); } console.log(JSON.stringify({...report,errors:errors.length},null,2)); }
main().catch(e=>{console.error(e);process.exitCode=1});
