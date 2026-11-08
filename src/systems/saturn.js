import saturnMap from '/images/saturnmap.jpg';
import saturnRing from '/images/saturn_ring.png';
import { starfield } from './shared.js';
import { mk } from './mk.js';

/**
 * 土星系统：16 颗卫星。
 *
 * 新增的亮点（都很有"科普感"）：
 *  - 牧羊犬卫星 Prometheus / Pandora：一内一外夹着 F 环
 *  - Janus / Epimetheus：**共用同一条轨道**，每约 4 年互换一次内外位置
 *  - Telesto / Calypso：土卫三的前后特洛伊卫星（L4 / L5）
 *  - Helene：土卫四的特洛伊卫星
 *  - Hyperion：自转混沌、形状像海绵的不规则大卫星
 *  - Phoebe：**逆行**（倾角 151.78°），可能是被捕获的柯伊伯带天体
 *
 * 为什么没画 Pan / Daphnis / Atlas：它们真实轨道（13.4–13.8 万 km）
 * 真的**埋在**A 环内部（A 环外缘 13.68 万 km）。画出来只会嵌进环贴图里看不见，
 * 所以这里从序号较小的三颗起跳过，保留 F 环以外的部分。
 *
 * 尺度取舍：
 *  - distanceFactor = 1：轨道之间完全真实比例。土卫一在 3.19 倍土星半径处、
 *    环外径 2.35 倍半径（真实 A 环外缘 2.35 倍），刚好错开。
 *  - radiusPower = 0.35 / minBodyUnits = 0.4：Helene 半径只有土星的 1/330。
 *  - views 提供三档取景：主卫星（到土卫六）／到土卫八／全含逆行的土卫九。
 */
export default {
  // 上级系统由 src/universe.js 的层级注册表统一提供
  id: 'saturn',
  label: '土星系统',
  hasSun: false,
  background: starfield,
  timeScale: 0.5,
  camera: { position: [0, 0.42, 1], target: [0, 0, 0], frameTo: 'titan' },
  views: [
    { id: 'shepherd', label: '牧羊犬·中层卫星', frameTo: 'rhea' },
    { id: 'major', label: '主卫星（至土卫六）', frameTo: 'titan' },
    { id: 'iapetus', label: '至土卫八', frameTo: 'iapetus' },
    { id: 'all', label: '+逆行的土卫九', frameTo: 'auto' },
  ],
  scale: {
    radiusRef: 'saturn',
    radiusRefUnits: 8,
    radiusPower: 0.35,
    minBodyUnits: 0.4,
    distanceMode: 'linear',
    distanceFactor: 1,
  },
  bodies: [
    mk('saturn', '土星', {
      noOrbit: true,
      texture: saturnMap,
      ring: { texture: saturnRing, innerScale: 1.24, outerScale: 2.35 },
      info: {
        赤道半径: '58,232 km', 自转周期: '10 小时 39 分', 轴倾角: '26.73°',
        卫星数: '146 颗已确认（此处展示 16 颗）',
        简介: '环系位于赤道面上并随 26.73° 轴倾角一起倾斜，因此地球上看到的环张角会周期性变化。',
      },
    }),

    // ---------- 牧羊犬卫星 / 共轨道 ----------
    mk('prometheus', '土卫十六（普罗米修斯）', {
      color: 0xa8a29a, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.3, color: 0xcfcfcf }, cameraOffset: 6,
      info: { 平均半径: '42.1 km', 轨道半长轴: '139,380 km', 偏心率: '0.0022', 轨道倾角: '0.008°', 公转周期: '0.613 天', 简介: 'F 环内侧牧羊犬卫星，细长的形状像个土豆；它会不断"拉扯"F 环形成弯折结构。' },
    }),
    mk('pandora', '土卫十七（潘多拉）', {
      color: 0xa8a29a, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.3, color: 0xcfcfcf }, cameraOffset: 6,
      info: { 平均半径: '40.7 km', 轨道半长轴: '141,720 km', 偏心率: '0.0042', 轨道倾角: '0.050°', 公转周期: '0.629 天', 简介: 'F 环外侧牧羊犬卫星，与普罗米修斯的引力相互作用让两者轨道呈混沌变化。' },
    }),
    mk('epimetheus', '土卫十一（厄庇墨透斯）', {
      color: 0xb0aaa2, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.3, color: 0xcfcfcf }, cameraOffset: 7,
      info: { 平均半径: '58.1 km', 轨道半长轴: '151,422 km（与土卫十共轨）', 偏心率: '0.0098', 轨道倾角: '0.335°', 公转周期: '0.694 天', 简介: '和土卫十共用同一条轨道，每约 4 年互相"交换"一次内外位置，是太阳系唯一的共轨道卫星对。' },
    }),
    mk('janus', '土卫十（雅努斯）', {
      color: 0xb0aaa2, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.3, color: 0xcfcfcf }, cameraOffset: 7,
      info: { 平均半径: '89 km', 轨道半长轴: '151,460 km（与土卫十一共轨）', 偏心率: '0.0068', 轨道倾角: '0.163°', 公转周期: '0.695 天', 简介: '可能是大撞击后从同一母体分裂出来的两块碎片之一。' },
    }),

    // ---------- 中层大卫星 ----------
    mk('mimas', '土卫一（弥玛斯）', {
      color: 0x9c9c9c, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.35, color: 0xcfcfcf }, cameraOffset: 10,
      info: { 赤道半径: '198.2 km', 轨道半长轴: '185,539 km', 偏心率: '0.0196', 轨道倾角: '1.566°', 公转周期: '0.942 天', 简介: '表面的赫歇尔撞击坑让它形似"死星"。倾角 1.57° 是中层大卫星里最大的。' },
    }),
    mk('enceladus', '土卫二（恩克拉多斯）', {
      color: 0xe8e8e8, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.35, color: 0xdddddd }, cameraOffset: 10,
      info: { 赤道半径: '252.1 km', 轨道半长轴: '237,948 km', 偏心率: '0.0047', 轨道倾角: '0.009°', 公转周期: '1.370 天', 简介: '反照率接近 1，是太阳系已知最反光的天体；南极喷出含盐水汽羽流。' },
    }),
    mk('tethys', '土卫三（忒堤斯）', {
      color: 0xbfbfbf, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.35, color: 0xcfcfcf }, cameraOffset: 11,
      info: { 赤道半径: '531 km', 轨道半长轴: '294,619 km', 偏心率: '0.0001', 轨道倾角: '1.091°', 公转周期: '1.888 天', 简介: '拥有一条长达 2,000 km 的巨型峡谷伊萨卡峡谷。' },
    }),
    mk('telesto', '土卫十三（忒勒斯托）', {
      color: 0xb4b4b4, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.28, color: 0xc0c0c0 }, cameraOffset: 6,
      info: { 平均半径: '12.5 km', 轨道半长轴: '294,619 km（土卫三 L4）', 偏心率: '0.0002', 轨道倾角: '1.19°', 公转周期: '1.888 天', 简介: '位于土卫三轨道前方 60° 的特洛伊卫星。' },
    }),
    mk('calypso', '土卫十四（卡吕普索）', {
      color: 0xb4b4b4, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.28, color: 0xc0c0c0 }, cameraOffset: 6,
      info: { 平均半径: '10.7 km', 轨道半长轴: '294,629 km（土卫三 L5）', 偏心率: '0.0005', 轨道倾角: '1.56°', 公转周期: '1.888 天', 简介: '位于土卫三轨道后方 60° 的特洛伊卫星。' },
    }),
    mk('dione', '土卫四（狄俄涅）', {
      color: 0xcacaca, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.35, color: 0xcfcfcf }, cameraOffset: 11,
      info: { 赤道半径: '561.4 km', 轨道半长轴: '377,396 km', 偏心率: '0.0022', 轨道倾角: '0.028°', 公转周期: '2.737 天', 简介: '表面有大量明亮的冰崖，可能是构造活动造成的。' },
    }),
    mk('helene', '土卫十二（海伦）', {
      color: 0xc0c0c0, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.3, color: 0xc8c8c8 }, cameraOffset: 6,
      info: { 平均半径: '17.6 km', 轨道半长轴: '377,396 km（土卫四 L4）', 偏心率: '0.007', 轨道倾角: '0.21°', 公转周期: '2.737 天', 简介: '土卫四的前方特洛伊卫星，卡西尼曾近距离拍摄过它的"双叶"地形。' },
    }),
    mk('rhea', '土卫五（瑞亚）', {
      color: 0xc4c4c4, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.35, color: 0xcfcfcf }, cameraOffset: 12,
      info: { 赤道半径: '763.8 km', 轨道半长轴: '527,108 km', 偏心率: '0.001', 轨道倾角: '0.35°', 公转周期: '4.518 天', 简介: '土星第二大卫星，可能拥有稀薄的氧气／二氧化碳外逸层。' },
    }),
    mk('titan', '土卫六（泰坦）', {
      color: 0xc9a06a, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.45, color: 0xffcc88 }, cameraOffset: 16,
      info: { 赤道半径: '2,574.7 km', 轨道半长轴: '1,221,870 km', 偏心率: '0.0288', 轨道倾角: '0.33°', 公转周期: '15.945 天', 简介: '唯一拥有浓密大气的卫星，表面有液态甲烷湖泊与河流。' },
    }),
    mk('hyperion', '土卫七（许珀里翁）', {
      color: 0x9a8f84, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.35, color: 0xd0c4b0 }, cameraOffset: 10,
      info: { 平均半径: '133 km', 轨道半长轴: '1,481,010 km', 偏心率: '0.123（明显椭圆）', 轨道倾角: '0.43°', 公转周期: '21.28 天', 简介: '自转完全混沌——永远无法预测下一刻朝向哪。受土卫六共振扰动，表面像海绵。' },
    }),
    mk('iapetus', '土卫八（伊阿珀托斯）', {
      color: 0x8a8378, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.4, color: 0xbfb0a0 }, cameraOffset: 16,
      info: { 赤道半径: '734.5 km', 轨道半长轴: '3,560,820 km', 偏心率: '0.0286', 轨道倾角: '15.47°（明显倾斜）', 公转周期: '79.32 天', 简介: '轨道倾角高达 15.5°，是土星大卫星中唯一的例外；两面明暗差异极大（"阴阳脸"）。' },
    }),

    // ---------- 不规则逆行卫星 ----------
    mk('phoebe', '土卫九（菲比）', {
      color: 0x8d8b88, parent: 'saturn',
      orbit: { showLine: true, opacity: 0.3, color: 0xb0a0c0 }, cameraOffset: 10,
      info: { 平均半径: '106.5 km', 轨道半长轴: '12,929,400 km', 偏心率: '0.164', 轨道倾角: '151.78°（逆行）', 公转周期: '550.30 天', 简介: '最大的土星不规则卫星，逆行且几乎垂直——它很可能来自柯伊伯带，被土星捕获。' },
    }),
  ],
};
