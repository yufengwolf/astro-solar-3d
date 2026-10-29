import plutoMap from '/images/plutomap.jpg';
import { starfield } from './shared.js';
import { mk } from './mk.js';

/**
 * 冥王星系统：全部 5 颗卫星。
 *
 * 卡戎（Charon）直径约为冥王星的一半、轨道半径仅 19,591 km（约 16.5 倍冥王星半径），
 * 两者互相潮汐锁定，质心落在冥王星本体之外——因此常被称为"双矮行星系统"。
 *
 * 4 颗小卫星（Styx / Nix / Kerberos / Hydra）与卡戎成
 * 1:3.16 / 1:3.89 / 1:5.04 / 1:5.98 的近共振链，轨道近圆且几乎共面（倾角 < 1°），
 * 很可能是同一次大撞击的碎片。
 *
 * 尺度：distanceFactor = 0.7、radiusPower = 0.4、minBodyUnits = 0.4。
 */
export default {
  id: 'pluto',
  label: '冥王星系统',
  hasSun: false,
  background: starfield,
  timeScale: 0.3,
  camera: { position: [0, 0.42, 1], target: [0, 0, 0], frameTo: 'charon' },
  views: [
    { id: 'charon', label: '冥卫一', frameTo: 'charon' },
    { id: 'all', label: '五颗卫星全览', frameTo: 'auto' },
  ],
  scale: {
    radiusRef: 'pluto',
    radiusRefUnits: 3,
    radiusPower: 0.4,
    minBodyUnits: 0.4,
    distanceMode: 'linear',
    distanceFactor: 0.7,
  },
  bodies: [
    mk('pluto', '冥王星', {
      noOrbit: true,
      texture: plutoMap,
      info: {
        赤道半径: '1,188.3 km', 自转周期: '6.39 天（逆向）', 轴倾角: '122.53°',
        卫星数: '5（此处全部展示）',
        简介: '自转轴倾角 122.53°，同样是"倒着"自转。表面有氮冰构成的斯普特尼克平原。',
      },
    }),
    mk('charon', '冥卫一（卡戎）', {
      color: 0xa8a8a8, parent: 'pluto',
      orbit: { showLine: true, opacity: 0.45, color: 0xc8c8d8 },
      cameraOffset: 12,
      info: {
        赤道半径: '606 km', 轨道半长轴: '19,591 km', 偏心率: '0.0002',
        轨道倾角: '0.08°', 公转周期: '6.387 天',
        简介: '直径约为冥王星的一半，两者互相潮汐锁定；系统质心位于冥王星本体之外，因此常被视作双星系统。',
      },
    }),
    mk('styx', '冥卫五（斯提克斯）', {
      color: 0x9a9a9a, parent: 'pluto',
      orbit: { showLine: true, opacity: 0.3, color: 0xb8b8c8 }, cameraOffset: 5,
      info: { 平均半径: '约 5.5 km', 轨道半长轴: '42,656 km', 偏心率: '0.00579', 轨道倾角: '0.81°', 公转周期: '20.162 天', 简介: '最小也最内侧的小卫星，2012 年由哈勃发现，形状约 16×9×8 km。' },
    }),
    mk('nix', '冥卫二（尼克斯）', {
      color: 0xa2a2a2, parent: 'pluto',
      orbit: { showLine: true, opacity: 0.35, color: 0xb8b8c8 }, cameraOffset: 6,
      info: { 平均半径: '约 19 km', 轨道半长轴: '48,694 km', 偏心率: '0.00204', 轨道倾角: '0.195°', 公转周期: '24.855 天', 简介: '长约 50 km 的细长天体，反照率异常高；自转也是混沌的。' },
    }),
    mk('kerberos', '冥卫四（刻耳柏洛斯）', {
      color: 0x959595, parent: 'pluto',
      orbit: { showLine: true, opacity: 0.3, color: 0xb8b8c8 }, cameraOffset: 5,
      info: { 平均半径: '约 6 km', 轨道半长轴: '57,783 km', 偏心率: '0.00328', 轨道倾角: '0.389°', 公转周期: '32.168 天', 简介: '双瓣形状、反照率很高；新视野号原本担心这里的撞击碎片，结果平安穿越。' },
    }),
    mk('hydra', '冥卫三（许德拉）', {
      color: 0xa4a4a4, parent: 'pluto',
      orbit: { showLine: true, opacity: 0.35, color: 0xb8b8c8 }, cameraOffset: 6,
      info: { 平均半径: '约 19 km', 轨道半长轴: '64,738 km', 偏心率: '0.00586', 轨道倾角: '0.242°', 公转周期: '38.202 天', 简介: '最外侧的小卫星，表面几乎纯水冰。' },
    }),
  ],
};
