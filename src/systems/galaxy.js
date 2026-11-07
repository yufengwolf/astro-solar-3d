import { starfield } from './shared.js';

/**
 * 银河系（定性示意，非物理精确）。
 *
 * 设计取舍（与"太阳系缩放"同一思路）：
 * - 比例尺：1 场景单位 = 1 千秒差距(kpc)。银盘半径约 15 kpc，太阳距银心约 8.2 kpc。
 * - 旋臂用对数螺旋近似；恒星是一团 THREE.Points 点云（自带柔光贴图），
 *   SagA* 在中心作视觉锚点，太阳是一颗带「下钻」入口的恒星。
 * - 不做"连续缩放穿出太阳系"：float32 跨 13 个数量级精度不可行，而且会卡死。
 *   改用 page 切换作为显式 LOD 边界：
 *     · 在太阳系总览页缩到最外圈再往外滚 → 跳到本页（触发外层空间，停止渲染太阳系细节）
 *     · 点本页的太阳 → 跳回太阳系总览（交叉导航，复用 childSystem 机制）
 *
 * 恒星运动：整个 galaxyGroup 缓慢绕 Y 轴自转（定性"银心旋转"），聚焦某恒星时会冻结。
 */
export default {
  id: 'galaxy',
  label: '银河系',
  hasSun: false,            // 不用中心恒星光照，走方向光分支
  background: starfield,
  extent: 17,              // 取景半径（场景单位），让相机框住整个银盘（含一点余量）
  timeScale: 0,            // 星系自转走 galaxyGroup 专用慢转，不依赖 timeScale
  galaxy: {
    scaleKpc: 1,
    diskRadiusKpc: 15,
    thicknessKpc: 0.7,
    armCount: 4,
    armTwist: 0.9,         // 每 kpc 缠绕弧度（r=15 时约 2.1 圈）
    armSpread: 1.1,        // 旋臂宽度(kpc)
    pointSize: 0.16,
    rotateSpeed: 0.006,    // 银盘整体慢转(弧度/秒)，聚焦时冻结
    armStars: 2600,
    bulgeStars: 900,
    haloStars: 700,
    seed: 20261107,
  },
  camera: { position: [0, 0.62, 1], target: [0, 0, 0], frameTo: 'auto' },
  // 天体用 fixedSize，完全不经过半径换算（星系尺度与行星尺度不在同一把尺子上）
  scale: {},
  bodies: [
    {
      id: 'sagA',
      name: '人马座 A*（银河系中心）',
      star: true,
      fixedSize: 1.1,
      galaxyPos: [0, 0, 0],
      color: 0xffd9a0,
      glowSize: 5,
      info: {
        类型: '超大质量黑洞',
        质量: '约 4.3×10⁶ 太阳质量',
        位置: '银河系动力学中心（银心）',
        简介: '几乎全部银河系恒星都绕着它公转。此处用一颗亮星作视觉锚点，真实中心是一个几乎不可见、吞噬光的黑洞。',
      },
    },
    {
      id: 'sun',
      name: '太阳（我们的恒星）',
      star: true,
      fixedSize: 0.85,
      galaxyPos: [-4.6, 0.02, -6.8], // 距银心 8.2 kpc、落在一条旋臂附近（armTwist=0.9 → 8.2×0.9≈7.38rad）
      color: 0xfff0c0,
      glowSize: 3.2,
      childSystem: 'overview.html',
      childSystemLabel: '太阳系',
      info: {
        位置: '距银心约 8.2 kpc（位于一条旋臂附近）',
        类型: 'G 型主序星（黄矮星）',
        简介: '点击「太阳系」可下钻回我们的行星系统。从银河系尺度看，太阳系只是约 2000 亿颗恒星中普通的一颗。',
      },
    },
  ],
};
