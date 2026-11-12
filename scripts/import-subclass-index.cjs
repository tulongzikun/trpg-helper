// Import only level/name indexes and links; no third-party rule text is redistributed.
const fs=require('node:fs/promises');const cheerio=require('cheerio');
const origin='https://5echm.kagangtuya.top/';
const names={
 '野蛮人':{'berserker':'狂战士道途','wild-heart':'兽心道途','world-tree':'世界树道途','zealot':'狂热者道途'},
 '吟游诗人':{'dance':'舞蹈学院','glamour':'魅心学院','lore':'逸闻学院','valor':'勇气学院'},
 '牧师':{'life':'生命领域','light':'光明领域','trickery':'诡术领域','war':'战争领域'},
 '德鲁伊':{'land':'大地结社','moon':'月亮结社','sea':'海洋结社','stars':'星辰结社'},
 '战士':{'battle-master':'战斗大师','champion':'勇士','eldritch-knight':'奥法骑士','psi-warrior':'灵能武士'},
 '武僧':{'mercy':'命流武者','shadow':'暗影武者','elements':'四象武者','open-hand':'散打武者'},
 '圣武士':{'devotion':'奉献之誓','glory':'荣耀之誓','ancients':'古贤之誓','vengeance':'复仇之誓'},
 '游侠':{'beast-master':'驯兽师','fey-wanderer':'妖精漫游者','gloom-stalker':'幽域追猎者','hunter':'猎人'},
 '游荡者':{'arcane-trickster':'诡术师','assassin':'刺客','soulknife':'魂刃','thief':'盗贼'},
 '术士':{'aberrant':'畸变术法','clockwork':'时械术法','draconic':'龙族术法','wild-magic':'狂野术法'},
 '邪术师':{'archfey':'至高妖精宗主','celestial':'天界宗主','fiend':'邪魔宗主','great-old-one':'旧日支配者宗主'},
 '法师':{'abjurer':'防护师','diviner':'预言师','evoker':'塑能师','illusionist':'幻术师'},
};
async function main(){const results={};const errors=[];for(const [cls,options] of Object.entries(names)){await Promise.all(Object.entries(options).map(async([id,name])=>{try{const folder=cls==='邪术师'?'魔契师':cls;const path=`topics/玩家手册2024/角色职业/${folder}/${name}.htm`;const url=new URL(path,origin);const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const $=cheerio.load(await response.text());const features=[];$('strong,b').each((_,el)=>{const value=$(el).text().replace(/\s+/g,' ').trim();const m=value.match(/^(\d{1,2})\s*级\s*[：:]\s*([^A-Za-z\d\n]+?)(?:\s+[A-Za-z]|$)/);if(m&&Number(m[1])<=20){const feature={level:Number(m[1]),name:m[2].trim()};if(!features.some(f=>f.level===feature.level&&f.name===feature.name))features.push(feature);}});if(!features.some(x=>x.level===3))throw Error('缺少 3 级特性');results[`${cls}:${id}`]={url:url.href,features};}catch(e){errors.push(`${cls}:${id}: ${e.message}`)}}));}if(errors.length||Object.keys(results).length!==48)throw Error(`导入不完整，未覆盖原文件：\n${errors.join('\n')}`);await fs.writeFile('apps/web/src/data/imported-subclass-index.json',JSON.stringify(results,null,2)+'\n');console.log(`已生成 ${Object.keys(results).length} 个子职业的特性索引。`)}main().catch(e=>{console.error(e.message);process.exitCode=1});
