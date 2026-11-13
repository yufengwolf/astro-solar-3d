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
import { cosmicVec, COSMIC_LY_PER_KPC } from '../data/cosmic-structures.js';

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
  if (m.dLy) info.距离 = distanceText(m.dLy);
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
    distanceText: m.dLy ? (isEnglish() ? enSpan(m.dLy) : zhSpan(m.dLy, false)) : null,
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

/** 取该结构真实中心邻域内的 2MRS 群，按真实相对位置归一化进画面内圈 */
function realMembersFor(node) {
  // 本星系群页已有 ~90 个真实星系（galaxies.js），宇宙页有视界球 + 超星系团，都不叠加。
  if (node.id === 'localgroup' || node.kind === 'universe') return [];
  if (!['supercluster', 'cluster', 'group'].includes(node.kind)) return [];
  const c = cosmicVec(node.id);
  if (!c) return [];
  // 视野半径取该层尺度，并给小群一个 12 Mpc 下限（2MRS 最近群也在 2 Mpc 外）。
  const radius = Math.max(node.spanLy / COSMIC_LY_PER_KPC, 12000);
  const cand = [];
  for (const g of TWO_MRS_GROUPS) {
    const off = [g.pos[0] - c[0], g.pos[1] - c[1], g.pos[2] - c[2]];
    const d = Math.hypot(off[0], off[1], off[2]);
    if (d > 1e-6 && d <= radius) cand.push({ g, off, d });
  }
  cand.sort((a, b) => a.d - b.d);
  const picked = cand.slice(0, REAL_MEMBER_LIMIT);
  if (!picked.length) return [];
  const maxd = Math.max(...picked.map((p) => p.d), 1);
  const s = 9 / maxd; // 内圈 ±9，导航锚点退到外圈
  return picked.map(({ g, off, d }) => ({
    node: make2mrsMember(g, d),
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
  // 叶子分支页（除主链外的超星系团 / 星系团 / 群）补 2MRS 真实成员
  const realMembers = kids.length ? [] : realMembersFor(node);
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
    const outer = realMembers.length > 0;
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
  // 真实星表成员只给叶子页：主链 / 有下级的页面已有自己的成员，不叠加。
  if (realMembers.length) members.push(...realMembers);
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
    tierFocusId: portrait ? null : (focus?.id ?? (realMembers.length ? null : members[0].node.id)),
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
