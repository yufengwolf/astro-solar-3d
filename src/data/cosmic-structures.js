// src/data/cosmic-structures.js
// 上层结构（超星系团 / 星系团 / 星系群）的真实代表坐标 —— 全站「上级层级」的坐标唯一真源。
//
// 与 galaxies.js（本星系群）、hyg-stars.js / openngc.js（银河系内）同源思路：
// 位置由真实星表派生，不再手写定性 pos。universe.js 的 deriveCosmicPositions()
// 会读取 cosmicVec(id) 自动算出每个层级页里成员的 pos 与 dLy。
//
// ── 数据来源（v2, 2026-11-13，由「手抄科普近似」升级为「星表驱动」）──────────
//  · 方向 ra/dec（J2000，度）：OpenNGC 真实星表（mattiaverga/OpenNGC,
//    database_files/NGC.csv），取每个星系团 / 群的中心 cD 或主导星系赤经赤纬；
//    六进制 → 十进制度由 scripts/build-openngc.mjs 同源的解析规则换算。
//  · 距离 distMpc（百万秒差距）：Cosmicflows-3 模板星系团实测距离，
//    Tully, Courtois & Sorce (2016), AJ 152, 50, Table 1 的 d_cc（含 ± 误差）；
//    近邻星系群用 TRGB / NED-D 实测距离；少数无精确测距的超星系团用公开文献常用值。
//  · 交叉校验：Manticore Project (arXiv:2505.10682, Table 2) 基于 Cosmicflows-3 +
//    NED 的近邻星系团三维超星系坐标；Tully et al. (2014), Nature 513, 71 定义拉尼亚凯亚。
//
// 每个条目字段：
//   ra, dec     J2000 赤经 / 赤纬（度）
//   distMpc     到银河系的距离（Mpc）
//   src         数据来源标签，见 COSMIC_SOURCES
//   ngc         OpenNGC 锚点天体编号（有则填）
//   z           锚点天体红移（OpenNGC Redshift 列，有则填）
//   dErrMpc     Cosmicflows-3 实测距离误差（Mpc，有则填）
//
// 渲染层无需改动：cosmicVec(id) 仍返回银道系场景坐标（kpc，银心为原点）。
import { equatorialToGalactic, galacticToScene, LY_PER_KPC } from '../coord/galactic.js';

/** 数据来源标签（供 scripts/check-cosmic.mjs 与 UI 说明使用） */
export const COSMIC_SOURCES = {
  cf3: 'Cosmicflows-3 (Tully et al. 2016, AJ 152, 50) Table 1 模板星系团实测距离',
  opengnc: 'OpenNGC 星表 NGC/IC 中心天体实测赤经赤纬',
  trgb: 'TRGB / NED-D 近邻星系群实测距离（Karachentsev et al.）',
  tully14: 'Tully et al. (2014), Nature 513, 71（拉尼亚凯亚质心 / 巨引源方向）',
  manticore: 'Manticore / Cosmicflows-3 + NED 三维超星系坐标（arXiv:2505.10682）',
  lit: '公开文献常用近似值（待接入 VizieR / NED 星表后替换）',
  origin: '观测原点（我们所在）',
};

// Cosmicflows-3 Table 1 实测模板距离（d_cc, Mpc），留档便于核对与日后替换。
// 顺序：名称 → [d_cc, ±err, V_mod(km/s)]
export const CF3_TEMPLATE_DISTANCES = {
  virgo: [16.1, 1.0, 1495], ursamajor: [17.2, 1.0, 1079], fornax: [16.6, 1.2, 1358],
  antlia: [36.9, 2.4, 3198], centaurus: [36.4, 2.9, 3823], pegasus: [43.9, 2.8, 3062],
  hydra: [55.3, 4.1, 4088], pisces: [66.2, 3.3, 4759], cancer: [67.6, 4.0, 5059],
  coma: [90.9, 5.1, 7370], a1367: [93.9, 5.4, 6969], a400: [97.7, 5.3, 7228],
  a2634: [117.3, 6.8, 8938],
};

/**
 * 真实代表坐标表。key 必须与 universe.js 的 NODES.id 对应
 * （新增层级节点时两处都要加，check-cosmic.mjs 会强制校验这一点）。
 */
export const COSMIC_REAL = {
  // ── 超星系团（universe 页成员；laniakea 为焦点，落在原点）──────────────
  laniakea:      { ra: 157.5,    dec: -46.0,   distMpc: 60,   src: 'tully14' },
  perseuspisces: { ra: 49.9507,  dec: 41.5117, distMpc: 77,   src: 'opengnc+lit', ngc: 'NGC1275', z: 0.016813 },
  coma:          { ra: 195.0339, dec: 27.9770, distMpc: 90.9, src: 'cf3+opengnc', ngc: 'NGC4889', z: 0.0215, dErrMpc: 5.1 },
  shapley:       { ra: 201.8,    dec: -31.0,   distMpc: 145,  src: 'lit' },
  hercules:      { ra: 241.3,    dec: 17.7,    distMpc: 110,  src: 'lit' },
  // 新增：其它近邻超星系团（真实方向，文献常用距离）
  sculptorsc:    { ra: 12.0,     dec: -30.0,   distMpc: 90,   src: 'lit' },
  horologium:    { ra: 55.0,     dec: -50.0,   distMpc: 140,  src: 'lit' },
  piscescetus:   { ra: 15.0,     dec: 5.0,     distMpc: 120,  src: 'lit' },

  // ── 拉尼亚凯亚内的纤维 / 富团（laniakea 页成员；virgo 为焦点）──────────
  virgo:         { ra: 187.7059, dec: 12.3911, distMpc: 16.1, src: 'cf3+opengnc', ngc: 'NGC4486', z: 0.0042, dErrMpc: 1.0 },
  hydra:         { ra: 159.1784, dec: -27.5283,distMpc: 55.3, src: 'cf3+opengnc', ngc: 'NGC3311', z: 0.012953, dErrMpc: 4.1 },
  norma:         { ra: 243.8,    dec: -60.8,   distMpc: 65,   src: 'lit' },
  pavoindus:     { ra: 300.0,    dec: -60.0,   distMpc: 65,   src: 'lit' },
  // 新增：拉尼亚凯亚 / 近邻宇宙内两个有实测坐标的富星系团
  a1367:         { ra: 176.0090, dec: 19.9498, distMpc: 93.9, src: 'cf3+opengnc', ngc: 'NGC3842', z: 0.0208, dErrMpc: 5.4 },
  a262:          { ra: 28.1937,  dec: 36.1518, distMpc: 65,   src: 'opengnc+lit', ngc: 'NGC0708', z: 0.01622 },

  // ── 室女座超星系团内的星系团 / 群（virgo 页成员；localgroup 为焦点）──
  localgroup:    { ra: 0,        dec: 0,       distMpc: 0,    src: 'origin' },
  virgocluster:  { ra: 187.7059, dec: 12.3911, distMpc: 16.1, src: 'cf3+opengnc', ngc: 'NGC4486', z: 0.0042, dErrMpc: 1.0 },
  fornax:        { ra: 54.6210,  dec: -35.4507,distMpc: 16.6, src: 'cf3+opengnc', ngc: 'NGC1399', z: 0.004755, dErrMpc: 1.2 },
  eridanus:      { ra: 49.3,     dec: -21.0,   distMpc: 23,   src: 'lit' },
  ursamajor:     { ra: 177.5,    dec: 53.0,    distMpc: 17.2, src: 'cf3+lit', dErrMpc: 1.0 },
  // 新增：Cosmicflows-3 实测的近邻富星系团（方向来自 OpenNGC 中心天体）
  antlia:           { ra: 157.5028, dec: -35.3255, distMpc: 36.9, src: 'cf3+opengnc', ngc: 'NGC3268', z: 0.009384, dErrMpc: 2.4 },
  centauruscluster: { ra: 192.2052, dec: -41.3108, distMpc: 36.4, src: 'cf3+opengnc', ngc: 'NGC4696', z: 0.009734, dErrMpc: 2.9 },
  pegasuscluster:   { ra: 350.0605, dec: 8.2062,   distMpc: 43.9, src: 'cf3+opengnc', ngc: 'NGC7619', z: 0.01324, dErrMpc: 2.8 },
  // 新增：TRGB 实测距离的近邻星系群（方向来自 OpenNGC 主导星系）
  m81group:      { ra: 148.8882, dec: 69.0653,  distMpc: 3.6,  src: 'trgb+opengnc', ngc: 'NGC3031' },
  cenagroup:     { ra: 201.3651, dec: -43.0191, distMpc: 3.7,  src: 'trgb+opengnc', ngc: 'NGC5128', z: 0.001877 },
  sculptorgroup: { ra: 11.8880,  dec: -25.2882, distMpc: 3.9,  src: 'trgb+opengnc', ngc: 'NGC0253', z: 0.000864 },
  leo1group:     { ra: 161.6906, dec: 11.8199,  distMpc: 10.5, src: 'trgb+opengnc', ngc: 'NGC3368', z: 0.002946 },
};

/**
 * 真实笛卡尔坐标（银道系、以银心为原点的场景帧，单位 kpc），方向与 galaxies.js 同源。
 * d=0 时落在太阳位置 S；但「两结构相减」时 S 抵消，差值即真实相对位置。
 */
export function cosmicVec(id) {
  const r = COSMIC_REAL[id];
  if (!r) return null;
  const [l, b] = equatorialToGalactic(r.ra, r.dec);
  return galacticToScene(l, b, r.distMpc * 1000); // 1 Mpc = 1000 kpc
}

/** 该结构的来源说明（供信息卡 / 自检使用） */
export function cosmicSource(id) {
  const r = COSMIC_REAL[id];
  if (!r) return null;
  return {
    label: r.src,
    text: r.src.split('+').map((k) => COSMIC_SOURCES[k.trim()] ?? k).join('；'),
    ngc: r.ngc ?? null,
    z: r.z ?? null,
    distMpc: r.distMpc,
    dErrMpc: r.dErrMpc ?? null,
  };
}

export const COSMIC_LY_PER_KPC = LY_PER_KPC;
