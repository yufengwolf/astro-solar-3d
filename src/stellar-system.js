/**
 * AU 级恒星系统页工厂 —— 把 src/data/stellar-orbits.js 的层级轨道树
 * 变成 main.js 能直接渲染的 system 配置。
 *
 * 不新增 HTML / Vite 入口：复用 cosmos.html?node=sys_<key> 这条通用层级页
 * 通道。universe.js 注册表里每加一个节点，导航面包屑、上一级 / 下一级、
 * 宇宙地图、go.html 直达外链全部自动跟着变；这里只负责「这一层画什么」。
 * 由 src/systems/cosmos.js 的 makeCosmosSystem() 在进入恒星系统节点时委托。
 *
 * 与太阳系 / 卫星系统共用同一套渲染与交互：开普勒求解、轨道线、左侧菜单、
 * 名字标签、信息卡、取景预设、跟随镜头、滚轮缩放，都不需要特例分支。
 * 唯一新增的是层级惯性框架（main.js 的 inertialParent）与跨层显示压缩。
 */
import { SYSTEM_BY_NODE } from './data/stellar-orbits.js';
import { expandSystem, julianYearFromDate, periodText } from './orbit-tree.js';
import { isEnglish } from './universe.js';

export function makeStellarSystem(nodeId, opts = {}) {
  const s = SYSTEM_BY_NODE.get(nodeId);
  if (!s) throw new Error(`未知恒星系统: ${nodeId}`);
  const en = isEnglish();
  const lang = en ? 'en' : 'zh-CN';
  const nowYear = julianYearFromDate();

  // ?scale=real 关掉跨层压缩，回到严格线性比例（内层会缩成一个点，
  // 但这是真实尺度）。URL 参数让该状态可分享、可用 CDP 验证。
  let realScale = false;
  try {
    realScale = new URLSearchParams(globalThis.location?.search ?? '').get('scale') === 'real';
  } catch { /* Node 自检无 location */ }
  const tree = expandSystem(s, { nowYear, lang, compress: !realScale });
  if (realScale) {
    for (const b of tree.bodies) if (b.orbit) b.orbit.displayScale = 1;
  }

  const shortest = tree.levels[0];

  return {
    id: nodeId,
    label: en ? s.en : s.zh,
    hasSun: false,
    barycentric: true,
    background: opts.background ?? null,
    // 远景天球星点：与相机同心但方向固定在三维空间里，转视角时按方向切换，
    // 不是贴在屏幕上的静态背景图。系统页也保持「背景不空」这一约定。
    starfield: true,
    // 轨道距离严格线性映射（distancePower = 1）：同一层两条椭圆的大小之比
    // 就是真实的质量反比。跨层压缩由各层 displayScale 完成，两者互不干扰。
    scale: {
      distanceMode: 'power',
      distancePower: 1,
      maxDistance: 320,
      radiusRefUnits: 6.4,
      // 近日点下限保持 0：真实偏心率必须原样保留，不能为了好看把椭圆拉圆。
      minPerihelionUnits: 0,
    },
    camera: {
      position: [0.62, 0.48, 0.86],
      target: [0, 0, 0],
      frameTo: 'auto',
      // frameRadius 取的是最远轨道的半长轴 a，而高偏心率轨道的远星点
      // 在 a(1+e)。南门二外层 e=0.50，按 1.35 取景会把椭圆两侧裁出画面，
      // 只看到两条竖线；按 e 放大余量才能看到完整的外层椭圆。
      fitMargin: 1.35 * (1 + s.tree.e * 0.7),
    },
    timeScale: tree.timeScale,
    timeScaleMax: tree.timeScaleMax,
    // 时间控件与自检钩子
    orbitClock: {
      periodDays: tree.periodDays,
      periodText: periodText(tree.periodDays, lang),
      // 多层系统的周期可差 5 个数量级：默认按最短周期走，HUD 可一键切层。
      levels: tree.levels,
      shortestText: shortest ? periodText(shortest.periodDays, lang) : '',
      nowYear,
      epochYear: s.tree.epochYear,
      quality: s.tree.quality,
      realScale,
      compressed: !realScale && tree.maxCompression > 1.0001,
      maxCompression: tree.maxCompression,
      multiplicity: s.multiplicity,
      starCount: tree.starCount,
      levelCount: tree.levels.length,
    },
    orbitPairs: tree.pairs,
    orbitBrief: en ? s.briefEn : s.briefZh,
    orbitSource: en ? s.sourceEn : s.sourceZh,
    portraitCaption: en
      ? (realScale
        ? 'True linear scale across all levels; inner pairs shrink to points. Physical elements unchanged.'
        : 'True semi-major axes, eccentricities and periods within each level; inter-level spacing compressed for visibility. Star diameters enlarged.')
      : (realScale
        ? '全层级严格线性比例，内层双星会缩成点；物理根数未改。'
        : '每一层内部的半长轴、偏心率、周期均为真实值；跨层级间距为便于同屏已压缩（信息卡逐层标注）。星体直径已放大以便观察。'),
    bodies: tree.bodies,
  };
}

export default makeStellarSystem;
