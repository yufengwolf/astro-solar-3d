/**
 * 真实天体物理参数
 *
 * 数据源优先级：
 *   1. NASA/JPL SSD《Planetary Satellite Mean Elements》(ssd.jpl.nasa.gov/sats/elem/sep.html)
 *      —— 不规则卫星的 a/e/i/node/周期 全部取自此表（含真实的升交点经度）
 *   2. PDS Ring-Moon Systems Node Vital Statistics 表（pds-rings.seti.org）
 *      —— 规则卫星的精确值
 *   3. 各卫星 Wikipedia 条目（半径/尺寸）
 *
 * 单位约定：
 *   radiusKm            平均半径（km）
 *   rotationHours       自转周期（小时），负值 = 相对公转方向反向自转（金星、天王星）
 *   axialTilt           自转轴倾角（度）
 *   orbit.aAU           轨道半长轴（天文单位），行星用
 *   orbit.aKm           轨道半长轴（km），卫星用
 *   orbit.e             轨道偏心率（0 = 正圆）
 *   orbit.inc           轨道倾角（度）；行星相对黄道面，卫星相对中心天体赤道面／拉普拉斯面
 *   orbit.node          升交点经度（度）；缺省 0
 *   orbit.periodDays    公转周期（天），**始终取正**
 *
 * ⚠️ 逆行的表达方式（重要）：
 *   逆行完全由 `orbit.inc > 90°` 表示 —— 渲染时轨迹面会翻过 180°，
 *   运动方向随之反转。periodDays 必须保持正值；若再取负会二次反转，反而变成顺行。
 */

export const AU_KM = 149597870.7;

export const REAL = {
  sun: { radiusKm: 696340, rotationHours: 609.12, axialTilt: 7.25 },

  // ---------------- 行星 ----------------
  mercury: {
    radiusKm: 2439.7, rotationHours: 1407.6, axialTilt: 0.034,
    orbit: { aAU: 0.38710, e: 0.2056, inc: 7.005, periodDays: 87.969 },
  },
  venus: {
    radiusKm: 6051.8, rotationHours: -5832.5, axialTilt: 177.36,
    orbit: { aAU: 0.72333, e: 0.0068, inc: 3.3946, periodDays: 224.701 },
  },
  earth: {
    radiusKm: 6371.0, rotationHours: 23.9345, axialTilt: 23.44,
    orbit: { aAU: 1.0, e: 0.0167, inc: 0.0, periodDays: 365.256 },
  },
  mars: {
    radiusKm: 3389.5, rotationHours: 24.6229, axialTilt: 25.19,
    orbit: { aAU: 1.52371, e: 0.0934, inc: 1.850, periodDays: 686.980 },
  },
  jupiter: {
    radiusKm: 69911, rotationHours: 9.9250, axialTilt: 3.13,
    orbit: { aAU: 5.2029, e: 0.0489, inc: 1.304, periodDays: 4332.59 },
  },
  saturn: {
    radiusKm: 58232, rotationHours: 10.656, axialTilt: 26.73,
    orbit: { aAU: 9.5367, e: 0.0565, inc: 2.485, periodDays: 10759.2 },
  },
  uranus: {
    radiusKm: 25362, rotationHours: -17.24, axialTilt: 97.77,
    orbit: { aAU: 19.1891, e: 0.0457, inc: 0.773, periodDays: 30688.5 },
  },
  neptune: {
    radiusKm: 24622, rotationHours: 16.11, axialTilt: 28.32,
    orbit: { aAU: 30.0699, e: 0.0113, inc: 1.770, periodDays: 60182 },
  },
  pluto: {
    radiusKm: 1188.3, rotationHours: -153.29, axialTilt: 122.53,
    orbit: { aAU: 39.482, e: 0.2488, inc: 17.16, periodDays: 90560 },
  },

  // ---------------- 卫星 ----------------
  moon: {
    radiusKm: 1737.4, rotationHours: 655.72,
    orbit: { aKm: 384400, e: 0.0549, inc: 5.145, periodDays: 27.322 },
  },
  phobos: {
    radiusKm: 11.267, rotationHours: 7.653,
    orbit: { aKm: 9376, e: 0.0151, inc: 1.075, periodDays: 0.3189 },
  },
  deimos: {
    radiusKm: 6.2, rotationHours: 30.30,
    orbit: { aKm: 23463, e: 0.00033, inc: 1.788, periodDays: 1.2624 },
  },
  io: {
    radiusKm: 1821.6, rotationHours: 42.46,
    orbit: { aKm: 421700, e: 0.0041, inc: 0.05, periodDays: 1.769 },
  },
  europa: {
    radiusKm: 1560.8, rotationHours: 85.22,
    orbit: { aKm: 671034, e: 0.0090, inc: 0.47, periodDays: 3.551 },
  },
  ganymede: {
    radiusKm: 2634.1, rotationHours: 171.71,
    orbit: { aKm: 1070412, e: 0.0013, inc: 0.20, periodDays: 7.155 },
  },
  callisto: {
    radiusKm: 2410.3, rotationHours: 400.54,
    orbit: { aKm: 1882709, e: 0.0074, inc: 0.192, periodDays: 16.689 },
  },
  mimas: {
    radiusKm: 198.2, rotationHours: 22.61,
    orbit: { aKm: 185539, e: 0.0196, inc: 1.566, periodDays: 0.942 },
  },
  enceladus: {
    radiusKm: 252.1, rotationHours: 32.89,
    orbit: { aKm: 237948, e: 0.0047, inc: 0.009, periodDays: 1.370 },
  },
  tethys: {
    radiusKm: 531.0, rotationHours: 45.31,
    orbit: { aKm: 294619, e: 0.0001, inc: 1.09, periodDays: 1.888 },
  },
  dione: {
    radiusKm: 561.4, rotationHours: 65.69,
    orbit: { aKm: 377396, e: 0.0022, inc: 0.028, periodDays: 2.737 },
  },
  rhea: {
    radiusKm: 763.8, rotationHours: 108.43,
    orbit: { aKm: 527108, e: 0.0010, inc: 0.35, periodDays: 4.518 },
  },
  titan: {
    radiusKm: 2574.7, rotationHours: 382.69,
    orbit: { aKm: 1221870, e: 0.0288, inc: 0.33, periodDays: 15.945 },
  },
  iapetus: {
    radiusKm: 734.5, rotationHours: 1903.7,
    orbit: { aKm: 3560820, e: 0.0286, inc: 15.47, periodDays: 79.32 },
  },
  miranda: {
    radiusKm: 235.8, rotationHours: 33.92,
    orbit: { aKm: 129900, e: 0.0013, inc: 4.34, periodDays: 1.413 },
  },
  ariel: {
    radiusKm: 578.9, rotationHours: 60.48,
    orbit: { aKm: 190900, e: 0.0012, inc: 0.04, periodDays: 2.520 },
  },
  umbriel: {
    radiusKm: 584.7, rotationHours: 99.46,
    orbit: { aKm: 266000, e: 0.0039, inc: 0.13, periodDays: 4.144 },
  },
  titania: {
    radiusKm: 788.4, rotationHours: 208.94,
    orbit: { aKm: 435910, e: 0.0011, inc: 0.08, periodDays: 8.706 },
  },
  oberon: {
    radiusKm: 761.4, rotationHours: 323.11,
    orbit: { aKm: 583520, e: 0.0014, inc: 0.07, periodDays: 13.463 },
  },
  triton: {
    radiusKm: 1353.4, rotationHours: -141.05,
    // 逆行：由倾角 156.865° 表达（>90° 即逆行）。周期保持正值。
    orbit: { aKm: 354759, e: 0.000016, inc: 156.865, periodDays: 5.877 },
  },
  charon: {
    radiusKm: 606.0, rotationHours: 153.29,
    orbit: { aKm: 19591, e: 0.0002, inc: 0.08, periodDays: 6.387 },
  },

  // ---------------- 木星：内卫星（PDS Rings-Moon Node）----------------
  // 轨道都在木星赤道面上，倾角不足 1.1°，因此它们确实几乎共面。
  metis: {
    radiusKm: 21.5, rotationHours: 7.075,
    orbit: { aKm: 127979, e: 0.0002, inc: 0.06, periodDays: 0.2948 },
  },
  adrastea: {
    radiusKm: 8.2, rotationHours: 7.159,
    orbit: { aKm: 128980, e: 0.0015, inc: 0.03, periodDays: 0.2983 },
  },
  amalthea: {
    radiusKm: 83.5, rotationHours: 11.957,
    orbit: { aKm: 181366, e: 0.0032, inc: 0.374, periodDays: 0.4982 },
  },
  thebe: {
    radiusKm: 49.3, rotationHours: 16.188,
    orbit: { aKm: 221890, e: 0.0175, inc: 1.076, periodDays: 0.6745 },
  },

  // ---------------- 木星：不规则卫星（JPL Mean Elements, Ref 47）----------------
  // 轨道远、偏心大、倾角大；Ananke/Carme/Pasiphae/Sinope 四颗是**逆行**（inc > 90°）。
  themisto: {   // 独立的一颗，倾角 44.3°，不属于任何群
    radiusKm: 4.5, rotationHours: 3119.2,
    orbit: { aKm: 7397000, e: 0.257, inc: 44.3, node: 202.7, periodDays: 129.968 },
  },
  leda: {       // 希玛利亚群（顺行，倾角约 28°）
    radiusKm: 10, rotationHours: 5767.8,
    orbit: { aKm: 11145200, e: 0.162, inc: 28.2, node: 216.9, periodDays: 240.326 },
  },
  himalia: {
    radiusKm: 85, rotationHours: 5997.8,
    orbit: { aKm: 11439000, e: 0.160, inc: 28.4, node: 64.2, periodDays: 249.909 },
  },
  lysithea: {
    radiusKm: 18, rotationHours: 6204.1,
    orbit: { aKm: 11699100, e: 0.117, inc: 27.7, node: 9.2, periodDays: 258.504 },
  },
  elara: {
    radiusKm: 43, rotationHours: 6213.3,
    orbit: { aKm: 11710700, e: 0.212, inc: 27.8, node: 112.8, periodDays: 258.886 },
  },
  ananke: {     // 阿南刻群（逆行）
    radiusKm: 14.5, rotationHours: -14954.6,
    orbit: { aKm: 21029500, e: 0.238, inc: 147.6, node: 13.7, periodDays: 623.110 },
  },
  carme: {      // 卡梅群（逆行，倾角高达 164.6°）
    radiusKm: 23, rotationHours: -17262.7,
    orbit: { aKm: 23139200, e: 0.261, inc: 164.6, node: 115.5, periodDays: 719.281 },
  },
  pasiphae: {   // 帕西法厄群（逆行），偏心率 0.412，近日点 13.8M km、远日点 33.1M km
    radiusKm: 30, rotationHours: -17626.1,
    orbit: { aKm: 23463200, e: 0.412, inc: 148.3, node: 315.7, periodDays: 734.422 },
  },
  sinope: {
    radiusKm: 19, rotationHours: -17870.3,
    orbit: { aKm: 23679300, e: 0.262, inc: 157.3, node: 308.0, periodDays: 744.595 },
  },

  // ---------------- 土星：牧羊犬卫星 / 共轨道卫星（PDS + Porco 2004）----------------
  prometheus: {   // F 环牧羊犬内侧
    radiusKm: 42.1, rotationHours: 14.712,
    orbit: { aKm: 139380, e: 0.0022, inc: 0.008, periodDays: 0.613 },
  },
  pandora: {      // F 环牧羊犬外侧
    radiusKm: 40.7, rotationHours: 15.096,
    orbit: { aKm: 141720, e: 0.0042, inc: 0.050, periodDays: 0.629 },
  },
  janus: {        // 与土卫十一对共同轨道，每约 4 年互换位置
    radiusKm: 89, rotationHours: 16.68,
    orbit: { aKm: 151460, e: 0.0068, inc: 0.163, periodDays: 0.695 },
  },
  epimetheus: {
    radiusKm: 58.1, rotationHours: 16.656,
    orbit: { aKm: 151422, e: 0.0098, inc: 0.335, periodDays: 0.694 },
  },
  telesto: {      // 土卫三的前方特洛伊卫星（L4）
    radiusKm: 12.5, rotationHours: 45.312,
    orbit: { aKm: 294619, e: 0.0002, inc: 1.19, periodDays: 1.888 },
  },
  calypso: {      // 土卫三的后方特洛伊卫星（L5）
    radiusKm: 10.7, rotationHours: 45.312,
    orbit: { aKm: 294629, e: 0.0005, inc: 1.56, periodDays: 1.888 },
  },
  helene: {       // 土卫四的前方特洛伊卫星（L4）
    radiusKm: 17.6, rotationHours: 65.688,
    orbit: { aKm: 377396, e: 0.007, inc: 0.21, periodDays: 2.737 },
  },
  hyperion: {     // 自转混沌（取 ~13 天近似值），形状极不规则
    radiusKm: 133, rotationHours: 312,
    orbit: { aKm: 1481010, e: 0.123, inc: 0.43, periodDays: 21.28 },
  },
  phoebe: {       // 诺尔斯群，逆行，倾角 151.78°；可能是被捕获的柯伊伯带天体
    radiusKm: 106.5, rotationHours: -13207.2,
    orbit: { aKm: 12929400, e: 0.164, inc: 151.78, periodDays: 550.30 },
  },

  // ---------------- 天王星：Puck + 不规则卫星（JPL Mean Elements, Ref 43）----------------
  puck: {
    radiusKm: 81, rotationHours: 18.283,
    orbit: { aKm: 86004, e: 0.00039, inc: 0.321, periodDays: 0.7618 },
  },
  francisco: {    // 逆行，天王星不规则卫星中轨道最小的一颗
    radiusKm: 11, rotationHours: -6408,
    orbit: { aKm: 4275700, e: 0.144, inc: 146.8, node: 101.9, periodDays: 267 },
  },
  caliban: {
    radiusKm: 36, rotationHours: -13920,
    orbit: { aKm: 7167000, e: 0.200, inc: 141.4, node: 174.9, periodDays: 580 },
  },
  stephano: {
    radiusKm: 16, rotationHours: -16248,
    orbit: { aKm: 7951400, e: 0.235, inc: 143.6, node: 193.3, periodDays: 677 },
  },
  trinculo: {     // 倾角 167.1°，几乎贴着天王星公转的反方向
    radiusKm: 9, rotationHours: -17976,
    orbit: { aKm: 8502600, e: 0.220, inc: 167.1, node: 196.5, periodDays: 749 },
  },
  sycorax: {      // 天王星最大的不规则卫星
    radiusKm: 75, rotationHours: -30864,
    orbit: { aKm: 12193200, e: 0.520, inc: 157.0, node: 267.1, periodDays: 1286 },
  },
  margaret: {     // 天王星唯一**顺行**的不规则卫星（i = 60.5°）
    radiusKm: 10, rotationHours: 39720,
    orbit: { aKm: 14425000, e: 0.642, inc: 60.5, node: 0.9, periodDays: 1655 },
  },
  prospero: {
    radiusKm: 25, rotationHours: -47376,
    orbit: { aKm: 16221000, e: 0.441, inc: 149.4, node: 324.5, periodDays: 1974 },
  },
  setebos: {
    radiusKm: 24, rotationHours: -53160,
    orbit: { aKm: 17519800, e: 0.579, inc: 153.9, node: 244.7, periodDays: 2215 },
  },
  ferdinand: {    // 已知最外侧天王星卫星（~2.04 千万 km）
    radiusKm: 10, rotationHours: -66912,
    orbit: { aKm: 20421400, e: 0.395, inc: 169.2, node: 223.9, periodDays: 2788 },
  },

  // ---------------- 海王星：内卫星 + 不规则卫星 ----------------
  // 内卫星被 Triton 的引力强烈扰动，倾角/偏心率彼此差异很大。
  naiad: {
    radiusKm: 33, rotationHours: 7.056,
    orbit: { aKm: 48224, e: 0.0047, inc: 4.691, periodDays: 0.294 },
  },
  thalassa: {
    radiusKm: 41, rotationHours: 7.464,
    orbit: { aKm: 50074, e: 0.0018, inc: 0.135, periodDays: 0.311 },
  },
  despina: {
    radiusKm: 75, rotationHours: 8.04,
    orbit: { aKm: 52526, e: 0.0004, inc: 0.068, periodDays: 0.335 },
  },
  galatea: {
    radiusKm: 88, rotationHours: 10.296,
    orbit: { aKm: 61953, e: 0.0001, inc: 0.034, periodDays: 0.429 },
  },
  larissa: {
    radiusKm: 97, rotationHours: 13.32,
    orbit: { aKm: 73548, e: 0.0012, inc: 0.205, periodDays: 0.555 },
  },
  hippocampus: {
    radiusKm: 17.4, rotationHours: 22.8,
    orbit: { aKm: 105284, e: 0.0005, inc: 0.0641, periodDays: 0.950 },
  },
  proteus: {      // 海王星第二大卫星，形状明显不规则
    radiusKm: 210, rotationHours: 26.928,
    orbit: { aKm: 117646, e: 0.0005, inc: 0.075, periodDays: 1.122 },
  },
  nereid: {       // 偏心率 0.751，太阳系偏心率最大的卫星之一
    radiusKm: 178, rotationHours: 8643.1,
    orbit: { aKm: 5513818, e: 0.7507, inc: 7.09, periodDays: 360.13 },
  },
  halimede: {     // 逆行
    radiusKm: 31, rotationHours: -45096,
    orbit: { aKm: 16590500, e: 0.521, inc: 119.6, node: 198.5, periodDays: 1879 },
  },
  sao: {          // 顺行
    radiusKm: 20, rotationHours: 70056,
    orbit: { aKm: 22239900, e: 0.296, inc: 50.2, node: 41.8, periodDays: 2919 },
  },
  laomedeia: {    // 顺行
    radiusKm: 20, rotationHours: 76032,
    orbit: { aKm: 23499900, e: 0.419, inc: 36.9, node: 57.6, periodDays: 3168 },
  },
  psamathe: {     // 逆行
    radiusKm: 19, rotationHours: -219576,
    orbit: { aKm: 47646600, e: 0.413, inc: 127.8, node: 302.9, periodDays: 9149 },
  },
  neso: {         // 逆行，已知距海王星最远的卫星（~5 千万 km，接近希尔球边缘）
    radiusKm: 30, rotationHours: -235320,
    orbit: { aKm: 49897800, e: 0.455, inc: 128.4, node: 55.4, periodDays: 9805 },
  },

  // ---------------- 冥王星：小卫星（JPL / Wikipedia）----------------
  // 与卡戎成 1:3.16 / 1:3.89 / 1:5.04 / 1:5.98 的近共振链；轨道近圆且几乎共面。
  styx: {
    radiusKm: 5.5, rotationHours: 483.877,
    orbit: { aKm: 42656, e: 0.00579, inc: 0.81, periodDays: 20.16155 },
  },
  nix: {
    radiusKm: 19, rotationHours: 596.511,
    orbit: { aKm: 48694, e: 0.00204, inc: 0.195, periodDays: 24.85463 },
  },
  kerberos: {
    radiusKm: 6, rotationHours: 772.021,
    orbit: { aKm: 57783, e: 0.00328, inc: 0.389, node: 314.3, periodDays: 32.16756 },
  },
  hydra: {
    radiusKm: 19, rotationHours: 916.842,
    orbit: { aKm: 64738, e: 0.00586, inc: 0.242, node: 114.3, periodDays: 38.20177 },
  },
};
