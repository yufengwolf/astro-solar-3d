/**
 * 通用「大尺度层级」页面工厂。
 *
 * 一个 cosmos.html 用 ?node=<id> 就能渲染注册表里任意一层，不必为
 * 本星系群、超星系团、宇宙各写一套页面。所有可点击锚点、名字标签、
 * 左侧菜单、信息卡、比例尺档位、上下级跳转，全部由 universe.js 的数据生成。
 *
 * 视觉原则（分尺度，别再一刀切）：
 *   · **上级视野**（宇宙 / 超星系团 / 星系群 / 星系团）：成员一律是「一个点」。
 *     真实直径只决定这个点稍大 / 稍亮 / 什么颜色，身份、类型、直径、
 *     距离、形态全部用文字点出。这是 1000 万光年～930 亿光年视野里的
 *     真实观感，也才看得出宇宙有多空旷。
 *   · **星系自己的页面**（仙女座 / 三角座 / 大小麦哲伦云）：观察尺度已经
 *     就是星系本身，这时按 portraits.js 的参数画出它自己的形态 ——
 *     高倾角黄核暗尘环、絮状多臂青绿电离氢区、不规则棒状，各不相同。
 *     其余星系作为「上级 / 同级」导航锚点退到外围，仍是小点。
 *
 * 将来要给某个星系做更精细的三维，只需在注册表把 url 换成新页面，
 * 导航链路无需改动。
 */
import { starfield } from './shared.js';
import { isEn, t } from '../i18n.js';
import {
  byId, childrenOf, siblingsOf, parentOf, label, href,
  focusChildOf, levelName, detailName, isEnglish, anchorPointSize,
} from '../universe.js';
import { hasPortrait, portraitOf } from '../portraits.js';
import { isStellarSystemNode } from '../data/stellar-orbits.js';
import { makeStellarSystem } from '../stellar-system.js';
import { LG_GALAXIES } from '../data/galaxies.js';
import { TWO_MRS_GROUPS } from '../data/2mrs.js';
import { cosmicVec, cosmicSource, COSMIC_LY_PER_KPC } from '../data/cosmic-structures.js';
import { HCBG_MEMBERS, DEEP_SOURCES, DEEP_BUILD_STATS } from '../data/deep/registry.js';

const fmt = (v) => String(Math.round(v * 100) / 100);

/** 跨度中文化：930 亿光年 / 250 万光年 / 2.2 光年 */
function zhSpan(ly, spaced = true) {
  const gap = spaced ? ' ' : '';
  if (ly >= 1e8) return `${fmt(ly / 1e8)}${gap}亿光年`;
  if (ly >= 1e4) return `${fmt(ly / 1e4)}${gap}万光年`;
  return `${fmt(ly)}${gap}光年`;
}
/** 跨度英文化：93 Gly / 2.5 Mly / 220 ly */
function enSpan(ly) {
  if (ly >= 1e9) return `${fmt(ly / 1e9)} Gly`;
  if (ly >= 1e6) return `${fmt(ly / 1e6)} Mly`;
  if (ly >= 1e3) return `${fmt(ly / 1e3)} kly`;
  return `${fmt(ly)} ly`;
}
export const distanceText = (dLy) => (isEnglish() ? enSpan(dLy) : zhSpan(dLy));

/** 从该层全景跨度生成 6 档比例尺，每档视野缩小 10 倍 */
function makeTiers(spanLy, base = 17, count = 6) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const span = spanLy / Math.pow(10, i);
    out.push({
      label: zhSpan(span),
      short: zhSpan(span, false),
      labelEn: enSpan(span),
      shortEn: enSpan(span),
      spanLy: span,
      // 场景坐标已归一化到 ±base，每档相机距离同比缩小 10 倍，
      // 与银河系页 SCALE_TIERS 的 17 / 1.7 / 0.17 … 完全同一套机制。
      radiusKpc: base / Math.pow(10, i),
    });
  }
  return out;
}

/** 菜单/信息卡里给某个成员自动挑一个合适的比例尺档位 */
function tierFor(dLy, span) {
  if (!dLy) return 0;
  const ratio = span / Math.max(dLy, 1);
  return Math.max(0, Math.min(5, Math.floor(Math.log10(ratio))));
}

/**
 * 上层结构的形状：宇宙是网、拉尼亚凯亚是引力流域、室女座是中心团、
 * 其余是稀疏空洞。避免几个上层页共用同一张「长得一样」的纤维图。
 */
function fieldShape(node) {
  if (node.id === 'universe') return 'web';
  if (node.id === 'laniakea') return 'flow';
  if (node.id === 'virgo') return 'cluster';
  if (node.kind === 'supercluster') return 'web';
  return 'void';
}

function anchorDef(m, node, navGroup, pos, isFocus, navMode = false) {
  const en = isEn();
  const brief = en ? m.briefEn : m.briefZh;
  const info = {
    类型: `${levelName(m.kind)} · ${detailName(m.detail)}`,
    尺度: en ? m.scaleEn : m.scaleZh,
    简介: brief,
  };
  // deriveCosmicPositions() 把每层的「焦点」子节点放在原点，于是这些节点
  // 相对父页中心的 dLy = 0（拉尼亚凯亚 / 室女座 / 本星系群都属此类）。
  // 但它们在 COSMIC_REAL 里其实有真实的「到银河系距离」；不补上，菜单里
  // 这几行就没有光年数字，看起来像「没有大小」。这里把真实测距补回来。
  const src = m.dLy ? null : cosmicSource(m.id);
  const realLy = src?.distMpc > 0 ? src.distMpc * 1000 * COSMIC_LY_PER_KPC : 0;
  const shownLy = m.dLy || realLy;
  // distMpc=0 的结构就是「我们所在」（本星系群）：没有距离可写，但也不能
  // 留一行空白，否则在菜单里又像是数据缺失。
  const isHere = !shownLy && src?.distMpc === 0;
  if (shownLy) {
    info.距离 = distanceText(shownLy) + (realLy && !m.dLy ? (en ? ' (from the Milky Way)' : '（到银河系）') : '');
  } else if (isHere) {
    info.距离 = en ? 'we are inside it' : '我们就在其中';
  }
  // 有形态配置的星系：信息卡里用一句话点出它长什么样，
  // 这样在上级页「点」的旁边也有可辨识的文字说明。
  const morph = portraitOf(m.id);
  if (morph) info.形态 = en ? morph.morphEn : morph.morphZh;

  // 点化：尺寸 / 亮度 / 背景结点密度全由真实直径相对本层跨度决定
  const v = anchorPointSize(m, node.spanLy);
  const noteSpan = en ? enSpan(m.spanLy) : zhSpan(m.spanLy, false);

  // 行星 / 恒星系统（system 类）在宇宙尺度下本就是亚像素级，绝不该发光成
  // 一颗「恒星亮点」——否则本星系群 / 上层结构的 cosmo 退化页（如
  // cosmos.html?node=milkyway）会冒出带「太阳系」标签的亮黄白点。
  // 降级为暗弱小锚点：保留可点击热区与信息卡，但去掉光晕、压低亮度与尺寸。
  const isSys = m.kind === 'system';

  return {
    id: m.id,
    name: label(m),
    nameEn: m.en,
    navGroup: en ? ({ 下级层级: 'Child levels', 上级层级: 'Parent level', 同级层级: 'Sibling levels', 真实成员: 'Catalog members' }[navGroup] ?? navGroup) : navGroup,
    star: true,
    noStarGlow: isSys,
    // fixedSize 必须给：applyScale() 对每个天体都会重算 def.size，
    // 没有 fixedSize 就按「无 realRadiusKm 的参考天体」兜成默认 6.4 场景单位，
    // 那会直接把每个星系画成横跨几百像素的大白球。size 同时给，供 createBody 用。
    fixedSize: v.fixedSize,
    size: isSys ? Math.min(v.size, 0.045) : v.size,
    glowSize: isSys ? 0 : (isFocus ? v.glowSize * 1.15 : v.glowSize),
    starBoost: v.starBoost,
    weight: v.weight,
    pickSize: 0.62,                  // 纯交互热区，不影响画面尺寸
    labelNote: `${levelName(m.kind)} · ${noteSpan}`,
    labelColor: m.accent,
    galaxyPos: pos,
    // 肖像页的外围锚点是「导航入口」，不是这个尺度里的真实成员，
    // dLy 归零才不会被 updateTierVisibility 按距离过滤掉。
    dLy: navMode ? 0 : (m.dLy ?? 0),
    // 层级页锚点按真实坐标归一化进画面，是「宇宙地图上的导航点」而非物理天体：
    // 可见性由视锥收口，不该再按 dLy 距离窗口过滤（否则可观测宇宙页 span 达
    // 930 亿光年，近邻超星系团的真实距离全落在下限之下，扩充的成员会集体消失）。
    navAnchor: true,
    tier: navMode ? 0 : tierFor(m.dLy ?? 0, node.spanLy),
    color: m.color ?? 0xffffff,
    childSystem: href(m),
    childSystemLabel: label(m),        // 信息卡按钮：完整目标名
    childSystemShort: t('childGoShort'), // 左侧菜单：短标签，别把天体名挤成省略号
    // 菜单里的距离用紧凑写法，给名字腾出空间；信息卡仍用带空格的完整写法
    distanceText: shownLy
      ? (isEnglish() ? enSpan(shownLy) : zhSpan(shownLy, false))
      : (isHere ? (isEnglish() ? 'here' : '我们在此') : null),
    info,
  };
}

/**
 * 把本星系群星表里「没有独立页面」的成员（绝大多数为矮星系）包成一个
 * 注册表节点形状的虚拟对象，供 anchorDef 直接消费：有坐标、有名字、有资料，
 * 但没有 url —— href() 返回 null，信息卡只展示资料、不出现「进入」按钮。
 */
function makeLocalGroupMember(g) {
  return {
    id: g.id, zh: g.zh, en: g.en,
    kind: 'galaxy', detail: 'planned',
    spanLy: g.spanLy, dLy: g.dLy,
    accent: g.accent, color: g.color,
    briefZh: g.briefZh, briefEn: g.briefEn,
  };
}

/**
 * 本星系群页成员：来自真实坐标星表（~90 个成员），不再使用手写定性 pos。
 * 与注册表对应的 5 个主星系（银河系/仙女座/三角座/大小麦哲伦云）走真实节点
 * 以保留独立页面与深链；其余矮星系走虚拟节点。
 */
function localGroupMembers(node, kids, focus) {
  const major = new Map(kids.map((k) => [k.id, k]));
  const out = [];
  for (const g of LG_GALAXIES) {
    const reg = major.get(g.id);
    if (reg) {
      out.push({ node: reg, group: '下级层级', pos: g.pos.slice(0, 3), focus: g.id === focus?.id });
    } else {
      out.push({ node: makeLocalGroupMember(g), group: '下级层级', pos: g.pos.slice(0, 3), focus: false });
    }
  }
  return out;
}

// ── 2MRS 真实星系群成员 ────────────────────────────────────────────────
// 上层结构里除「拉尼亚凯亚 → 室女座 → 本星系群」这条主链外的分支，原先在
// NODES 树里都是叶子：点进去只有「上级 + 同级」导航锚点，没有任何属于该结构
// 自己的天体，看起来就是空白页。这里用 2MRS 群表（Lambert et al. 2020，
// 3022 个真实星系群，含 l/b + 实测共动距离）为每个叶子页补上真实成员：
// 按该结构真实三维中心取邻域内最近的若干群，照 makeLocalGroupMember 的
// 「虚拟成员」范式生成（无 url → 只弹信息卡、不跳转），不新增点云。
const REAL_MEMBER_LIMIT = 18;
const MPC_TO_WAN_LY = 326.156; // 1 Mpc = 3.26156 Mly = 326.156 万光年

function make2mrsMember(g, dKpc) {
  const alias = g.alias ? ` · ${g.alias}` : '';
  const rich = g.m200 >= 50;
  const t = Math.min(1, Math.log10(1 + g.m200) / 3);
  const mix = (a, b) => Math.round(a + (b - a) * t);
  const color = (mix(0x8f, 0xff) << 16) | (mix(0xa8, 0xd0) << 8) | mix(0xd0, 0x8a);
  const spanLy = Math.max(g.r200, 0.1) * 2 * MPC_TO_WAN_LY * 1e4;
  const dLy = dKpc * COSMIC_LY_PER_KPC;
  const nmem = g.ncat || g.nmem;
  return {
    id: `2mrs-${g.id}`,
    zh: `${rich ? '2MRS 星系团' : '2MRS 星系群'} ${g.id}${alias}`,
    en: `${rich ? '2MRS cluster' : '2MRS group'} ${g.id}${alias}`,
    kind: rich ? 'cluster' : 'group', detail: 'planned',
    spanLy, dLy,
    color, accent: `#${color.toString(16).padStart(6, '0')}`,
    scaleZh: `直径约 ${(spanLy / 1e6).toFixed(1)} 百万光年`,
    scaleEn: `~${(spanLy / 1e6).toFixed(1)} million light-years across`,
    briefZh: `2MRS 星系群表实测：${nmem} 个成员星系，视向速度 ${g.v} 公里/秒，共动距离约 ${(g.distMpc * MPC_TO_WAN_LY).toFixed(0)} 万光年，维里半径约 ${(g.r200 * MPC_TO_WAN_LY).toFixed(0)} 万光年。位置由真实银道坐标与实测距离派生，非示意摆放。`,
    briefEn: `Measured by the 2MRS group catalog: ${nmem} member galaxies, V_cmb ${g.v} km/s, comoving distance ${g.distMpc} Mpc, R200 ${g.r200} Mpc. Position derived from real Galactic coordinates and a measured distance.`,
  };
}

/**
 * 取该结构真实中心邻域内的 2MRS 群，按真实相对位置归一化进画面内圈。
 *
 * 这里**不能**只给叶子页补：universe → laniakea → virgo → localgroup 这条
 * 主链每层都有下级节点，旧写法按「有没有子节点」一刀切跳过真实成员，
 * 会把整条主链全部排除，导致「只有旁支有 2MRS、我们的链路空荡荡」。
 * 2MRS 覆盖到约 283 Mpc，拉尼亚凯亚与室女座都在巡天范围内，数据完全够用。
 *
 * @returns {{list: object[], cloud: object|null}} list 是菜单/信息卡的虚拟成员
 *   锚点；cloud 是「同一局部体积内的 Table 3 全量成员星系」点云配置，交给
 *   main.js 渲染，让页面真正用上 17262 颗成员星系而不只是 18 个群的名字。
 */
function realMembersFor(node, hasKids) {
  // 本星系群页已有 ~90 个真实星系（galaxies.js），宇宙页有视界球 + 超星系团，都不叠加。
  if (node.id === 'localgroup' || node.kind === 'universe') return { list: [], cloud: null };
  if (!['supercluster', 'cluster', 'group'].includes(node.kind)) return { list: [], cloud: null };
  const c = cosmicVec(node.id);
  if (!c) return { list: [], cloud: null };
  // 视野半径取该层尺度，并给小群一个 12 Mpc 下限（2MRS 最近群也在 2 Mpc 外）。
  const radius = Math.max(node.spanLy / COSMIC_LY_PER_KPC, 12000);
  const cand = [];
  for (let gi = 0; gi < TWO_MRS_GROUPS.length; gi++) {
    const g = TWO_MRS_GROUPS[gi];
    const off = [g.pos[0] - c[0], g.pos[1] - c[1], g.pos[2] - c[2]];
    const d = Math.hypot(off[0], off[1], off[2]);
    if (d > 1e-6 && d <= radius) cand.push({ g, gi, off, d });
  }
  cand.sort((a, b) => a.d - b.d);
  const picked = cand.slice(0, REAL_MEMBER_LIMIT);
  if (!picked.length) return { list: [], cloud: null };
  const maxd = Math.max(...picked.map((p) => p.d), 1);
  // 主链页还有下级导航锚点（分布在 ±13），真实成员收进更小的内圈避免互相压住。
  const inner = hasKids ? 6.2 : 9;
  const s = inner / maxd;
  return {
    list: picked.map(({ g, off, d }) => ({
      node: make2mrsMember(g, d),
      group: '真实成员',
      pos: off.map((v) => v * s),
      focus: false,
    })),
    // 点云只画「这 18 个群各自的成员星系」，不是「以中心为球心、maxd 为半径
    // 的球」——后者会把离中心最近的 N 个群自动围成一个球壳，正是被投诉过的
    // 「点形成的球体」。按群索引筛选则自然呈现为 18 个方向上的真实团块。
    cloud: { center: c, groupIdx: picked.map((p) => p.gi), scale: s },
  };
}

// ── 深度星表：按层级叠加真实三维点云 ──────────────────────────────────
// 与 2MRS 的点云不同，这里叠的是各星表**全量**入别的实测三维位置：
//   · CF4   实测距离模数 DM + 银道坐标（55,874 星系，到 z≈0.1）
//   · 2M++  Vcmb 红移距离 + 赤道坐标（69,160 真实星系）
//   · HCBG  GRB 光谱红移 → 共动距离（357 个 z 最高到 6.7）
// 每页只按「该结构真实中心 + 本层跨度」取局部体积，不做「最近 N 个」——
// 后者会把离中心最近的点自动围成球壳，正是被反复投诉的「点形成的球体」。
const DEEP_SURVEY_REACH_KPC = 600000; // ~600 Mpc，CF4 / 2M++ 的覆盖上限

function deepCloudsFor(node, inner) {
  if (node.kind === 'universe' || node.id === 'localgroup') return [];
  const c = cosmicVec(node.id);
  if (!c) return [];
  const radiusKpc = Math.max(node.spanLy / COSMIC_LY_PER_KPC * 0.5, 12000);
  const scale = inner / radiusKpc;
  const base = { center: c, scale, maxKpc: radiusKpc };
  if (node.id === 'hcbg') {
    // 357 个 GRB 是覆盖全天、跨越全红移（z≈0.006–9.4）的示踪样本，不能用
    // 「以结构中心为球心、固定半径」去筛（那样只剩 6 个）。必须按真实绝对坐标
    // 整体渲染：scale 把最远 GRB（共动 ~9.52 Gpc）映射到 inner 单位，结构中心
    // 落在约一半处；真实成员锚点（hcbgMembersFor）用的是同一套绝对坐标，二者重合。
    return [{ id: 'hcbg', native: true, maxPoints: 4000, opacity: 0.85, size: 1.6,
              scale: inner / 9.52e6 }];
  }
  if (Math.hypot(...c) > DEEP_SURVEY_REACH_KPC) return [];
  return [
    { ...base, id: 'cf4', maxPoints: 3600, opacity: 0.62, size: 1.2 },
    { ...base, id: '2mpp', maxPoints: 3600, opacity: 0.46, size: 1.0 },
  ];
}

/** HCBG 页的真实成员：发现这堵长城时所用的 GRB 红移样本 */
function hcbgMembersFor(node, inner) {
  if (node.id !== 'hcbg') return [];
  const c = cosmicVec(node.id);
  if (!c) return [];
  // 优先取 1.6 ≤ z < 2.1 这一红移切片（论文里成团的那一批），再按到结构
  // 中心的真实三维距离排序。全部位置都来自实测 RA/Dec/z，没有示意摆放。
  const slice = HCBG_MEMBERS.filter((g) => g.z >= 1.6 && g.z < 2.1);
  const pool = (slice.length >= 8 ? slice : HCBG_MEMBERS);
  const ranked = pool
    .map((g) => ({
      g, off: [g.pos[0] - c[0], g.pos[1] - c[1], g.pos[2] - c[2]],
      d: Math.hypot(g.pos[0] - c[0], g.pos[1] - c[1], g.pos[2] - c[2]),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 18);
  if (!ranked.length) return [];
  const maxd = Math.max(...ranked.map((r) => r.d), 1);
  const s = inner / maxd;
  return ranked.map(({ g, off, d }) => ({
    node: {
      id: `grb-${g.id}`,
      zh: `伽马射线暴 ${g.id}`,
      en: `GRB ${g.id}`,
      kind: 'group', detail: 'planned',
      spanLy: 1e6, dLy: g.dMpc * 3.26156e6,
      color: 0xff8fa8, accent: '#ff8fa8',
      scaleZh: `红移 z = ${g.z.toFixed(3)}`,
      scaleEn: `redshift z = ${g.z.toFixed(3)}`,
      briefZh: `Horváth et al. (2015) 的 GRB 红移样本：赤道坐标 RA ${g.ra.toFixed(2)}° / Dec ${g.de.toFixed(2)}°，光谱红移 z=${g.z.toFixed(3)}，T90 ${g.t90.toFixed(1)} 秒，共动距离约 ${(g.dMpc / 1000).toFixed(2)} Gpc。这类高红移伽马射线暴是武仙－北冕座长城的示踪天体；该结构本身的存在性仍有争议。`,
      briefEn: `GRB from the Horváth et al. (2015) redshift sample: RA ${g.ra.toFixed(2)}°, Dec ${g.de.toFixed(2)}°, z=${g.z.toFixed(3)}, T90 ${g.t90.toFixed(1)} s, comoving distance ${(g.dMpc / 1000).toFixed(2)} Gpc. High-z GRBs trace the putative Hercules–Corona Borealis Great Wall, whose existence remains debated.`,
    },
    group: '真实成员',
    pos: off.map((v) => v * s),
    focus: false,
  }));
}

/**
 * @param {string} nodeId 注册表节点 id
 * @returns {object} main.js 的 start() 可直接消费的 system 配置
 */
export function makeCosmosSystem(nodeId) {
  // AU 级恒星系统也走这条通用层级通道，但画面内容完全不同：不是一堆层级
  // 锚点，而是两颗按真实六根数绕共同质心互绕的恒星（可带环双星行星）。
  // 委托给独立工厂，避免把轨道数学塞进层级页面生成器。
  if (isStellarSystemNode(nodeId)) {
    return makeStellarSystem(nodeId, { background: starfield });
  }
  const node = byId(nodeId) ?? byId('universe');
  const kids = childrenOf(node.id);
  const parent = parentOf(node.id);
  const sibs = siblingsOf(node.id);
  const focus = focusChildOf(node.id);
  const portrait = hasPortrait(node.id) ? portraitOf(node.id) : null;

  // 有子节点：画面里就是这些下级成员（本星系群页显示银河系/仙女座…）。
  // 叶子节点：把「上级 + 同级」摆成可点的导航锚点，任何一层都能继续走。
  // 肖像页：中心留给星系本体，导航锚点整体退到外围，不压在盘面上。
  // 所有上层结构页（含主链的拉尼亚凯亚 / 室女座）都补 2MRS 真实成员，
  // 不再按「有没有子节点」一刀切。
  const { list: realMembers, cloud: twoMrsCloud } = realMembersFor(node, kids.length > 0);
  // 武仙－北冕座长城在 2MRS / CF4 / 2M++ 的巡天范围之外（z≈1.8），
  // 它的成员只能来自发现它时用的 GRB 红移样本，不能拿近邻星系硬凑。
  const allRealMembers = [...realMembers, ...hcbgMembersFor(node, 6.2)];
  const deepClouds = deepCloudsFor(node, kids.length ? 6.2 : 9);
  // 层级导航锚点（上级 / 焦点下级 / 同级）始终渲染——这是「拉尼亚凯亚 → 室女座 →
  // 本星系群 → 银河系 → 太阳系」主链能在场景内逐层点进去的依据。成员节点的 pos
  // 已由 deriveCosmicPositions() 用 COSMIC_REAL 真实坐标派生，所以即便页面同时叠加
  // 了真实点云，这些锚点也落在真实几何位置上，不会像早期手写坐标那样飘在数据球外。
  // （真实点云本身仍照常叠加，见下方 allRealMembers 与 deepClouds。）
  const members = [];
  if (node.id === 'localgroup' && !portrait) {
    // 真实坐标重建：成员来自本星系群星表，位置用真实三维坐标
    members.push(...localGroupMembers(node, kids, focus));
  } else if (portrait) {
    if (parent) {
      members.push({ node: parent, group: '上级层级', pos: [0, 7.4, -13.6], focus: true });
    }
    sibs.forEach((s, i) => {
      const ang = (i / Math.max(1, sibs.length)) * Math.PI * 2 + 0.75;
      const r = 13.8 + (i % 3) * 1.35;
      members.push({
        node: s, group: '同级层级',
        pos: [Math.cos(ang) * r, ((i % 3) - 1) * 2.4, Math.sin(ang) * r],
        focus: false,
      });
    });
  } else if (kids.length) {
    // 仅「无真实点云」的上层页（可观测宇宙）才把下级结构画成示意星点
    for (const k of kids) {
      members.push({
        node: k,
        group: '下级层级',
        pos: (k.pos ?? [0, 0, 0]).slice(0, 3),
        focus: k.id === focus?.id,
      });
    }
  } else {
    // 有真实成员时，导航锚点整体退到外圈，把画面中心留给该结构自己的天体
    const outer = allRealMembers.length > 0;
    if (parent) {
      members.push({ node: parent, group: '上级层级', pos: outer ? [0, 6, -14] : [0, 0, 0], focus: !outer });
    }
    sibs.forEach((s, i) => {
      const ang = (i / Math.max(1, sibs.length)) * Math.PI * 2 + 0.5;
      const r = (outer ? 13.4 : 5.5) + (i % 3) * 1.6;
      members.push({
        node: s, group: '同级层级',
        pos: [Math.cos(ang) * r, ((i % 3) - 1) * 0.8, Math.sin(ang) * r],
        focus: false,
      });
    });
  }
  // 真实星表成员：主链 / 分支页 / 长城页都补，不再按「有没有子节点」一刀切。
  if (allRealMembers.length) members.push(...allRealMembers);
  // 兜底：至少有一个天体，否则 applyScale / fitCamera 会取不到参考天体
  if (!members.length) {
    members.push({ node, group: '下级层级', pos: [0, 0, 0], focus: true });
  }

  const bodies = members.map((m) => anchorDef(
    m.node, node, m.group, m.pos, m.focus, Boolean(portrait),
  ));
  const kindsWeb = node.kind === 'universe' || node.kind === 'supercluster';
  const fieldKind = node.kind === 'system' ? 'group' : node.kind;
  const base = portrait ? 15 : 17;

  return {
    id: `cosmos-${node.id}`,
    label: label(node),
    universeNodeId: node.id,
    hasSun: false,
    background: starfield,
    extent: base,
    // 星系形态页只保留**一个全景档**：每档把相机拉近 10× 会把盘面贴图
    // 放大糊满屏，再往里 10⁵ 倍任何有限点云都撑不住、整屏空白。这套 6 档
    // 是给银河系页「从星系尺度一路走到邻近恒星」用的；形态页保留单档可让
    // 菜单点击沿用 applyTier 的等距飞行，滚轮到边界仍按注册表上浮回本星系群。
    scaleTiers: makeTiers(node.spanLy, base, portrait ? 1 : 6),
    sunPos: [0, 0, 0],
    // 肖像页的小档焦点必须留在星系中心；否则会飞到外围的「上级」锚点上。
    // 有真实星表成员的叶子页，焦点留在画面中心（结构本身），别飞到外圈的「上级」锚点
    tierFocusId: portrait ? null : (focus?.id ?? (allRealMembers.length ? null : members[0].node.id)),
    timeScale: 0,
    portraitCaption: portrait
      ? `${t('morphLabel')} · ${isEnglish() ? portrait.morphEn : portrait.morphZh}\n`
        + `${t('viewLabel')} · ${distanceText(node.spanLy)}`
      : null,
    galaxy: {
      kind: portrait ? 'void' : fieldKind,
      // 上层层级页（宇宙/超星系团/星系团/本星系群/星系/恒星系统）绝不渲染
      // HYG 星场与 OpenNGC 深空点云——那些是「太阳系周边恒星球」，尺度错乱。
      // 点云只在银河系本地星场页（src/systems/galaxy.js）出现。
      catalogs: false,
      shape: fieldShape(node),
      seed: node.seed ?? 7,
      pointSize: kindsWeb ? 0.22 : 0.15,
      scaleKpc: 1,
      rotateSpeed: 0,          // 大尺度结构不该自转，否则小档会漂走
      glow: false,             // 银盘柔光不适用于宇宙网 / 星系肖像
      diskRadiusKpc: 15,
      radius: portrait ? 22 : 15,
      // 可观测宇宙专属：以观察者为中心、半径约 465 亿光年的「视界球」——
      // 用一层星点球壳表示边界，球内体积填充稀薄场星系；星系团/超星系团在球内按真实大尺度结构分布。
      shell: node.kind === 'universe',
      // Table 3 全量成员星系点云：只在有 2MRS 邻域的上层结构页启用，
      // 坐标为「相对该结构真实中心」的实测银道系位置，不是太阳周边恒星。
      twoMrs: twoMrsCloud,
      // 深度星表点云：CF4 / 2M++ / HCBG GRB，按本层真实中心与跨度取局部体积。
      // 每项自带按需加载的模块 id，非本页不下载对应数据分包。
      deepClouds,
      // 点云源 + 两个「非点云」源也要让用户看得见：NED-D 是距离汇编（按
      // Galaxy ID 聚合后供信息卡交叉），HyperLEDA 按 PGC 给 CF4 星系补形态。
      dataSources: [
        ...deepClouds.map((c) => DEEP_SOURCES[c.id].label),
        ...(deepClouds.length ? [
          `NED-D ${DEEP_BUILD_STATS['ned-d'].measurements.toLocaleString('en-US')} 次独立测距`,
          `HyperLEDA ${DEEP_BUILD_STATS.hyperleda.rows.toLocaleString('en-US')} 个 PGC 星系（形态交叉 ${DEEP_BUILD_STATS.hyperleda.matchedCF4.toLocaleString('en-US')}）`,
        ] : []),
      ],
      // 背景点云只用锚点做「纤维汇聚 / 暗弱伴星系」的分布依据，
      // 不再把成员画成团块；颜色与密度按成员自身数据差异化。
      anchors: bodies.map((b) => ({ pos: b.galaxyPos, color: b.color, weight: b.weight })),
      // 只有星系自己的页面才画形态
      portrait: portrait ? node.id : null,
    },
    camera: {
      position: portrait ? [0, 0.22, 1] : [0, 0.62, 1],
      target: [0, 0, 0],
      frameTo: 'auto',
    },
    scale: {},
    bodies,
  };
}
