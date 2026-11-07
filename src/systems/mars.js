import marsMap from '/images/marsmap.jpg';
import marsBump from '/images/marsbump.jpg';
import { starfield } from './shared.js';
import { mk } from './mk.js';

/**
 * 火星系统。distanceFactor = 1 → 完全真实比例。
 *
 * 注意：火卫一真实半径仅 11.3 km（约火星的 1/300），按真实比例就是看不见的一个点，
 * 因此两颗卫星用 glb 模型并放大显示，但**轨道半径保持真实**。
 */
export default {
  parentSystem: { label: '太阳系', url: 'overview.html' },
  id: 'mars',
  label: '火星系统',
  hasSun: false,
  background: starfield,
  timeScale: 0.05,
  camera: { position: [0, 0.42, 1], target: [0, 0, 0] },
  scale: {
    radiusRef: 'mars',
    radiusRefUnits: 6.4,
    radiusPower: 0.6,
    distanceMode: 'linear',
    distanceFactor: 1, // 火卫二轨道仅 6.9 倍火星半径，本就可以 1:1 呈现
  },
  bodies: [
    mk('mars', '火星', {
      noOrbit: true,
      texture: marsMap, bump: marsBump,
      info: {
        赤道半径: '3,389.5 km', 自转周期: '24 小时 37 分', 轴倾角: '25.19°',
        卫星数: '2（火卫一、火卫二）',
        简介: '火星位于原点只做自转；两颗卫星的轨道在此按真实比例呈现。',
      },
    }),
    mk('phobos', '火卫一（福波斯）', {
      parent: 'mars',
      // radiusUnits：模型缩放到该场景半径（火卫一真实半径只有 0.02 单位，不放大看不见）
      model: { path: './images/mars/phobos.glb', radiusUnits: 1.2 },
      orbit: { showLine: true, opacity: 0.35, color: 0xffc0a0 },
      cameraOffset: 12,
      info: {
        赤道半径: '约 11.3 km', 轨道半长轴: '9,376 km', 偏心率: '0.0151',
        轨道倾角: '1.075°', 公转周期: '7 小时 39 分',
        简介: '公转比火星自转还快，因此在火星上它每天西升东落两次；正缓慢向火星坠落。',
      },
    }),
    mk('deimos', '火卫二（得摩斯）', {
      parent: 'mars',
      model: { path: './images/mars/deimos.glb', radiusUnits: 0.9 },
      orbit: { showLine: true, opacity: 0.35, color: 0xa8c8ff },
      cameraOffset: 12,
      info: {
        赤道半径: '约 6.2 km', 轨道半长轴: '23,463 km', 偏心率: '0.00033（几乎正圆）',
        轨道倾角: '1.788°', 公转周期: '30 小时 18 分',
        简介: '形状不规则，很可能是一颗被火星捕获的小天体。',
      },
    }),
  ],
};
