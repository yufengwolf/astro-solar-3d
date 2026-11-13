// src/data/cosmic-structures.js
// 上层结构（超星系团 / 星系团 / 星系群）的真实代表坐标 —— 与 galaxies.js 同源，
// 把「可观测宇宙 → 本星系群」整条链都变成坐标驱动，而不再是手写定性 pos。
//
// 每个条目 = 一个结构在「以银河系（太阳）为原点」的真实方位与距离：
//   ra     赤经（度，J2000）
//   dec    赤纬（度，J2000）
//   distMpc 到银河系的距离（百万秒差距，Mpc）
//
// 数值取公开文献常用近似（科普量级，非前沿测距，距越远不确定度越大）：
//   室女座星系团 ~16.5、天炉座星系团 ~19.5、波江座星系团 ~23、大熊座星系团 ~18、
//   半人马座（巨引源）~45、长蛇座 ~50、矩尺座 ~65、孔雀－印第安 ~65、
//   后发座 ~100、英仙－双鱼 ~77、夏普力 ~145、武仙座 ~110（Mpc）；
//   拉尼亚凯亚质心取巨引源方向 ~60 Mpc（Tully et al. 2014, Nature）。
// 这些与 Tully / Cosmicflows-3 / 2MASS Galaxy Groups、NED 的常用值一致；
// 若日后接入这些星表，只需替换本表数值，渲染层无需改动。
import { equatorialToGalactic, galacticToScene, LY_PER_KPC } from '../coord/galactic.js';

export const COSMIC_REAL = {
  // —— 超星系团（universe 页成员；laniakea 为焦点、落在原点）——
  laniakea:      { ra: 157.5, dec: -46.0, distMpc: 60 },   // 质心取巨引源方向
  perseuspisces: { ra: 49.9,  dec: 41.5,  distMpc: 77 },
  coma:          { ra: 194.9, dec: 28.0,  distMpc: 100 },
  shapley:       { ra: 201.8, dec: -31.0, distMpc: 145 },
  hercules:      { ra: 241.3, dec: 17.7,  distMpc: 110 },
  // —— 拉尼亚凯亚内的其它纤维（laniakea 页成员；virgo 为焦点、落原点）——
  virgo:         { ra: 187.5, dec: 12.4,  distMpc: 16.5 },  // 室女座星系团＝本超星系团中心
  hydra:         { ra: 159.0, dec: -27.0, distMpc: 50 },    // 长蛇－半人马（巨引源方向）
  norma:         { ra: 243.8, dec: -60.8, distMpc: 65 },    // 矩尺座（阿贝尔 3627）
  pavoindus:     { ra: 300.0, dec: -60.0, distMpc: 65 },
  // —— 室女座超星系团内的星系团（virgo 页成员；localgroup 为焦点、落原点）——
  localgroup:    { ra: 0,     dec: 0,     distMpc: 0 },      // 我们所在，原点
  virgocluster:  { ra: 187.5, dec: 12.4,  distMpc: 16.5 },
  fornax:        { ra: 54.5,  dec: -35.5, distMpc: 19.5 },
  eridanus:      { ra: 49.3,  dec: -21.0, distMpc: 23 },
  ursamajor:     { ra: 177.5, dec: 53.0,  distMpc: 18 },
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

export const COSMIC_LY_PER_KPC = LY_PER_KPC;
