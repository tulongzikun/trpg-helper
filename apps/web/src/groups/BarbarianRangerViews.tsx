import type { CharacterDraft } from '../characters';
import { barbarianState, barbarianWeapons, weaponMasteryError } from '../barbarianFeatures';
import {
  fightingStyleError, rangerFightingStyles, rangerState, rangerWeaponMasteryError, rangerWeapons, druidicWarriorStyle,
} from '../rangerFeatures';
import { updateConfig } from '../barbarianRangerConfig';
import { setEpicBoon } from '../druidPaladinShared.ts';
import {
  berserkerState, wildHeartState, worldTreeState, zealotState,
} from '../barbarianSubclasses';
import {
  beastCompanions, beastMasterState, feyGifts, feyWandererState,
  gloomStalkerState, hunterDefenseOptions, hunterPreyOptions, hunterState,
} from '../rangerSubclasses';

// 野蛮人 + 游侠（职业基础特性与子职业）聚合视图；由 barbarian-ranger 组维护。

const sign = (n: number) => `${n >= 0 ? '+' : ''}${n}`;

function WeaponMasteryEditor({ draft, onChange, level, limit, selected, weapons, error }: {
  draft: CharacterDraft;
  onChange: (d: CharacterDraft) => void;
  level: number;
  limit: number;
  selected: string[];
  weapons: readonly string[];
  error: string | null;
}) {
  const slots = Array.from({ length: limit }, (_, i) => selected[i] ?? '');
  return (
    <>
      <p className="character-help">
        武器精通最多选择 {limit} 种{level >= 4 ? '已熟练武器' : '简易或军用武器'}（{level} 级）。{level < 4 ? '' : ''}名称需与规则书一致，长休后可以更换。
      </p>
      {slots.map((value, index) => (
        <label key={index}>
          武器精通 {index + 1}
          <select
            aria-label={`武器精通 ${index + 1}`}
            value={value}
            onChange={(e) => {
              const next = [...slots];
              next[index] = e.target.value;
              onChange(updateConfig(draft, { weaponMastery: next.filter(Boolean) }));
            }}
          >
            <option value="">暂不选择</option>
            {weapons.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      ))}
      {error && <p className="battle-error">{error}</p>}
    </>
  );
}

function RangerStyleEditor({ draft, onChange }: { draft: CharacterDraft; onChange: (d: CharacterDraft) => void }) {
  const state = rangerState(draft);
  if (!state) return null;
  const error = fightingStyleError(draft);
  const cantrips = state.druidicCantrips;
  const setCantrip = (index: number, value: string) => {
    const next = [cantrips[0] ?? '', cantrips[1] ?? ''];
    next[index] = value;
    onChange(updateConfig(draft, { druidicCantrips: next.filter(Boolean) }));
  };
  return (
    <>
      <label>
        游侠战斗风格
        <select
          aria-label="游侠战斗风格"
          value={state.fightingStyle}
          onChange={(e) => onChange(updateConfig(draft, { fightingStyle: e.target.value, druidicCantrips: e.target.value === druidicWarriorStyle ? cantrips : [] }))}
        >
          <option value="">暂不选择</option>
          {rangerFightingStyles.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      {state.fightingStyle === druidicWarriorStyle && (
        <>
          <p className="character-help">德鲁伊教战士：选择 2 个不重复的德鲁伊戏法，以感知为施法属性。戏法名称请与规则书一致。</p>
          {[0, 1].map((index) => (
            <label key={index}>
              德鲁伊戏法 {index + 1}
              <input
                aria-label={`德鲁伊戏法 ${index + 1}`}
                value={cantrips[index] ?? ''}
                onChange={(e) => setCantrip(index, e.target.value)}
              />
            </label>
          ))}
        </>
      )}
      {error && <p className="battle-error">{error}</p>}
    </>
  );
}

export function BarbarianRangerEditorGroup({ draft, onChange }: { draft: CharacterDraft; onChange: (draft: CharacterDraft) => void }) {
  const barbarian = barbarianState(draft);
  const ranger = rangerState(draft);
  const hunter = hunterState(draft);
  const beast = beastMasterState(draft);
  const fey = feyWandererState(draft);
  return (
    <>
      {barbarian && (
        <section className="character-section">
          <div className="section-label">野蛮人</div>
          <h2>武器精通</h2>
          <WeaponMasteryEditor
            draft={draft}
            onChange={onChange}
            level={barbarian.level}
            limit={barbarian.weaponMastery.limit}
            selected={barbarian.weaponMastery.selected}
            weapons={barbarianWeapons}
            error={weaponMasteryError(draft)}
          />
        </section>
      )}
      {ranger && (
        <section className="character-section">
          <div className="section-label">游侠</div>
          <h2>武器精通与战斗风格</h2>
          <WeaponMasteryEditor
            draft={draft}
            onChange={onChange}
            level={ranger.level}
            limit={ranger.weaponMastery.limit}
            selected={ranger.weaponMastery.selected}
            weapons={rangerWeapons}
            error={rangerWeaponMasteryError(draft)}
          />
          <RangerStyleEditor draft={draft} onChange={onChange} />
          <p className="character-help">
            专精：可对 {ranger.expertiseCount} 项已有技能熟练选择专精；熟练探险家另提供 {ranger.deftExplorer?.languages ?? 0} 门语言，均在技能与语言区域自动校验。
          </p>
        </section>
      )}
      {(barbarian || ranger) && draft.level >= 19 && (
        <section className="character-section">
          <div className="section-label">传奇恩惠</div>
          <h2>传奇恩惠（19 级）</h2>
          <label>
            所选传奇恩惠
            <input
              aria-label="传奇恩惠"
              value={(barbarian ?? ranger)?.epicBoonName ?? ''}
              placeholder="如：真实视觉之恩惠"
              onChange={(e) => onChange(setEpicBoon(draft, e.target.value))}
            />
          </label>
          <p className="character-help">这里只记录恩惠名称；专长效果需自行应用。</p>
        </section>
      )}
      {hunter && (
        <section className="character-section">
          <div className="section-label">猎人</div>
          <h2>猎杀技艺与防守战术</h2>
          <p className="character-help">完成短休或长休后可以更换以下选择；战斗轮内的伤害与减伤效果需手动结算。</p>
          <label>
            猎杀技艺
            <select
              aria-label="猎杀技艺"
              value={hunter.prey}
              onChange={(e) => onChange(updateConfig(draft, { hunterPrey: e.target.value }))}
            >
              <option value="">暂不选择</option>
              {hunterPreyOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>
            防守战术
            <select
              aria-label="防守战术"
              value={hunter.defense}
              onChange={(e) => onChange(updateConfig(draft, { hunterDefense: e.target.value }))}
            >
              <option value="">暂不选择</option>
              {hunterDefenseOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </section>
      )}
      {beast && (
        <section className="character-section">
          <div className="section-label">驯兽师</div>
          <h2>原初行侣数据卡</h2>
          <p className="character-help">长休后可以更换数据卡；更换外形不影响数据。野兽的 AC、生命值、攻击加值与豁免 DC 会按你的等级和感知自动计算。</p>
          <label>
            原初野兽
            <select
              aria-label="原初野兽数据卡"
              value={beast.choice ?? ''}
              onChange={(e) => onChange(updateConfig(draft, { beastCompanion: e.target.value }))}
            >
              <option value="">暂不选择</option>
              {beastCompanions.map((name) => <option key={name} value={name}>{name}原初野兽</option>)}
            </select>
          </label>
        </section>
      )}
      {fey && (
        <section className="character-section">
          <div className="section-label">妖精漫游者</div>
          <h2>精野之赐</h2>
          <p className="character-help">选择或掷 1d6 决定你的妖精祝福，仅影响外观与叙事，不改变数值。</p>
          <label>
            精野之赐
            <select
              aria-label="精野之赐"
              value={fey.gift ?? ''}
              onChange={(e) => onChange(updateConfig(draft, { feyGift: e.target.value ? Number(e.target.value) : undefined }))}
            >
              <option value="">暂不选择</option>
              {feyGifts.map((text, index) => <option key={index + 1} value={index + 1}>{index + 1} · {text}</option>)}
            </select>
          </label>
        </section>
      )}
    </>
  );
}

function BarbarianSheet({ draft }: { draft: CharacterDraft }) {
  const state = barbarianState(draft);
  if (!state) return null;
  const { selected } = state.weaponMastery;
  return (
    <section className="character-section">
      <div className="section-label">野蛮人</div>
      <h2>野蛮人特性</h2>
      <p className="sheet-text">狂暴 {state.rage.uses} 次 · 狂暴伤害 {sign(state.rage.damage)} · 短休恢复 1 次，长休恢复全部 · 持续时间最长 10 分钟</p>
      <p className="sheet-text">武器精通（最多 {state.weaponMastery.limit} 种）：{selected.length ? selected.join('、') : '尚未选择'}</p>
      {state.unarmoredDefense !== null && <p className="sheet-text">无甲防御：AC {state.unarmoredDefense}（10 + 敏捷调整值 + 体质调整值，可持盾；最终 AC 以 DerivedStats 为准）</p>}
      {state.fastMovement && <p className="sheet-text">快速移动：未穿重甲时速度 +10 尺（已计入 DerivedStats 的速度）。</p>}
      {state.feralInstinct && <p className="sheet-text">野性直觉：先攻检定具有优势（战斗轮内生效）。</p>}
      {state.instinctivePounce && <p className="sheet-text">莽驰：进入狂暴时可移动至多一半速度（战斗轮内生效）。</p>}
      {state.brutalStrike && <p className="sheet-text">凶蛮打击：放弃鲁莽攻击的优势，换取 {state.brutalStrike.die} 额外伤害与 {state.brutalStrike.effects} 种效应选项（战斗轮内选择）。</p>}
      {state.relentlessRage && <p className="sheet-text">坚韧狂暴：生命值归零时可进行 DC 10 体质豁免以避免倒地；每次失败后 DC 提高 5（战斗轮内生效）。</p>}
      {state.persistentRage && <p className="sheet-text">持久狂暴：投掷先攻时可重获全部狂暴次数，每次长休一次；狂暴持续 10 分钟。</p>}
      {state.indomitableMight && <p className="sheet-text">不屈勇武：力量检定或力量豁免的总值低于 {state.indomitableMight.floor} 时，改用 {state.indomitableMight.floor}（非常规技能与属性组合需手动处理）。</p>}
      {state.epicBoon && <p className="sheet-text">传奇恩惠：{state.epicBoonName || '尚未记录所选恩惠'}（效果需手动应用）。</p>}
      {state.primalChampion && <p className="sheet-text">原初斗士：力量与体质各 +4，上限 25（已由属性计算自动应用）。</p>}
      <p className="character-help">狂暴的抗性、力量检定与豁免优势、专注限制等只在战斗轮内生效，本清单不自动结算。</p>
    </section>
  );
}

function RangerSheet({ draft }: { draft: CharacterDraft }) {
  const state = rangerState(draft);
  if (!state) return null;
  return (
    <section className="character-section">
      <div className="section-label">游侠</div>
      <h2>游侠特性</h2>
      <p className="sheet-text">宿敌：猎人印记始终准备，可免费施放 {state.favoredEnemyFreeUses} 次/长休 · 猎人印记额外伤害 d{state.huntersMarkDie}</p>
      <p className="sheet-text">武器精通（{state.weaponMastery.limit} 种）：{state.weaponMastery.selected.length ? state.weaponMastery.selected.join('、') : '尚未选择'}</p>
      {state.fightingStyle && <p className="sheet-text">战斗风格：{state.fightingStyle}{state.fightingStyle === druidicWarriorStyle ? `（戏法：${state.druidicCantrips.join('、') || '尚未选择'}）` : ''}</p>}
      {state.roving && <p className="sheet-text">越野：未穿重甲时速度 +10 尺，攀爬与游泳速度等于你的速度（已计入 DerivedStats）。</p>}
      <p className="sheet-text">专精：可选择 {state.expertiseCount} 项已有技能熟练；熟练探险家另提供 2 门语言（在技能与语言区域选择）。</p>
      {state.tireless && <p className="sheet-text">不知疲倦：{state.tireless.uses} 次/长休；魔法动作获得 {state.tireless.tempHp} 临时生命值；短休降低 1 级力竭。</p>}
      {state.relentlessHunter && <p className="sheet-text">永恒追猎：受到伤害不会打断猎人印记的专注（战斗轮内生效）。</p>}
      {state.naturesVeil && <p className="sheet-text">自然面纱：{state.naturesVeil.uses} 次/长休；附赠动作隐形至下一回合结束。</p>}
      {state.preciseHunter && <p className="sheet-text">致命猎杀：对猎人印记目标发动攻击具有优势（战斗轮内生效）。</p>}
      {state.feralSenses && <p className="sheet-text">野性感官：获得 30 尺盲视（已计入 DerivedStats）。</p>}
      {state.foeSlayer && <p className="sheet-text">屠灭众敌：猎人印记的额外伤害从 d6 提升为 d10。</p>}
      {state.epicBoonAvailable && <p className="sheet-text">传奇恩惠：{state.epicBoonName || '尚未记录所选恩惠'}（效果需手动应用）。</p>}
      <p className="character-help">准备法术、法术位与宿敌免费施法次数分别在法术区域和资源区域管理。</p>
    </section>
  );
}

function BarbarianSubclassSheet({ draft }: { draft: CharacterDraft }) {
  const berserker = berserkerState(draft);
  const heart = wildHeartState(draft);
  const tree = worldTreeState(draft);
  const zealot = zealotState(draft);
  return (
    <>
      {berserker && (
        <section className="character-section">
          <div className="section-label">狂战士之途</div>
          <h2>狂战士特性</h2>
          <p className="sheet-text">狂怒：狂暴中用鲁莽攻击首次命中时，额外造成 {berserker.frenzyExtraDie} 伤害。</p>
          {berserker.mindlessRage && <p className="sheet-text">无我狂暴：狂暴中免疫魅惑与恐慌，进入狂暴时可解除自身这些状态。</p>}
          {berserker.retaliation && <p className="sheet-text">报偿：5 尺内生物伤害你后，可用反应对它进行一次近战攻击（战斗轮内生效）。</p>}
          {berserker.intimidatingPresence && <p className="sheet-text">威慑之姿：30 尺光环使敌人感知豁免（DC = 8 + 力量调整值 + 熟练加值），失败恐慌 1 分钟；长休恢复，也可消耗一次狂暴次数重置（次数已记录）。</p>}
        </section>
      )}
      {heart && (
        <section className="character-section">
          <div className="section-label">狂野之心之途</div>
          <h2>狂野之心特性</h2>
          <p className="sheet-text">兽性狂暴：进入狂暴时选择熊、鹰或狼的增益（战斗轮内生效）。</p>
          {heart.aspect && <p className="sheet-text">兽之形貌：{heart.aspect} — {heart.aspectEffects[heart.aspect as keyof typeof heart.aspectEffects]}</p>}
          {heart.wildPower && <p className="sheet-text">兽力威能：进入狂暴时选择 {heart.wildPower.options.join('、')} 之一的增益（战斗轮内生效）。</p>}
          <p className="character-help">仪式法术由「兽心：仪式法术」区域显示；黑暗视觉、攀爬与游泳速度已计入 DerivedStats。</p>
        </section>
      )}
      {tree && (
        <section className="character-section">
          <div className="section-label">世界树之途</div>
          <h2>世界树特性</h2>
          <p className="sheet-text">圣树活力：进入狂暴时获得 {tree.vitalityTempHp} 点临时生命值；狂暴中每回合开始可给 10 尺内另一生物 {tree.lifeGivingDie} 临时生命值。</p>
          <p className="sheet-text">灵树枝杈：30 尺内生物回合开始时，可用反应迫使其力量豁免（DC = 8 + 力量调整值 + 熟练加值），失败被传送（战斗轮内生效）。</p>
          {tree.reachBonus > 0 && <p className="sheet-text">根击千钧：使用重型或多用近战武器时触及 +{tree.reachBonus} 尺，命中后可附加推离或失衡效应（战斗轮内选择）。</p>}
          <p className="sheet-text">世界树之奇旅：进入狂暴时传送 {tree.teleportFt} 尺；狂暴中可用附赠动作再次传送。</p>
          {tree.greaterTeleport && <p className="sheet-text">每场狂暴一次：可传送 {tree.greaterTeleport.ft} 尺，并携带至多 {tree.greaterTeleport.creatures} 名 10 尺内自愿生物。</p>}
        </section>
      )}
      {zealot && (
        <section className="character-section">
          <div className="section-label">狂热者之途</div>
          <h2>狂热者特性</h2>
          <p className="sheet-text">神性之怒：狂暴中每回合首次武器或徒手命中，额外造成 {zealot.divineFury} 光耀或暗蚀伤害。</p>
          <p className="sheet-text">神之勇者：{zealot.healingPoolDice} 枚 d12 治疗骰；附赠动作消耗任意枚恢复生命值，长休恢复全部（次数已记录）。</p>
          {zealot.zealousPresence && <p className="sheet-text">狂热威仪：60 尺内至多 10 名生物攻击与豁免具有优势，持续至你的下一回合开始；长休一次，也可消耗一次狂暴次数重置（次数已记录）。</p>}
          {zealot.rageOfGods && <p className="sheet-text">神之狂暴：狂暴时呈现圣斗士姿态 1 分钟（生命值归零时结束）；长休恢复（次数已记录）。</p>}
          <p className="character-help">专心炽志（每场狂暴一次失败豁免重骰）只在战斗轮内生效，需手动结算。</p>
        </section>
      )}
    </>
  );
}

function RangerSubclassSheet({ draft }: { draft: CharacterDraft }) {
  const beast = beastMasterState(draft);
  const fey = feyWandererState(draft);
  const gloom = gloomStalkerState(draft);
  const hunter = hunterState(draft);
  return (
    <>
      {beast && (
        <section className="character-section">
          <div className="section-label">驯兽师</div>
          <h2>原初行侣</h2>
          {beast.choice ? (
            <>
              <p className="sheet-text">数据卡：{beast.choice}原初野兽 · AC {beast.ac} · 生命值 {beast.hp} · 速度 {beast.speed} · 黑暗视觉 {beast.darkvision} 尺</p>
              <p className="sheet-text">野兽打击：命中 {sign(beast.attackBonus ?? 0)} · 伤害 {beast.strike}（{beast.damageType}） · 法术豁免 DC {beast.spellDc}</p>
              <p className="sheet-text">属性检定与豁免加值：{sign(beast.saveBonus)}（熟练加值）</p>
              {beast.traits.map((text) => <p key={text} className="sheet-text">{text}</p>)}
            </>
          ) : (
            <p className="sheet-text">尚未选择大地、海洋或天空数据卡；选择后此处会显示完整数据卡。</p>
          )}
          <p className="character-help">战斗中野兽默认执行回避动作；命令它行动、复活或替换数据卡需手动处理。{beast.advancedTraining ? '特效训练：命令时它还可附赠动作疾走、撤离、回避或协助，伤害类型可选力场或原类型。' : ''}{beast.bestialFury ? '兽性狂怒：命令野兽打击时可执行两次，并附加猎人印记额外伤害。' : ''}{beast.spellSharing ? '法术共享：施法指定自己且野兽在 30 尺内时，法术同时作用于它。' : ''}</p>
        </section>
      )}
      {fey && (
        <section className="character-section">
          <div className="section-label">妖精漫游者</div>
          <h2>妖精漫游者特性</h2>
          <p className="sheet-text">哀惧灵袭：武器命中额外造成 {fey.dreadfulDie} 心灵伤害，每名目标每回合一次（战斗轮内生效）。</p>
          <p className="sheet-text">妖冶娴都：魅力检定 {sign(fey.otherworldlyGrace)}（感知调整值，至少 +1）；另在欺瞒、表演或游说中选择一项熟练（技能区域）。</p>
          {fey.gift && <p className="sheet-text">精野之赐（{fey.gift}）：{fey.giftText}</p>}
          <p className="sheet-text">妖精漫游者魔法：常备法术由法术区域显示{feystep(draft)}</p>
          {fey.beguilingStrike && <p className="sheet-text">妖思魅缕：对抗或终止魅惑、恐慌的豁免具有优势；并可用反应迫使 120 尺内另一生物进行感知豁免（战斗轮内生效）。</p>}
          {fey.feyReinforcements && <p className="sheet-text">精宸所与：可免材料免费施放妖精召唤术，且可无需专注持续 1 分钟（次数已记录）。</p>}
          {fey.mistyStepFreeUses > 0 && <p className="sheet-text">雾行漫游：免费施放迷踪步 {fey.mistyStepFreeUses} 次/长休，可携带 5 尺内一名自愿生物。</p>}
        </section>
      )}
      {gloom && (
        <section className="character-section">
          <div className="section-label">幽域追猎者</div>
          <h2>幽域追猎者特性</h2>
          <p className="sheet-text">恐惧伏击：战斗首回合速度 +10 尺；先攻加 {sign(gloom.initiativeBonus)}；武器命中可额外造成 {gloom.dreadStrikeDie} 心灵伤害，每回合一次，{gloom.dreadAmbusherUses} 次/长休（次数已记录）。</p>
          <p className="sheet-text">阴影视野：60 尺黑暗视觉；已有黑暗视觉时范围 +60 尺（已计入 DerivedStats）。</p>
          {gloom.ironMind && <p className="sheet-text">钢铁意志：获得感知豁免熟练；若已熟练则改选智力或魅力豁免熟练（豁免区域）。</p>}
          {gloom.stalkersFlurry && <p className="sheet-text">追猎如风：恐惧打击提升为 2d8，并可选择瞬杀或群慌效应（战斗轮内生效）。</p>}
          {gloom.shadowyDodge && <p className="sheet-text">如影随行：可用反应使一次攻击检定具有劣势，随后传送 30 尺（战斗轮内生效）。</p>}
        </section>
      )}
      {hunter && (
        <section className="character-section">
          <div className="section-label">猎人</div>
          <h2>猎人特性</h2>
          <p className="sheet-text">猎人学识：被猎人印记标记期间，可知目标是否有免疫、抗性或易伤及其具体项目。</p>
          <p className="sheet-text">猎杀技艺：{hunter.prey || '尚未选择'} · 防守战术：{hunter.defense || '尚未选择'}</p>
          {hunter.superiorPrey && <p className="sheet-text">高阶猎杀技艺：每回合一次，对印记目标造成伤害时，可对 30 尺内另一可见生物施加印记额外伤害（战斗轮内生效）。</p>}
          {hunter.superiorDefense && <p className="sheet-text">高阶防守战术：受到伤害时可用反应获得该伤害类型抗性至回合结束（战斗轮内生效）。</p>}
        </section>
      )}
    </>
  );
}

function feystep(draft: CharacterDraft): string {
  if (draft.level >= 17) return '，包含 3 环魅惑类人、5 环迷踪步、9 环妖精召唤术、13 环任意门与 17 环假象术。';
  if (draft.level >= 13) return '，包含 3 环魅惑类人、5 环迷踪步、9 环妖精召唤术与 13 环任意门。';
  if (draft.level >= 9) return '，包含 3 环魅惑类人、5 环迷踪步与 9 环妖精召唤术。';
  if (draft.level >= 5) return '，包含 3 环魅惑类人与 5 环迷踪步。';
  return '，当前包含 3 环魅惑类人。';
}

export function BarbarianRangerSheetGroup({ draft }: { draft: CharacterDraft }) {
  return <><BarbarianSheet draft={draft} /><RangerSheet draft={draft} /><BarbarianSubclassSheet draft={draft} /><RangerSubclassSheet draft={draft} /></>;
}
