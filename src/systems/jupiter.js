import jupiterMap from '/images/jupiter.jpg';
import ioMap from '/images/jupiterIo.jpg';
import europaMap from '/images/jupiterEuropa.jpg';
import ganymedeMap from '/images/jupiterGanymede.jpg';
import callistoMap from '/images/jupiterCallisto.jpg';
import { starfield } from './shared.js';
import { mk } from './mk.js';

/**
 * 木星系统：17 颗卫星。
 *
 * 三个真实的层次，一看就明白为什么不能全塞进一屏：
 *  - 内卫星（Metis…Thebe）            轨道 12.8–22.2 万 km，几乎贴在木星赤道面上（倾角 < 1.1°）
 *  - 伽利略卫星（Io…Callisto）         轨道 42.2–188.3 万 km，倾角都 < 0.5°
 *  - 不规则卫星（Themisto…Sinope）     轨道 740 万–2370 万 km，被捕获的小行星，
 *                                     偏心率高、倾角大，其中 Ananke/Carme/Pasiphae/Sinope 是**逆行**的
 *
 * 轨道最内侧到最外侧相差 **185 倍**，所以用 views 提供三档取景预设（右上角面板切换）。
 *
 * 尺度：distanceFactor = 1 —— 轨道之间完全真实比例。
 * 代价是内卫星群挤成一团、不规则卫星远在天边；这正是真实情况。
 * radiusPower = 0.35 + minBodyUnits = 0.45：小卫星真实半径只有几到几十公里，
 * 不压缩就不到 1 像素；minBodyUnits 给一个下限，保证点击/缩放后至少看得见。
 */
export default {
  parentSystem: { label: '太阳系', url: 'overview.html' },
  id: 'jupiter',
  label: '木星系统',
  hasSun: false,
  background: starfield,
  timeScale: 0.2,
  camera: { position: [0, 0.42, 1], target: [0, 0, 0], frameTo: 'callisto' },
  views: [
    { id: 'inner', label: '内卫星', frameTo: 'thebe' },
    { id: 'galilean', label: '伽利略卫星', frameTo: 'callisto' },
    { id: 'regular', label: '+希玛利亚群', frameTo: 'elara' },
    { id: 'all', label: '+远距不规则卫星', frameTo: 'auto' },
  ],
  scale: {
    radiusRef: 'jupiter',
    radiusRefUnits: 8,
    radiusPower: 0.35,
    minBodyUnits: 0.45,
    distanceMode: 'linear',
    distanceFactor: 1,
  },
  bodies: [
    mk('jupiter', '木星', {
      noOrbit: true,
      texture: jupiterMap,
      info: {
        赤道半径: '69,911 km', 自转周期: '9 小时 56 分（最快）', 轴倾角: '3.13°',
        卫星数: '95 颗已确认（此处展示 17 颗）',
        简介: '轴倾角只有 3.13°，规则卫星几乎都贴在木星赤道面上；但被捕获的不规则卫星倾角可达 165°。',
      },
    }),

    // ---------- 内卫星 ----------
    mk('metis', '木卫十六（墨提斯）', {
      color: 0x9a9188, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.3, color: 0xd8b48c }, cameraOffset: 6,
      info: { 平均半径: '21.5 km', 轨道半长轴: '127,979 km', 偏心率: '0.0002', 轨道倾角: '0.06°', 公转周期: '0.2948 天', 简介: '木星最内侧卫星，位于主环外缘。' },
    }),
    mk('adrastea', '木卫十五（阿德剌斯忒亚）', {
      color: 0x8f8880, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.3, color: 0xd8b48c }, cameraOffset: 6,
      info: { 平均半径: '8.2 km', 轨道半长轴: '128,980 km', 偏心率: '0.0015', 轨道倾角: '0.03°', 公转周期: '0.2983 天', 简介: '与木卫十六几乎同轨，同样嵌在主环边缘。' },
    }),
    mk('amalthea', '木卫五（阿马尔塞）', {
      color: 0xa08070, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.35, color: 0xd8b48c }, cameraOffset: 7,
      info: { 平均半径: '83.5 km', 轨道半长轴: '181,366 km', 偏心率: '0.0032', 轨道倾角: '0.374°', 公转周期: '0.4982 天', 简介: '形状极不规则、表面偏红的内卫星，直到 1979 年才由旅行者 1 号拍到。' },
    }),
    mk('thebe', '木卫十四（忒拜）', {
      color: 0x93897e, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.35, color: 0xd8b48c }, cameraOffset: 7,
      info: { 平均半径: '49.3 km', 轨道半长轴: '221,890 km', 偏心率: '0.0175', 轨道倾角: '1.076°', 公转周期: '0.6745 天', 简介: '它所在的轨道界定了木星"薄纱环"的外边界。' },
    }),

    // ---------- 伽利略卫星 ----------
    mk('io', '木卫一（艾奥）', {
      texture: ioMap, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.4, color: 0xffe066 },
      cameraOffset: 14,
      info: {
        赤道半径: '1,821.6 km', 轨道半长轴: '421,600 km', 偏心率: '0.0041',
        轨道倾角: '0.05°', 公转周期: '1.769 天',
        简介: '受木星潮汐加热，是太阳系火山活动最剧烈的天体。',
      },
    }),
    mk('europa', '木卫二（欧罗巴）', {
      texture: europaMap, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.4, color: 0xbfe3ff },
      cameraOffset: 14,
      info: {
        赤道半径: '1,560.8 km', 轨道半长轴: '671,034 km', 偏心率: '0.009',
        轨道倾角: '0.47°', 公转周期: '3.551 天',
        简介: '冰壳下很可能有液态水海洋，是搜寻地外生命的首选目标之一。',
      },
    }),
    mk('ganymede', '木卫三（盖尼米德）', {
      texture: ganymedeMap, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.4, color: 0xd8d8d8 },
      cameraOffset: 16,
      info: {
        赤道半径: '2,634.1 km', 轨道半长轴: '1,070,412 km', 偏心率: '0.0013',
        轨道倾角: '0.20°', 公转周期: '7.155 天',
        简介: '太阳系最大的卫星，比水星还大，是唯一拥有自身磁场的卫星。',
      },
    }),
    mk('callisto', '木卫四（卡利斯托）', {
      texture: callistoMap, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.4, color: 0xa89888 },
      cameraOffset: 16,
      info: {
        赤道半径: '2,410.3 km', 轨道半长轴: '1,882,709 km', 偏心率: '0.0074',
        轨道倾角: '0.192°', 公转周期: '16.689 天',
        简介: '表面布满撞击坑且地质活动微弱，保存了太阳系早期的记录。',
      },
    }),

    // ---------- 不规则卫星 ----------
    mk('themisto', '木卫十八（忒弥斯托）', {
      color: 0x8a8a8a, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.25, color: 0x9fb0c0 }, cameraOffset: 6,
      info: { 平均半径: '4.5 km', 轨道半长轴: '7,397,000 km', 偏心率: '0.257（很扁）', 轨道倾角: '44.3°', 公转周期: '129.968 天', 简介: '独立的一颗，不属于任何群；轨道在伽利略卫星与希玛利亚群之间。' },
    }),
    mk('leda', '木卫十三（勒达）', {
      color: 0x8f8f8f, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.22, color: 0xa8a8a8 }, cameraOffset: 6,
      info: { 平均半径: '10 km', 轨道半长轴: '11,145,200 km', 偏心率: '0.162', 轨道倾角: '28.2°', 公转周期: '240.33 天', 简介: '希玛利亚群成员：一批轨道高度相似的顺行碎片，可能源自同一次撞击解体。' },
    }),
    mk('himalia', '木卫六（希玛利亚）', {
      color: 0x9c9691, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.28, color: 0xbfb0a0 }, cameraOffset: 8,
      info: { 平均半径: '85 km', 轨道半长轴: '11,439,000 km', 偏心率: '0.160', 轨道倾角: '28.4°', 公转周期: '249.91 天', 简介: '木星最大的不规则卫星，很可能是被捕获的 C 型小行星。' },
    }),
    mk('lysithea', '木卫十（吕西忒亚）', {
      color: 0x8c8c8c, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.22, color: 0xa8a8a8 }, cameraOffset: 6,
      info: { 平均半径: '18 km', 轨道半长轴: '11,699,100 km', 偏心率: '0.117', 轨道倾角: '27.7°', 公转周期: '258.50 天', 简介: '希玛利亚群成员。' },
    }),
    mk('elara', '木卫七（埃拉腊）', {
      color: 0x8c8c8c, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.25, color: 0xb8b8b8 }, cameraOffset: 7,
      info: { 平均半径: '43 km', 轨道半长轴: '11,710,700 km', 偏心率: '0.212', 轨道倾角: '27.8°', 公转周期: '258.89 天', 简介: '希玛利亚群中第二大的成员。' },
    }),
    mk('ananke', '木卫十二（阿南刻）', {
      color: 0x807e7c, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.25, color: 0x8fa8c0 }, cameraOffset: 6,
      info: { 平均半径: '14.5 km', 轨道半长轴: '21,029,500 km', 偏心率: '0.238', 轨道倾角: '147.6°（逆行）', 公转周期: '623.11 天', 简介: '逆行群代表。所有逆行不规则卫星的名字都以字母 e 结尾。' },
    }),
    mk('carme', '木卫十一（卡尔梅）', {
      color: 0x807e7c, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.25, color: 0x8fa8c0 }, cameraOffset: 6,
      info: { 平均半径: '23 km', 轨道半长轴: '23,139,200 km', 偏心率: '0.261', 轨道倾角: '164.6°（几乎垂直倒转）', 公转周期: '719.28 天', 简介: '卡梅群：倾角约 165°，是木星最"垂直"的一族卫星。' },
    }),
    mk('pasiphae', '木卫八（帕西法厄）', {
      color: 0x7a7876, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.28, color: 0xc0a890 }, cameraOffset: 7,
      info: { 平均半径: '30 km', 轨道半长轴: '23,463,200 km', 偏心率: '0.412（近日 1,380 万 km／远日 3,313 万 km）', 轨道倾角: '148.3°（逆行）', 公转周期: '734.42 天', 简介: '帕西法厄群最大成员，偏心率极高——轨道是一根明显的长椭圆。' },
    }),
    mk('sinope', '木卫九（西诺珀）', {
      color: 0x7a7876, parent: 'jupiter',
      orbit: { showLine: true, opacity: 0.25, color: 0xc0a890 }, cameraOffset: 6,
      info: { 平均半径: '19 km', 轨道半长轴: '23,679,300 km', 偏心率: '0.262', 轨道倾角: '157.3°（逆行）', 公转周期: '744.60 天', 简介: '周期最长的主要木星卫星之一，会因太阳引力摄动在共振态之间反复切换。' },
    }),
  ],
};
