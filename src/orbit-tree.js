/**
 * 层级轨道树 → 可渲染天体定义的纯函数展开器。
 *
 * 只做数学与数据转换，不碰 DOM / Three.js，Node 自检可直接 import。
 * 渲染走 main.js 每帧循环：bodies.js 的 solveKepler / orbitPoint +
 * createBody 的 group(Ω) → plane(i, ω) → mesh 层级。
 *
 * ── 每一层都是真互绕 ─────────────────────────────────────────────
 * 对任意一层 pair，相对轨道 r = r2 − r1 是焦点在该层质心的开普勒椭圆：
 *   r1 = −(m2/M)·r,  r2 = +(m1/M)·r  （M = m1 + m2）
 * 于是 a1 = a_rel·m2/M、a2 = a_rel·m1/M，e / i / Ω / P 完全相同，
 * ω 相差 180°，任意时刻 m1·r1 + m2·r2 = 0。
 * 若某个成员本身是子系统，m_i 取该子系统全部恒星质量之和；其质心
 * 在这一层按同样规则运动，子系统内部再独立互绕。层级系统的标准近似，
 * 要求 a_outer / a_inner 足够大（本目录各层都 > 10）。
 *
 * ── 惯性系：子层的轨道面不能被父层带着转 ─────────────────────────
 * 真实的多层轨道要素都在同一个天球参考系里测量，不是相对父轨道面。
 * main.js 因此把每个成员挂到一个**无旋转**的 childFrame，frame 每帧被
 * 设成父质心的世界坐标；成员自己的 group/plane 再施加本层的 Ω / i / ω。
 * 展开器给所有非根节点标 inertialParent:true 来启用这条路径。
 *
 * ── 跨层显示压缩（关键取舍，界面必须标注） ────────────────────────
 * 北河二内层 0.018 AU、最外层 1130 AU，相差 6 万倍；严格线性同屏时
 * 内层必然缩成一个像素。展开器按**深度**给一个统一显示尺度：深度 d
 * 的所有 pair 都显示成 rootAU·levelRatio^d（同一层的两条轨道共享系数，
 * 因此层内质量比、偏心率、近远星距全部保持真实；层内物理比值也在
 * 同一层内保留）。只有跨深度的绝对间距被压缩，且每层压缩倍数在信息卡
 * 里逐条写出。物理根数原样保留在 aAU / info，?scale=real 可一键切回
 * 严格线性。压缩只影响 view，绝不写回数据。
 *
 * ── 相位起点 ────────────────────────────────────────────────────
 * 每层用自己的 T0（近星点通过历元）与当前日期算 M0，页面一打开就
 * 是该层此刻应有的真实相位，而不是每次从近星点重新开始。
 */

import {
  DAYS_PER_YEAR, nodeMass, countStars, walkPairs,
} from './data/stellar-orbits.js';

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;

/** 当前公历时刻 → 儒略年小数（J2000.0 = 2451545.0 JD） */
export function julianYearFromDate(date = new Date()) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  return 2000 + (jd - 2451545.0) / DAYS_PER_YEAR;
}

/** 归一到 [0, 2π)，避免大 M 让牛顿迭代初值离解太远 */
export function normalizeAngle(rad) {
  return ((rad % TAU) + TAU) % TAU;
}

/** 解开普勒方程 M = E − e·sin E（与 bodies.js 同一套牛顿迭代） */
export function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 6; i++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

/** 焦点坐标系下的轨道位置；近日点在 +x，故近日点附近速度最大 */
export function orbitPoint(a, e, E) {
  const b = a * Math.sqrt(Math.max(0, 1 - e * e));
  return { x: a * (Math.cos(E) - e), z: b * Math.sin(E) };
}

/**
 * 把轨道面内的 (x,0,z) 旋转到全局惯性系。
 * 与 createBody 的变换链严格一致：group.rotation.y=Ω →
 * plane.rotation.x=i、plane.rotation.y=ω，即 R = Ry(Ω)·Rx(i)·Ry(ω)。
 * 自检与调试用它验证层级质心，渲染层仍用 Three.js 的矩阵。
 */
export function orbitalOffset(orbit, p) {
  const w = (orbit.argPeri ?? 0) * DEG;
  const i = (orbit.inc ?? 0) * DEG;
  const o = (orbit.node ?? 0) * DEG;
  // Ry(w)
  let x = p.x * Math.cos(w) + p.z * Math.sin(w);
  let y = 0;
  let z = -p.x * Math.sin(w) + p.z * Math.cos(w);
  // Rx(i)
  const y2 = y * Math.cos(i) - z * Math.sin(i);
  const z2 = y * Math.sin(i) + z * Math.cos(i);
  y = y2; z = z2;
  // Ry(o)
  const x3 = x * Math.cos(o) + z * Math.sin(o);
  const z3 = -x * Math.sin(o) + z * Math.cos(o);
  return { x: x3, y, z: z3 };
}

/** 由近星点历元与当前时刻求平近点角 M0（弧度，已归一） */
export function meanAnomalyAt(orbit, nowYear = julianYearFromDate()) {
  const days = (nowYear - orbit.epochYear) * DAYS_PER_YEAR;
  return normalizeAngle((TAU * days) / orbit.periodDays);
}

/** 质心分解：返回两成员各自绕质心的半长轴 */
export function barycentricSplit(aRel, m1, m2) {
  const M = m1 + m2;
  if (!(M > 0)) throw new Error('质量必须为正');
  return { a1: (aRel * m2) / M, a2: (aRel * m1) / M, ratio: m2 / m1, total: M };
}

/**
 * 验证一对互绕在给定时刻的质心守恒（局部轨道面坐标系）。
 * 返回 { r1, r2, barycentre, separation, ok }，供自检与调试使用。
 */
export function pairStateAt(el, tDays = 0, aRel = el.aRel, e = el.e) {
  const { a1, a2 } = barycentricSplit(aRel, el.m1, el.m2);
  const M = normalizeAngle(el.M0 + (TAU * tDays) / el.periodDays);
  const E = solveKepler(M, e);
  const p = orbitPoint(a2, e, E);          // 伴星的轨道点（半个相对椭圆）
  const r2 = { x: p.x, z: p.z };
  const r1 = { x: -(a1 / a2) * p.x, z: -(a1 / a2) * p.z };
  const bx = (el.m1 * r1.x + el.m2 * r2.x) / (el.m1 + el.m2);
  const bz = (el.m1 * r1.z + el.m2 * r2.z) / (el.m1 + el.m2);
  return {
    M, E, r1, r2, a1, a2,
    barycentre: Math.hypot(bx, bz),
    separation: Math.hypot(r2.x - r1.x, r2.z - r1.z),
    ok: Math.hypot(bx, bz) < 1e-9,
  };
}

const num = (v, digits = 3) => {
  if (!Number.isFinite(v)) return '—';
  const s = v.toFixed(digits);
  return s.replace(/\.?0+$/, '') || '0';
};

/** 周期的中英可读写法 */
export function periodText(periodDays, lang = 'zh-CN') {
  if (periodDays >= DAYS_PER_YEAR * 2) {
    const y = periodDays / DAYS_PER_YEAR;
    const n = y >= 10000 ? Math.round(y).toLocaleString('en-US') : num(y, 2);
    return lang === 'en' ? `${n} years` : `${n} 年`;
  }
  return lang === 'en' ? `${num(periodDays, 3)} days` : `${num(periodDays, 3)} 天`;
}

const ORBIT_COLOR = 0x8fb6ff;
const EXTRA_COLOR = 0x9fe8c8;

/**
 * 把一个系统配置展开成 main.js 可直接消费的 system.bodies。
 *
 * @param {object} s      STELLAR_SYSTEMS 里的一项
 * @param {object} opts   { nowYear, lang, compress }
 * @returns {{ bodies: object[], pairs: object[], levels: object[],
 *            timeScale: number, timeScaleMax: number, periodDays: number,
 *            cmId: string, maxCompression: number, starCount: number }}
 */
export function expandSystem(s, opts = {}) {
  const nowYear = opts.nowYear ?? julianYearFromDate();
  const lang = opts.lang ?? 'zh-CN';
  const en = lang === 'en';
  const compress = opts.compress !== false;
  const base = `sys_${s.key}`;
  const pathId = (path) => base + (path.length ? `_${path.join('_')}` : '');
  const bodies = [];
  const pairs = [];
  const levelRatio = s.levelRatio ?? 0.26;
  const rootAU = s.tree.aAu;
  /** 深度 d 的所有 pair 共用一个显示系数：显示半长轴 = rootAU·ratio^d。 */
  const displayScaleFor = (depth, aAu) =>
    compress ? (rootAU * (levelRatio ** depth)) / aAu : 1;

  /** 一个成员在父层里应有的轨道参数（物理 aAU + 该层 displayScale） */
  const orbitForMember = (pairDef, index, split, displayScale, M0, color) => ({
    aAU: index === 0 ? split.a1 : split.a2,
    displayScale,
    e: pairDef.e,
    periodDays: pairDef.periodDays,
    M0,
    node: pairDef.node,
    inc: pairDef.inc,
    // 主星近星点方向与伴星相反 180° —— 质心分解成立的关键
    argPeri: pairDef.argPeri + (index === 0 ? 180 : 0),
    showLine: true,
    color: color ?? ORBIT_COLOR,
    opacity: pairDef.quality === 'schematic' ? 0.13 : 0.18,
  });

  const compressionText = (displayScale) =>
    !compress || Math.abs(displayScale - 1) < 1e-9
      ? (en ? 'True linear scale' : '严格线性，未压缩')
      : (en
        ? `Inter-level spacing x${num(displayScale, 2)} for visibility; intra-level ratios are true`
        : `跨层间距 ×${num(displayScale, 2)} 以便同屏；同一层内部的比例仍为真实值`);

  const commonInfo = (pairDef, displayScale, depth) => ({
    所属层级: en ? pairDef.en : pairDef.zh,
    层级深度: en ? `Level ${depth + 1}` : `第 ${depth + 1} 层`,
    系统: en ? `${s.en} (${s.multiplicity} stars)` : `${s.zh}（${s.multiplicity} 合星）`,
    // 物理值原样给出；显示压缩单独写清楚，绝不混在一起
    相对半长轴: `${num(pairDef.aAu, 5)} AU`,
    偏心率: num(pairDef.e, 5),
    轨道倾角: `${num(pairDef.inc, 2)}°`,
    公转周期: periodText(pairDef.periodDays, lang),
    层级压缩: compressionText(displayScale),
    数据精度: {
      published: en ? 'Published orbital elements' : '论文 / 星表已发表根数',
      derived: en ? 'Derived from Kepler\'s third law' : '由开普勒第三定律反算',
      schematic: en ? 'Geometry schematic (marked as such)' : '轨道形状为示意（已标注）',
    }[pairDef.quality],
    轨道数据: en ? pairDef.sourceEn : pairDef.sourceZh,
  });

  /**
   * @param node        star / pair 节点
   * @param path        ID 路径（['a','b',...]）
   * @param parentCmId  父层质心 body id（null 表示根质心）
   * @param member      本节点作为父层成员时的轨道参数（根质心为 null）
   * @param depth       层级深度（根 = 0）
   * @param parentPair  父层 pair 定义（用于 info）
   */
  function emit(node, path, parentCmId, member, depth, parentPair) {
    const id = pathId(path);

    if (node.kind === 'star') {
      const aI = member.orbit.aAU;
      const infoName = en ? node.en : node.zh;
      bodies.push({
        id,
        name: infoName,
        nameEn: node.en,
        navGroup: en ? (parentPair?.en ?? 'Members') : (parentPair?.zh ?? '成员'),
        star: true,
        bodyKind: node.bodyKind ?? 'star',
        starBoost: 1.3,
        color: node.color,
        fixedSize: node.bodyKind === 'blackhole' ? 5.2 : 9.0,
        glowSize: node.bodyKind === 'blackhole' ? 14 : 24,
        parent: parentCmId,
        inertialParent: true,
        hierarchyDepth: depth,
        massSun: node.mass,
        radiusRSun: node.radius,
        orbit: member.orbit,
        info: {
          ...commonInfo(parentPair, member.orbit.displayScale, depth - 1),
          类型: en ? node.typeEn : node.typeZh,
          光谱型: node.spectral,
          质量: `${num(node.mass, 4)} M☉`,
          半径: node.bodyKind === 'blackhole'
            ? (en ? 'event horizon (tens of km)' : '视界尺度（数十公里）')
            : `${num(node.radius, 4)} R☉`,
          绕质心半长轴: `${num(aI, 5)} AU`,
          简介: en ? (node.noteEn ?? '') : (node.noteZh ?? ''),
        },
      });
      return id;
    }

    // ---- 这一层的质心 ----
    const cmId = `${id}_cm`;
    const m1 = nodeMass(node.a);
    const m2 = nodeMass(node.b);
    const split = barycentricSplit(node.aAu, m1, m2);
    const M0 = meanAnomalyAt(node, nowYear);
    // 按深度取整层统一的显示系数，与兄弟子系统一致，避免质量比悬殊时
    // 内层被压到不可见（南门二外层 AB 质心只走 503 AU，而外层 a=8700 AU）。
    const displayScale = displayScaleFor(depth, node.aAu);

    // 质心的 3D 名字标签要短：完整层级名已写在信息卡的「所属层级」里，
    // 若在这里重复一遍长名，会和两颗成员星的标签糊成一团。
    const cmName = parentCmId
      ? (en ? `L${depth + 1} barycentre` : `第 ${depth + 1} 层质心`)
      : (en ? 'System barycentre' : '系统总质心');
    const cmNameEn = parentCmId
      ? `Level-${depth + 1} barycentre`
      : 'System barycentre';
    bodies.push({
      id: cmId,
      name: cmName,
      nameEn: cmNameEn,
      navGroup: en ? 'Barycentres' : '系统质心',
      barycenter: true,
      star: true,
      starBoost: 0.62,
      color: 0x8fa4c8,
      fixedSize: 1.6,
      glowSize: 5.5,
      parent: parentCmId,
      inertialParent: parentCmId != null,
      hierarchyDepth: depth,
      // 作为父层成员时，质心自己也要按父层轨道运动
      ...(member ? { orbit: member.orbit, massSun: m1 + m2 } : {}),
      info: {
        所属层级: en ? `Level ${depth + 1} · ${node.en}` : `第 ${depth + 1} 层 · ${node.zh}`,
        系统: en ? `${s.en} (${s.multiplicity} stars)` : `${s.zh}（${s.multiplicity} 合星）`,
        类型: en ? `Mass-weighted centre of ${countStars(node)} stars on this level` : `本层 ${countStars(node)} 颗星的质量加权平均位置`,
        相对半长轴: `${num(node.aAu, 5)} AU`,
        偏心率: num(node.e, 5),
        轨道倾角: `${num(node.inc, 2)}°`,
        公转周期: periodText(node.periodDays, lang),
        成员质量: `${num(m1, 4)} + ${num(m2, 4)} M☉`,
        在上一层的轨道: parentPair
          ? `${num(member.orbit.aAU, 5)} AU · ${periodText(parentPair.periodDays, lang)}`
          : (en ? 'Root barycentre (at rest)' : '总质心（静止参照点）'),
        层级压缩: compressionText(displayScale),
        数据精度: {
          published: en ? 'Published orbital elements' : '论文 / 星表已发表根数',
          derived: en ? 'Derived from Kepler\'s third law' : '由开普勒第三定律反算',
          schematic: en ? 'Geometry schematic (marked as such)' : '轨道形状为示意（已标注）',
        }[node.quality],
        简介: en
          ? 'Both components orbit this point. Their mass ratio sets the size ratio of the two ellipses; if a component is itself a binary, its whole inner system moves with this point.'
          : '两成员都绕这一点转，两条椭圆大小之比等于质量反比。若某个成员本身是双星，它的整套内层系统会随这个点一起运动。',
        轨道数据: en ? node.sourceEn : node.sourceZh,
      },
    });

    const pairRecord = {
      id: cmId,
      key: `${s.key}:${path.join('.') || 'root'}`,
      a: null, b: null, cm: cmId,
      q: split.ratio,
      aRel: node.aAu,
      e: node.e,
      periodDays: node.periodDays,
      M0,
      m1, m2,
      depth,
      displayScale,
      labelZh: node.zh,
      labelEn: node.en,
    };

    for (const index of [0, 1]) {
      const child = index === 0 ? node.a : node.b;
      const childOrbit = orbitForMember(node, index, split, displayScale, M0);
      const childPath = [...path, index === 0 ? 'a' : 'b'];
      const childId = emit(
        child, childPath, cmId,
        { orbit: childOrbit }, depth + 1, node,
      );
      if (index === 0) pairRecord.a = childId;
      else pairRecord.b = childId;
    }
    pairs.push(pairRecord);
    return cmId;
  }

  const rootCmId = emit(s.tree, [], null, null, 0, null);

  // 环双星第三体：绕整个系统总质心，轨道要素独立（Kepler-16b）
  const rootDisplay = 1;
  for (const x of s.extras ?? []) {
    const xM0 = meanAnomalyAt(x, nowYear);
    bodies.push({
      id: `${base}_${x.tag}`,
      name: x.zh,
      nameEn: x.en,
      navGroup: en ? 'Circumbinary' : '环双星行星',
      star: false,
      bodyKind: x.bodyKind ?? 'planet',
      color: x.color,
      fixedSize: 4.6,
      glowSize: 14,
      parent: rootCmId,
      inertialParent: true,
      hierarchyDepth: 1,
      orbit: {
        aAU: x.aAu, displayScale: rootDisplay, e: x.e,
        periodDays: x.periodDays, M0: xM0,
        node: x.node, inc: x.inc, argPeri: x.argPeri,
        showLine: true, color: EXTRA_COLOR, opacity: 0.2,
      },
      info: {
        所属层级: en ? 'Circumbinary orbit' : '环双星轨道',
        系统: en ? s.en : s.zh,
        类型: en ? x.typeEn : x.typeZh,
        轨道半长轴: `${num(x.aAu, 5)} AU`,
        偏心率: num(x.e, 5),
        轨道倾角: `${num(x.inc, 3)}°`,
        公转周期: periodText(x.periodDays, lang),
        层级压缩: en ? 'True linear scale' : '严格线性，未压缩',
        简介: en ? x.noteEn : x.noteZh,
      },
    });
  }

  // 时间档：每一层一个「一圈约 24 秒」，用户可在 HUD 里切换观察哪一层
  const seen = new Set();
  const levels = pairs
    .map((p) => ({
      labelZh: p.labelZh,
      labelEn: p.labelEn,
      periodDays: p.periodDays,
      timeScale: Math.max(0.01, p.periodDays / 24),
      depth: p.depth,
    }))
    .filter((l) => {
      const k = l.periodDays.toFixed(6);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.periodDays - b.periodDays);

  const maxLevelScale = levels.at(-1)?.timeScale ?? 200;
  return {
    bodies,
    pairs: pairs.sort((a, b) => a.depth - b.depth),
    levels,
    timeScale: levels[0]?.timeScale ?? 1,
    timeScaleMax: Math.max(200, Math.ceil(maxLevelScale * 4)),
    periodDays: s.tree.periodDays,
    cmId: rootCmId,
    maxCompression: Math.max(...pairs.map((p) => p.displayScale), 1),
    starCount: countStars(s.tree),
  };
}

export default expandSystem;
