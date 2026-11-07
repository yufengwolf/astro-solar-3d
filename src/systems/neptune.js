import neptuneMap from '/images/neptune.jpg';
import { starfield } from './shared.js';
import { mk } from './mk.js';

/**
 * 海王星系统：全部 14 颗已确认卫星都画上了。
 *
 * 两个"教科书级"的反常点：
 *  1. 海卫一（Triton）是唯一**逆行**公转的大卫星：倾角 156.865°，
 *     方向与其他卫星相反——几乎可以肯定它是被捕获的柯伊伯带天体。
 *     它的引力也把原生的内卫星系统搅得七零八落，这正是 Neptune
 *     内层轨道杂乱、Hippocamp 紧挨着 Proteus 的原因。
 *  2. 海卫二（Nereid）偏心率 0.751，是太阳系偏心率最大的卫星之一，
 *     近/远海王星距离相差约 7 倍。
 *
 * 外圈的 5 颗不规则卫星（Halimede…Neso）轨道在 1,660 万–4,990 万 km，
 * 是内 satellite 系统的上百倍，只能在"+不规则卫星"取景档里看到。
 *
 * 尺度：distanceFactor = 0.7、radiusPower = 0.35、minBodyUnits = 0.45。
 * 注意内层 7 颗真实轨道只差几千 km，半径为让它们可见而被放大，
 * 因此会显得彼此挨得很近（真实情况就是这么挤）。
 */
export default {
  parentSystem: { label: '太阳系', url: 'overview.html' },
  id: 'neptune',
  label: '海王星系统',
  hasSun: false,
  background: starfield,
  timeScale: 0.3,
  camera: { position: [0, 0.42, 1], target: [0, 0, 0], frameTo: 'triton' },
  views: [
    { id: 'triton', label: '海卫一', frameTo: 'triton' },
    { id: 'inner', label: '内层小卫星', frameTo: 'proteus' },
    { id: 'all', label: '+不规则卫星', frameTo: 'auto' },
  ],
  scale: {
    radiusRef: 'neptune',
    radiusRefUnits: 8,
    radiusPower: 0.35,
    minBodyUnits: 0.45,
    distanceMode: 'linear',
    distanceFactor: 0.7,
  },
  bodies: [
    mk('neptune', '海王星', {
      noOrbit: true,
      texture: neptuneMap,
      info: {
        赤道半径: '24,622 km', 自转周期: '16 小时 6 分', 轴倾角: '28.32°',
        卫星数: '14 颗已确认（此处全部展示）',
        简介: '风速可超 2,000 km/h，是太阳系风暴最猛烈之处。',
      },
    }),

    // ---------- 内层小卫星（被 Triton 引力搅动，轨道极拥挤）----------
    mk('naiad', '海卫三（奈阿德）', {
      color: 0x9a9a9a, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.3, color: 0xa8b8c8 }, cameraOffset: 6,
      info: { 平均半径: '33 km', 轨道半长轴: '48,224 km', 偏心率: '0.0047', 轨道倾角: '4.691°', 公转周期: '0.294 天', 简介: '最内侧卫星，仅距海王星表面约 2.4 万 km；倾角 4.7° 在内层中偏大。' },
    }),
    mk('thalassa', '海卫四（塔拉萨）', {
      color: 0x9e9e9e, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.3, color: 0xa8b8c8 }, cameraOffset: 6,
      info: { 平均半径: '41 km', 轨道半长轴: '50,074 km', 偏心率: '0.0018', 轨道倾角: '0.135°', 公转周期: '0.311 天', 简介: '与海卫三只隔约 1,850 km 轨道距离——真实得令人惊讶。' },
    }),
    mk('despina', '海卫五（得斯蓬娜）', {
      color: 0xa2a2a2, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.3, color: 0xa8b8c8 }, cameraOffset: 6,
      info: { 平均半径: '75 km', 轨道半长轴: '52,526 km', 偏心率: '0.0004', 轨道倾角: '0.068°', 公转周期: '0.335 天', 简介: '位于勒威耶环内缘附近。' },
    }),
    mk('galatea', '海卫六（伽拉忒亚）', {
      color: 0xa2a2a2, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.3, color: 0xa8b8c8 }, cameraOffset: 6,
      info: { 平均半径: '88 km', 轨道半长轴: '61,953 km', 偏心率: '0.0001', 轨道倾角: '0.034°', 公转周期: '0.429 天', 简介: '它是亚当斯环那几段"弧"的牧羊犬卫星，靠共振把环物质聚成弧状。' },
    }),
    mk('larissa', '海卫七（拉里萨）', {
      color: 0xa6a6a6, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.32, color: 0xa8b8c8 }, cameraOffset: 7,
      info: { 平均半径: '97 km', 轨道半长轴: '73,548 km', 偏心率: '0.0012', 轨道倾角: '0.205°', 公转周期: '0.555 天', 简介: '内层最大的一颗，形状不规则且撞击坑密布。' },
    }),
    mk('hippocampus', '海卫十四（海马）', {
      color: 0x9c9c9c, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.3, color: 0xa8b8c8 }, cameraOffset: 6,
      info: { 平均半径: '17.4 km', 轨道半长轴: '105,284 km', 偏心率: '0.0005', 轨道倾角: '0.0641°', 公转周期: '0.950 天', 简介: '2013 年才被发现，可能是海卫八被撞击后剥落下来的碎片。' },
    }),
    mk('proteus', '海卫八（普罗透斯）', {
      color: 0xa8a8a8, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.35, color: 0xb8c8d8 }, cameraOffset: 9,
      info: { 平均半径: '210 km', 轨道半长轴: '117,646 km', 偏心率: '0.0005', 轨道倾角: '0.075°', 公转周期: '1.122 天', 简介: '海王星第二大卫星，形状极不规则——几乎是"能被自身引力压成球形"的上限。' },
    }),

    // ---------- 大卫星 ----------
    mk('triton', '海卫一（特里同）', {
      color: 0xd2cbc4, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.45, color: 0xffb0b0 },
      cameraOffset: 16,
      info: {
        赤道半径: '1,353.4 km', 轨道半长轴: '354,759 km', 偏心率: '0.000016（几乎完美正圆）',
        轨道倾角: '156.865°（逆行）', 公转周期: '5.877 天（逆行）',
        简介: '唯一逆行公转的大卫星，几乎可以肯定是被海王星捕获的柯伊伯带天体；表面有活跃的氮气间歇泉。',
      },
    }),

    // ---------- 不规则卫星 ----------
    mk('nereid', '海卫二（涅瑞伊得斯）', {
      color: 0xb0b0b0, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.3, color: 0xc0c0d0 }, cameraOffset: 8,
      info: { 平均半径: '178 km', 轨道半长轴: '5,513,818 km', 偏心率: '0.7507（极扁）', 轨道倾角: '7.09°', 公转周期: '360.13 天', 简介: '偏心率 0.751 让它近/远海王星相差约 7 倍，可能也是被捕获天体。' },
    }),
    mk('halimede', '海卫九（哈利米德）', {
      color: 0x8f8f8f, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.22, color: 0xa0b0c0 }, cameraOffset: 6,
      info: { 平均半径: '31 km', 轨道半长轴: '16,590,500 km', 偏心率: '0.521', 轨道倾角: '119.6°（逆行）', 公转周期: '1,879 天', 简介: '可能与海卫二同源：有可能是它在一次撞击中抛出的碎片。' },
    }),
    mk('sao', '海卫十一（萨俄）', {
      color: 0x8c8c8c, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.22, color: 0xa0b0c0 }, cameraOffset: 6,
      info: { 平均半径: '20 km', 轨道半长轴: '22,239,900 km', 偏心率: '0.296', 轨道倾角: '50.2°（顺行）', 公转周期: '2,919 天', 简介: '顺行的不规则卫星之一，位于 Sao–Laomedeia 共振群。' },
    }),
    mk('laomedeia', '海卫十二（拉俄墨得亚）', {
      color: 0x8c8c8c, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.22, color: 0xa0b0c0 }, cameraOffset: 6,
      info: { 平均半径: '20 km', 轨道半长轴: '23,499,900 km', 偏心率: '0.419', 轨道倾角: '36.9°（顺行）', 公转周期: '3,168 天', 简介: '顺行不规则卫星，与海卫十一共享相近的距离尺度。' },
    }),
    mk('psamathe', '海卫十（普萨玛忒）', {
      color: 0x8a8a8a, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.22, color: 0xa0b0c0 }, cameraOffset: 6,
      info: { 平均半径: '19 km', 轨道半长轴: '47,646,600 km', 偏心率: '0.413', 轨道倾角: '127.8°（逆行）', 公转周期: '9,149 天', 简介: '逆行不规则卫星，周期长达 25 年。' },
    }),
    mk('neso', '海卫十三（涅索）', {
      color: 0x8a8a8a, parent: 'neptune',
      orbit: { showLine: true, opacity: 0.22, color: 0xa0b0c0 }, cameraOffset: 6,
      info: { 平均半径: '30 km', 轨道半长轴: '49,897,800 km', 偏心率: '0.455', 轨道倾角: '128.4°（逆行）', 公转周期: '9,805 天', 简介: '已知距海王星最远的卫星（近 5,000 万 km，接近希尔球边缘），绕一圈要 26.8 年。' },
    }),
  ],
};
