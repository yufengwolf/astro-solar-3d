import earthDay from '/images/earth_daymap.jpg';
import earthAtmosphere from '/images/earth_atmosphere.jpg';
import moonMap from '/images/moonmap.jpg';
import moonBump from '/images/moonbump.jpg';
import { starfield } from './shared.js';
import { mk } from './mk.js';

/**
 * 地月系统：地球只自转（不公转），月球自转 + 绕地公转。
 *
 * 尺度：
 * - 轨道距离 distanceFactor = 0.22 —— 真实比例下月球轨道是地球半径的 60 倍，
 *   按 1:1 渲染时地球只有几个像素。这里把"天体大小 vs 轨道距离"的比值放大约 4.5 倍，
 *   但**月球轨道本身的形状和相对位置仍是真实的**（见下）。
 * - 月球半径用 radiusPower 0.6 轻微放大，避免小到看不见。
 * - 想要完全 1:1，把 distanceFactor 改成 1、radiusPower 改成 1。
 */
export default {
  // 上级系统由 src/universe.js 的层级注册表统一提供
  id: 'earth-moon',
  label: '地月系统',
  hasSun: false,
  background: starfield,
  timeScale: 2, // 天/秒：月球约 14 秒绕一圈
  camera: { position: [0, 0.42, 1], target: [0, 0, 0] },
  scale: {
    radiusRef: 'earth',
    radiusRefUnits: 6.4,
    radiusPower: 0.6,
    distanceMode: 'linear',
    distanceFactor: 0.22,
  },
  bodies: [
    mk('earth', '地球', {
      noOrbit: true, // 子系统中心天体：只自转，不绕原点公转
      texture: earthDay, atmosphere: earthAtmosphere, atmosphereRotateHours: 25.5,
      info: {
        赤道半径: '6,371 km', 自转周期: '23 小时 56 分 4 秒', 轴倾角: '23.44°',
        卫星数: '1（月球）',
        简介: '本系统中地球位于坐标原点，只做自转，不再绕太阳公转。',
      },
    }),
    mk('moon', '月球', {
      texture: moonMap, bump: moonBump, parent: 'earth',
      orbit: { showLine: true, opacity: 0.35, color: 0xdddddd },
      cameraOffset: 12,
      info: {
        赤道半径: '1,737.4 km', 轨道半长轴: '384,400 km', 偏心率: '0.0549',
        轨道倾角: '5.145°（相对黄道）', 公转周期: '27.32 天', 自转周期: '27.32 天（潮汐锁定）',
        简介: '轨道倾角 5.1° 是日食并非每月都发生的原因——只有新月恰好经过黄道附近时才会遮挡太阳。',
      },
    }),
  ],
};
