// src/data/galaxies.js
// 本星系群（Local Group）真实坐标星表 —— 外层空间重构的「落脚点」。
//
// 数据编译自 McConnachie (2012, AJ 144:4) "The Observed Properties of Dwarf
// Galaxies in and around the Local Group" Table 1 与后续 TRGB / 测光距离文献；
// 距离为到银河系（太阳）的距离，单位 kpc。坐标是「以银河系为原点、按天体真实
// 赤经赤纬指向、再用真实距离定深」得到的三维布局——与地球/银河系视角下的本星系
// 群真实方位一致（银河系自身 distKpc=0，落在原点）。
//
// 场景坐标换算：1 场景单位 = LG_KPC_PER_UNIT kpc（默认 100）。本星系群页
// 的 extent≈17，所以 M31(~778kpc)≈7.8 单位、最远外围(~1.4Mpc)≈14 单位，
// 全部落在视野内；卫星星系（LMC ~50kpc、人马座矮星系 ~26kpc）自然聚类在
// 主星系周围，符合真实空间结构。
//
// 接入更多坐标系 / OpenNGC 时，只需在本文件追加条目，或换成解析脚本产物——
// 渲染层(cosmos.js)只认 LG_GALAXIES，不关心数据怎么来的。

export const LG_KPC_PER_UNIT = 100;

// 归属：mw = 银河系卫星；m31 = 仙女座星系卫星；iso = 本星系群外围独立成员
// 行格式：[id, 中文名, 英文名, 形态, 赤经(度), 赤纬(度), 距离kpc, 直径kpc, 归属]
const RAW = [
  // ---------------- 银河系卫星（mw） ----------------
  ['milkyway', '银河系', 'Milky Way', 'SBbc', 266.405, -28.936, 0, 30, 'mw'],
  ['lmc', '大麦哲伦云', 'Large Magellanic Cloud', 'IBm', 80.894, -69.756, 50, 4.3, 'mw'],
  ['smc', '小麦哲伦云', 'Small Magellanic Cloud', 'SBm', 13.187, -72.828, 62, 2.1, 'mw'],
  ['sagittarius', '人马座矮星系', 'Sagittarius dSph', 'dSph', 283.831, -30.479, 26, 2.6, 'mw'],
  ['fornax', '天炉座矮星系', 'Fornax dSph', 'dSph', 39.997, -34.449, 140, 1.9, 'mw'],
  ['sculptor', '玉夫座矮星系', 'Sculptor dSph', 'dSph', 15.039, -33.709, 86, 1.1, 'mw'],
  ['leoI', '狮子座 I 矮星系', 'Leo I', 'dSph', 152.117, 12.306, 250, 0.8, 'mw'],
  ['leoII', '狮子座 II 矮星系', 'Leo II', 'dSph', 168.370, 22.152, 230, 0.6, 'mw'],
  ['sextans', '六分仪座矮星系', 'Sextans dSph', 'dSph', 153.262, -1.615, 90, 1.0, 'mw'],
  ['ursaminor', '小熊座矮星系', 'Ursa Minor dSph', 'dSph', 227.285, 67.223, 76, 0.7, 'mw'],
  ['draco', '天龙座矮星系', 'Draco dSph', 'dSph', 260.052, 57.915, 82, 0.5, 'mw'],
  ['carina', '船底座矮星系', 'Carina dSph', 'dSph', 100.403, -50.966, 105, 0.5, 'mw'],
  ['canesvenaticiI', '猎犬座 I 矮星系', 'Canes Venatici I', 'dSph', 202.235, 33.556, 220, 0.6, 'mw'],
  ['canesvenaticiII', '猎犬座 II 矮星系', 'Canes Venatici II', 'dSph', 194.292, 34.321, 160, 0.4, 'mw'],
  ['bootesI', '牧夫座 I 矮星系', 'Boötes I', 'dSph', 210.016, 14.505, 66, 0.4, 'mw'],
  ['bootesII', '牧夫座 II 矮星系', 'Boötes II', 'dSph', 209.517, 12.864, 42, 0.2, 'mw'],
  ['ursamajorI', '大熊座 I 矮星系', 'Ursa Major I', 'dSph', 158.747, 51.917, 97, 0.3, 'mw'],
  ['ursamajorII', '大熊座 II 矮星系', 'Ursa Major II', 'dSph', 132.877, 63.568, 41, 0.3, 'mw'],
  ['comberes', '后发座矮星系', 'Coma Berenices', 'dSph', 186.745, 23.904, 44, 0.3, 'mw'],
  ['hercules', '武仙座矮星系', 'Hercules', 'dSph', 259.306, 12.791, 132, 0.3, 'mw'],
  ['leoIV', '狮子座 IV 矮星系', 'Leo IV', 'dSph', 173.238, -0.545, 154, 0.3, 'mw'],
  ['leoV', '狮子座 V 矮星系', 'Leo V', 'dSph', 172.644, -0.485, 178, 0.2, 'mw'],
  ['segue1', 'Segue 1', 'Segue 1', 'dSph', 151.767, 16.075, 23, 0.1, 'mw'],
  ['segue2', 'Segue 2', 'Segue 2', 'dSph', 34.192, 20.162, 35, 0.1, 'mw'],
  ['willman1', 'Willman 1', 'Willman 1', 'dSph', 162.488, 51.951, 38, 0.1, 'mw'],
  ['piscesII', '双鱼座 II 矮星系', 'Pisces II', 'dSph', 344.713, 5.951, 183, 0.2, 'mw'],
  ['canesvenaticiIII', '猎犬座 III 矮星系', 'Canes Venatici III', 'dSph', 192.796, 40.346, 150, 0.2, 'mw'],
  ['virgoI', '室女座 I 矮星系', 'Virgo I', 'dSph', 180.041, 0.383, 87, 0.2, 'mw'],
  ['virgoII', '室女座 II 矮星系', 'Virgo II', 'dSph', 187.071, 1.667, 72, 0.2, 'mw'],
  ['cetusII', '鲸鱼座 II 矮星系', 'Cetus II', 'dSph', 20.093, -17.419, 30, 0.1, 'mw'],
  ['tucanaII', '杜鹃座 II 矮星系', 'Tucana II', 'dSph', 23.757, -58.568, 57, 0.2, 'mw'],
  ['grusI', '天鹤座 I 矮星系', 'Grus I', 'dSph', 344.176, -50.216, 120, 0.2, 'mw'],
  ['grusII', '天鹤座 II 矮星系', 'Grus II', 'dSph', 331.385, -46.430, 53, 0.2, 'mw'],
  ['horologiumI', '时钟座 I 矮星系', 'Horologium I', 'dSph', 43.878, -54.650, 79, 0.2, 'mw'],
  ['horologiumII', '时钟座 II 矮星系', 'Horologium II', 'dSph', 49.116, -50.030, 78, 0.2, 'mw'],
  ['reticulumII', '网罟座 II 矮星系', 'Reticulum II', 'dSph', 53.926, -54.051, 32, 0.1, 'mw'],
  ['phoenixII', '凤凰座 II 矮星系', 'Phoenix II', 'dSph', 354.450, -54.443, 95, 0.2, 'mw'],
  ['eridanusIII', '波江座 III 矮星系', 'Eridanus III', 'dSph', 34.950, -52.283, 79, 0.2, 'mw'],
  ['pictorI', '绘架座 I 矮星系', 'Pictor I', 'dSph', 68.855, -50.285, 114, 0.2, 'mw'],
  ['tucanaIII', '杜鹃座 III 矮星系', 'Tucana III', 'dSph', 359.527, -59.584, 25, 0.1, 'mw'],
  ['leoT', '狮子座 T 矮星系', 'Leo T', 'dIrr/dSph', 143.749, 17.050, 420, 0.35, 'mw'],

  // ---------------- 仙女座星系卫星（m31） ----------------
  ['andromeda', '仙女座星系', 'Andromeda (M31)', 'SA(s)b', 10.685, 41.269, 778, 67, 'm31'],
  ['triangulum', '三角座星系', 'Triangulum (M33)', 'SA(s)cd', 23.462, 30.660, 809, 18, 'm31'],
  ['m32', 'M32', 'M32 (NGC 221)', 'cE2', 10.674, 40.865, 778, 2.4, 'm31'],
  ['m110', 'M110', 'M110 (NGC 205)', 'E5', 10.092, 41.685, 778, 5.0, 'm31'],
  ['ngc147', 'NGC 147', 'NGC 147', 'dE5', 8.301, 48.509, 675, 3.7, 'm31'],
  ['ngc185', 'NGC 185', 'NGC 185', 'dE3', 9.743, 48.337, 620, 2.9, 'm31'],
  ['ic10', 'IC 10', 'IC 10', 'dIrr', 5.096, 59.285, 660, 2.8, 'm31'],
  ['andI', '仙女座 I', 'Andromeda I', 'dSph', 11.374, 38.068, 745, 1.0, 'm31'],
  ['andII', '仙女座 II', 'Andromeda II', 'dSph', 8.917, 33.402, 660, 1.4, 'm31'],
  ['andIII', '仙女座 III', 'Andromeda III', 'dSph', 9.759, 36.512, 745, 0.9, 'm31'],
  ['andV', '仙女座 V', 'Andromeda V', 'dSph', 19.532, 47.630, 775, 0.5, 'm31'],
  ['andVI', '仙女座 VI（飞马座）', 'Andromeda VI (Pegasus)', 'dSph', 340.771, 24.473, 775, 0.6, 'm31'],
  ['andVII', '仙女座 VII（仙后座）', 'Andromeda VII (Cassiopeia)', 'dSph', 359.246, 50.689, 760, 1.0, 'm31'],
  ['andVIII', '仙女座 VIII', 'Andromeda VIII', 'dSph', 13.000, 40.900, 760, 1.0, 'm31'],
  ['andIX', '仙女座 IX', 'Andromeda IX', 'dSph', 17.292, 43.227, 765, 0.6, 'm31'],
  ['andX', '仙女座 X', 'Andromeda X', 'dSph', 9.534, 44.864, 730, 0.5, 'm31'],
  ['andXI', '仙女座 XI', 'Andromeda XI', 'dSph', 16.633, 33.773, 780, 0.4, 'm31'],
  ['andXII', '仙女座 XII', 'Andromeda XII', 'dSph', 7.885, 34.824, 790, 0.4, 'm31'],
  ['andXIII', '仙女座 XIII', 'Andromeda XIII', 'dSph', 12.816, 33.515, 780, 0.4, 'm31'],
  ['andXIV', '仙女座 XIV', 'Andromeda XIV', 'dSph', 15.749, 29.735, 790, 0.5, 'm31'],
  ['andXV', '仙女座 XV', 'Andromeda XV', 'dSph', 23.953, 37.722, 770, 0.5, 'm31'],
  ['andXVI', '仙女座 XVI', 'Andromeda XVI', 'dSph', 18.099, 32.385, 525, 0.4, 'm31'],
  ['andXVII', '仙女座 XVII', 'Andromeda XVII', 'dSph', 15.339, 44.898, 790, 0.4, 'm31'],
  ['andXVIII', '仙女座 XVIII', 'Andromeda XVIII', 'dSph', 0.242, 44.938, 1400, 0.5, 'm31'],
  ['andXIX', '仙女座 XIX', 'Andromeda XIX', 'dSph', 351.997, 35.003, 840, 1.0, 'm31'],
  ['andXX', '仙女座 XX', 'Andromeda XX', 'dSph', 22.725, 45.329, 780, 0.4, 'm31'],
  ['andXXI', '仙女座 XXI', 'Andromeda XXI', 'dSph', 352.275, 42.504, 820, 1.0, 'm31'],
  ['andXXII', '仙女座 XXII（双鱼座）', 'Andromeda XXII (Pisces)', 'dSph', 355.446, 20.674, 850, 0.6, 'm31'],
  ['andXXIII', '仙女座 XXIII', 'Andromeda XXIII', 'dSph', 6.790, 38.283, 720, 0.6, 'm31'],
  ['andXXIV', '仙女座 XXIV', 'Andromeda XXIV', 'dSph', 357.642, 46.808, 730, 0.5, 'm31'],
  ['andXXV', '仙女座 XXV', 'Andromeda XXV', 'dSph', 8.436, 47.012, 740, 0.4, 'm31'],
  ['andXXVI', '仙女座 XXVI', 'Andromeda XXVI', 'dSph', 11.226, 47.539, 740, 0.4, 'm31'],
  ['andXXVII', '仙女座 XXVII', 'Andromeda XXVII', 'dSph', 10.071, 48.141, 740, 0.4, 'm31'],
  ['andXXVIII', '仙女座 XXVIII', 'Andromeda XXVIII', 'dSph', 7.623, 31.532, 660, 0.5, 'm31'],
  ['andXXIX', '仙女座 XXIX', 'Andromeda XXIX', 'dSph', 359.579, 30.749, 775, 0.5, 'm31'],
  ['andXXX', '仙女座 XXX', 'Andromeda XXX', 'dSph', 16.083, 41.552, 785, 0.4, 'm31'],
  ['cassiopeia', '仙后座矮星系', 'Cassiopeia Dwarf', 'dSph', 8.989, 50.719, 780, 0.5, 'm31'],

  // ---------------- 本星系群外围独立成员（iso） ----------------
  ['ic1613', '仙王座 A', 'IC 1613', 'IBm', 16.200, 2.118, 730, 4.4, 'iso'],
  ['ngc6822', '巴纳德星系', 'NGC 6822', 'IBm', 296.244, -14.803, 500, 2.1, 'iso'],
  ['wlm', '沃尔夫－伦德马克－梅洛特星系', 'WLM', 'IBm', 0.990, -15.461, 930, 2.5, 'iso'],
  ['ngc3109', 'NGC 3109', 'NGC 3109', 'SBm', 150.884, -26.168, 1300, 5.0, 'iso'],
  ['sextansA', '六分仪座 A', 'Sextans A', 'IBm', 152.605, -4.695, 1380, 1.5, 'iso'],
  ['sextansB', '六分仪座 B', 'Sextans B', 'IBm', 149.236, 5.335, 1420, 1.5, 'iso'],
  ['antlia', '唧筒座矮星系', 'Antlia Dwarf', 'dSph', 154.848, -27.442, 1300, 1.0, 'iso'],
  ['phoenix', '凤凰座矮星系', 'Phoenix Dwarf', 'dSph', 4.434, -44.433, 415, 0.6, 'iso'],
  ['tucana', '杜鹃座矮星系', 'Tucana Dwarf', 'dSph', 354.551, -64.407, 880, 0.7, 'iso'],
  ['cetus', '鲸鱼座矮星系', 'Cetus Dwarf', 'dSph', 34.611, -11.028, 755, 1.0, 'iso'],
  ['sagdig', '人马座矮不规则星系', 'Sagittarius DIG', 'dIrr', 294.982, -16.832, 1050, 1.0, 'iso'],
  ['ugc4879', 'UGC 4879', 'UGC 4879', 'dIrr', 135.171, 53.025, 1100, 1.0, 'iso'],
];

const LY_PER_KPC = 3261.56;

function colorForType(type) {
  // 椭圆 / 矮椭球 / 透镜 → 暖金色；旋涡 / 不规则（恒星形成活跃）→ 冷蓝白
  if (/E|dSph|dE|S0|lenticular/i.test(type)) return [0xffd8b0, '#e0a878'];
  return [0xbfd8ff, '#8fb0e0'];
}

function typeZh(type) {
  if (/dSph/i.test(type)) return '矮椭球';
  if (/dE/i.test(type)) return '矮椭圆';
  if (/E/i.test(type)) return '椭圆';
  if (/SBm|IBm|Im|Irr|dIrr/i.test(type)) return '不规则';
  if (/SA|SB|S\(/i.test(type)) return '旋涡';
  return '矮';
}

function parentZh(sub) {
  return sub === 'mw' ? '银河系' : sub === 'm31' ? '仙女座星系' : '本星系群外围';
}
function parentEn(sub) {
  return sub === 'mw' ? 'the Milky Way' : sub === 'm31' ? 'Andromeda' : 'the outer Local Group';
}

const MAJOR_IDS = ['milkyway', 'andromeda', 'triangulum', 'lmc', 'smc'];

export const LG_GALAXIES = RAW.map(([id, zh, en, type, raDeg, decDeg, distKpc, sizeKpc, sub]) => {
  const rad = Math.PI / 180;
  const ra = raDeg * rad, dec = decDeg * rad;
  // 赤经赤纬 → 单位方向向量（+Y 为北天极，XY 平面为天赤道）
  const dx = Math.cos(dec) * Math.cos(ra);
  const dy = Math.sin(dec);
  const dz = Math.cos(dec) * Math.sin(ra);
  let r = distKpc / LG_KPC_PER_UNIT;
  let pos = [dx * r, dy * r, dz * r];
  // 极远成员（如 And XVIII ~1400kpc）可能顶到视野边缘，钳到 16.5 单位内
  const mag = Math.hypot(pos[0], pos[1], pos[2]);
  const MAX = 16.5;
  if (mag > MAX) pos = pos.map((v) => (v * MAX) / mag);

  const [color, accent] = colorForType(type);
  const tn = typeZh(type);
  const briefZh = `本星系群的${tn}星系，距离银河系约 ${distKpc.toFixed(0)} kpc，绕${parentZh(sub)}运行。`;
  const briefEn = `A ${type} member of the Local Group, ~${distKpc.toFixed(0)} kpc from the Milky Way, orbiting ${parentEn(sub)}.`;

  return {
    id, zh, en, type, raDeg, decDeg, distKpc, sizeKpc, sub,
    pos,
    dLy: distKpc * LY_PER_KPC,
    spanLy: sizeKpc * 1000,            // kpc → 光年
    color, accent,
    briefZh, briefEn,
    major: MAJOR_IDS.includes(id),
  };
});

export const lgById = (id) => LG_GALAXIES.find((g) => g.id === id) ?? null;
export const lgMajorIds = new Set(MAJOR_IDS);

/** 由原始星系条目算场景坐标（供外部 / 调试复用） */
export function lgScenePos(g) {
  const rad = Math.PI / 180;
  const ra = g.raDeg * rad, dec = g.decDeg * rad;
  const dx = Math.cos(dec) * Math.cos(ra);
  const dy = Math.sin(dec);
  const dz = Math.cos(dec) * Math.sin(ra);
  let r = g.distKpc / LG_KPC_PER_UNIT;
  const pos = [dx * r, dy * r, dz * r];
  const mag = Math.hypot(pos[0], pos[1], pos[2]);
  const MAX = 16.5;
  return mag > MAX ? pos.map((v) => (v * MAX) / mag) : pos;
}
