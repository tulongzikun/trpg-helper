import type { CharacterDraft } from './characters';
import { jumpDistances } from './jumpDistances';
export function JumpDistances({draft}:{draft:CharacterDraft}){
 const options=jumpDistances(draft);if(!options)return null;
 return <div><h3>跳跃距离</h3>{options.map(x=><p className="sheet-text" key={x.ability}>{x.ability}：助跑跳远 {x.longRunning} 尺，原地跳远 {x.longStanding} 尺；助跑跳高 {x.highRunning} 尺，原地跳高 {x.highStanding} 尺。</p>)}<p className="character-help">助跑需在起跳前立即沿地面移动至少 10 尺；跳跃距离消耗移动距离。环境、装备和其他特性可能影响结果。</p></div>;
}
