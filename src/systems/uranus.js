import uranusMap from '/images/uranus.jpg';
import uranusRing from '/images/uranus_ring.png';
import { starfield } from './shared.js';
import { mk } from './mk.js';

/**
 * 天王星系统：15 颗卫星（5 大卫星 + Puck + 9 颗不规则卫星）。
 *
 * 天王星轴倾角 97.77°，自转轴几乎躺平，而卫星仍贴在赤道面上——
 * 于是整个卫星系统看起来是"竖着"转的，这是真实的、不是渲染错误。
 *
 * 不规则卫星群很有意思：**9 颗里 8 颗逆行**，只有 Margaret 是顺行的
 * （倾角 60.5°）。它们的偏心率极大（Sycorax 0.52、Margaret 0.64、
 * Setebos 0.58），轨道是一根根很扁的椭圆。轨道元素取自 JPL Mean Elements。
 *
 * 尺度：distanceFactor = 0.6，radiusPower = 0.35 / minBodyUnits = 0.4。
 * 未画 Cordelia…Belinda 等 13 颗小环卫星：它们真实轨道在 4.98–7.6 万 km，
 * 而 ε 环位于 5.1 万 km（2.0 倍天王星半径），画出来会全部埋进环贴图里。
 */
export default {
  id: 'uranus',
  label: '天王星系统',
  hasSun: false,
  background: starfield,
  timeScale: 0.5,
  camera: { position: [0, 0.42, 1], target: [0, 0, 0], frameTo: 'oberon' },
  views: [
    { id: 'major', label: '五大卫星', frameTo: 'oberon' },
    { id: 'nearIrr', label: '不规则·近群', frameTo: 'trinculo' },
    { id: 'all', label: '+不规则卫星全览', frameTo: 'auto' },
  ],
  scale: {
    radiusRef: 'uranus',
    radiusRefUnits: 8,
    radiusPower: 0.35,
    minBodyUnits: 0.4,
    distanceMode: 'linear',
    distanceFactor: 0.6, // 天卫五轨道仅 5.1 倍天王星半径，环外径 2.0 倍，需留出不重叠的余量
  },
  bodies: [
    mk('uranus', '天王星', {
      noOrbit: true,
      texture: uranusMap,
      ring: { texture: uranusRing, innerScale: 1.6, outerScale: 2.0 },
      info: {
        赤道半径: '25,362 km', 自转周期: '17 小时 14 分（逆向）', 轴倾角: '97.77°',
        卫星数: '27 颗已确认（此处展示 15 颗）',
        简介: '轴倾角 97.77° 意味着它是"躺着"自转的，环与卫星系统也随之近乎垂直于轨道面。',
      },
    }),

    // ---------- 内侧 / 五大卫星 ----------
    mk('puck', '天卫十五（帕克）', {
      color: 0x9e9e9e, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.35, color: 0xc8c8c8 }, cameraOffset: 8,
      info: { 平均半径: '81 km', 轨道半长轴: '86,004 km', 偏心率: '0.00039', 轨道倾角: '0.321°', 公转周期: '0.7618 天', 简介: '五大卫星之外最大的天王星内卫星，1985 年由旅行者 2 号拍到。' },
    }),
    mk('miranda', '天卫五（米兰达）', {
      color: 0xb0b0b0, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.4, color: 0xcfcfcf }, cameraOffset: 10,
      info: { 赤道半径: '235.8 km', 轨道半长轴: '129,900 km', 偏心率: '0.0013', 轨道倾角: '4.34°', 公转周期: '1.413 天', 简介: '表面有高达 20 km 的维罗纳断崖，是太阳系最高的悬崖之一。倾角 4.34° 在五大卫星中最突出。' },
    }),
    mk('ariel', '天卫一（爱丽儿）', {
      color: 0xcbcbcb, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.4, color: 0xcfcfcf }, cameraOffset: 11,
      info: { 赤道半径: '578.9 km', 轨道半长轴: '190,900 km', 偏心率: '0.0012', 轨道倾角: '0.04°', 公转周期: '2.520 天', 简介: '表面年轻且明亮，布满断层与峡谷，显示曾有地质活动。' },
    }),
    mk('umbriel', '天卫二（乌姆柏里厄尔）', {
      color: 0x8f8f8f, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.4, color: 0xcfcfcf }, cameraOffset: 11,
      info: { 赤道半径: '584.7 km', 轨道半长轴: '266,000 km', 偏心率: '0.0039', 轨道倾角: '0.13°', 公转周期: '4.144 天', 简介: '五颗大卫星中最暗的一颗，表面古老且缺乏地质改造痕迹。' },
    }),
    mk('titania', '天卫三（泰坦妮亚）', {
      color: 0xb8b8b8, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.4, color: 0xcfcfcf }, cameraOffset: 12,
      info: { 赤道半径: '788.4 km', 轨道半长轴: '435,910 km', 偏心率: '0.0011', 轨道倾角: '0.08°', 公转周期: '8.706 天', 简介: '天王星最大的卫星，表面有大型峡谷系统。' },
    }),
    mk('oberon', '天卫四（奥伯龙）', {
      color: 0xa5a5a5, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.4, color: 0xcfcfcf }, cameraOffset: 12,
      info: { 赤道半径: '761.4 km', 轨道半长轴: '583,520 km', 偏心率: '0.0014', 轨道倾角: '0.07°', 公转周期: '13.463 天', 简介: '最外侧的大卫星，表面撞击坑密布，坑底常有暗色物质。' },
    }),

    // ---------- 不规则卫星（除 Margaret 外全部逆行）----------
    mk('francisco', '天卫二十二（弗朗西斯科）', {
      color: 0x8a8a8a, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.22, color: 0x9fb0c0 }, cameraOffset: 6,
      info: { 平均半径: '11 km', 轨道半长轴: '4,275,700 km', 偏心率: '0.144', 轨道倾角: '146.8°（逆行）', 公转周期: '267 天', 简介: '轨道最小的天王星不规则卫星，也是最晚被确认的一批。' },
    }),
    mk('caliban', '天卫十六（卡利班）', {
      color: 0x8f8f8f, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.25, color: 0xa8b0c0 }, cameraOffset: 6,
      info: { 平均半径: '36 km', 轨道半长轴: '7,167,000 km', 偏心率: '0.200', 轨道倾角: '141.4°（逆行）', 公转周期: '580 天', 简介: '1997 年发现的首批天王星不规则卫星之一，表面偏红。' },
    }),
    mk('stephano', '天卫二十（斯特凡诺）', {
      color: 0x8a8a8a, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.22, color: 0xa8b0c0 }, cameraOffset: 6,
      info: { 平均半径: '16 km', 轨道半长轴: '7,951,400 km', 偏心率: '0.235', 轨道倾角: '143.6°（逆行）', 公转周期: '677 天', 简介: '轨道与卡利班相近，同属被捕获的远古小天体群。' },
    }),
    mk('trinculo', '天卫二十一（特林库洛）', {
      color: 0x8a8a8a, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.22, color: 0xa8b0c0 }, cameraOffset: 6,
      info: { 平均半径: '9 km', 轨道半长轴: '8,502,600 km', 偏心率: '0.220', 轨道倾角: '167.1°（几乎垂直倒转）', 公转周期: '749 天', 简介: '倾角近乎垂直，轨道面几乎与天王星赤道面垂直倒置。' },
    }),
    mk('sycorax', '天卫十七（西科拉克斯）', {
      color: 0x94918e, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.28, color: 0xb8a8c0 }, cameraOffset: 8,
      info: { 平均半径: '75 km', 轨道半长轴: '12,193,200 km', 偏心率: '0.520（很扁）', 轨道倾角: '157.0°（逆行）', 公转周期: '1,286 天', 简介: '天王星最大的不规则卫星，偏心率高达 0.52。' },
    }),
    mk('margaret', '天卫二十三（玛格丽特）', {
      color: 0x9c9c9c, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.28, color: 0xc0b0d0 }, cameraOffset: 6,
      info: { 平均半径: '10 km', 轨道半长轴: '14,425,000 km', 偏心率: '0.642（全系统最扁）', 轨道倾角: '60.5°（顺行）', 公转周期: '1,655 天', 简介: '天王星唯一顺行的不规则卫星（有别于其他 8 颗）。' },
    }),
    mk('prospero', '天卫十八（普洛斯彼罗）', {
      color: 0x8c8c8c, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.22, color: 0xb0a8c0 }, cameraOffset: 6,
      info: { 平均半径: '25 km', 轨道半长轴: '16,221,000 km', 偏心率: '0.441', 轨道倾角: '149.4°（逆行）', 公转周期: '1,974 天', 简介: '偏心率 0.44，近日点与远日点相差 5 倍以上。' },
    }),
    mk('setebos', '天卫十九（塞特博斯）', {
      color: 0x8c8c8c, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.22, color: 0xb0a8c0 }, cameraOffset: 6,
      info: { 平均半径: '24 km', 轨道半长轴: '17,519,800 km', 偏心率: '0.579', 轨道倾角: '153.9°（逆行）', 公转周期: '2,215 天', 简介: '轨道高度偏心，倾角接近垂直倒置。' },
    }),
    mk('ferdinand', '天卫二十四（费迪南德）', {
      color: 0x8a8a8a, parent: 'uranus',
      orbit: { showLine: true, opacity: 0.22, color: 0xb0a8c0 }, cameraOffset: 6,
      info: { 平均半径: '10 km', 轨道半长轴: '20,421,400 km', 偏心率: '0.395', 轨道倾角: '169.2°（逆行）', 公转周期: '2,788 天', 简介: '已知距天王星最远的卫星，轨道周期超过 7.6 年。' },
    }),
  ],
};
