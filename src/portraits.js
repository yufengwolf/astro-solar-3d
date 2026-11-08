/**
 * 星系形态参数表 —— 「每个星系长什么样」的唯一真相源。
 *
 * 分尺度原则（重要，别再一刀切）：
 *   · 在**上级视野**里（本星系群 1000 万光年、宇宙 930 亿光年），一个星系
 *     本来就只有像素级大小，所以仍是「一个点」，靠文字点出身份与直径；
 *   · 在**星系自己的页面**里，观察尺度就是它本身，这时才该画出形态，
 *     而且必须按各自的真实样子画，不能四个星系共用一张旋涡脸。
 *
 * 参数对照真实照片定性调过（M31 的高倾角黄核＋暗尘环、M33 的絮状多臂
 * ＋青绿电离氢区＋橙红尘埃、大小麦哲伦云的不规则棒状），是科普示意，
 * 不是测光重建。所有绘制纯程序化，不依赖外部图片 / 贴图文件。
 *
 * 新增一个星系：在这里加一条，并在 universe.js 的 NODES 里加节点即可。
 */

export const PORTRAITS = {
  // 仙女座 M31：接近侧视的巨型旋涡。照片里最抢眼的是明亮黄白核球、
  // 一圈圈把蓝白星盘切开的暗尘环，以及外围斑驳的蓝色恒星形成区。
  andromeda: {
    shape: 'spiral',
    seed: 31017,
    radius: 10.4,
    inclination: 76,          // 0=正视，90=完全侧视
    positionAngle: -46,       // 屏幕平面内长轴倾角（长轴左上→右下）
    arms: 2,
    armTwist: 0.68,           // 对数螺旋缠绕系数，越大越紧
    armStart: 0.24,
    armWidth: 0.105,
    armContrast: 0.55,        // 旋臂不抢戏，M31 以尘环为主
    flocculent: 0.05,
    bulge: 0.19,
    coreGlow: 0.82,
    diskInner: '#fff0cc',
    diskMid: '#d8dcf0',
    diskOuter: '#8ea9d8',
    armColor: '#dce9ff',
    coreColor: '#fff7de',
    hiiColor: '#a9d0ff',
    hii: 0.45,
    dustRings: [0.30, 0.46, 0.62, 0.80],
    dustWidth: 0.052,
    dustStrength: 0.72,
    diskStars: 9000,
    armStars: 5200,
    foreground: 95,
    morphZh: '接近侧视的巨型旋涡星系：明亮的黄白核球、多重暗尘环与外围蓝色恒星形成区，长轴斜贯画面。',
    morphEn: 'A massive spiral seen nearly edge-on: a bright yellow-white bulge, several dark dust rings and blue outer star-forming regions, with the long axis running diagonally.',
  },

  // 三角座 M33：几乎正对、几乎没有核球的絮状旋涡。照片里是橙红色
  // 尘埃勾出的松散多臂，臂上密布青绿色电离氢区，中心偏冷青绿。
  triangulum: {
    shape: 'flocculent',
    seed: 27018,
    radius: 10.0,
    inclination: 52,
    positionAngle: -24,
    arms: 5,
    armTwist: 0.40,
    armStart: 0.14,
    armWidth: 0.062,
    armContrast: 0.72,
    flocculent: 0.92,         // 臂被拆成断续短段，形成絮状而不是规整两臂
    bulge: 0.055,
    coreGlow: 0.20,
    diskInner: '#a8e8d8',
    diskMid: '#5faeaa',
    diskOuter: '#b8592c',
    outerStart: 0.50,
    armColor: '#e89a62',
    coreColor: '#d8fff0',
    hiiColor: '#8ff0d8',
    hii: 1.35,
    dustRings: [],
    dustWidth: 0.036,
    dustStrength: 0.42,
    dustArc: 0.55,            // 断续的内缘尘弧，而非完整尘环
    diskStars: 7800,
    armStars: 6400,
    foreground: 70,
    morphZh: '几乎正对我们的絮状旋涡星系：没有显著核球，松散的多条旋臂上布满青绿色电离氢区与橙红色尘埃。',
    morphEn: 'A nearly face-on flocculent spiral with almost no bulge: loose, broken arms are dotted with teal H II regions and orange-red dust.',
  },

  // 大麦哲伦云：不规则，有一根偏心的棒和一条残臂，一侧是极亮的
  // 粉红恒星形成区（蜘蛛星云），整体比旋涡星系更「散」。
  lmc: {
    shape: 'irregular',
    seed: 16019,
    radius: 9.0,
    inclination: 48,
    stretch: 0.68,
    positionAngle: 20,
    arms: 1,
    armTwist: 0.34,
    armStart: 0.38,
    armWidth: 0.13,
    armContrast: 0.80,
    flocculent: 0.55,
    bar: 0.50,
    bulge: 0.075,
    coreGlow: 0.18,
    diskInner: '#e6ecff',
    diskMid: '#a8c8ff',
    diskOuter: '#6f8fd0',
    armColor: '#d2e2ff',
    coreColor: '#fff0d8',
    hiiColor: '#ff8fb8',
    hii: 1.25,
    hiiBias: [-0.42, 0.26],   // 蜘蛛星云偏在盘的一侧
    dustRings: [],
    dustWidth: 0.05,
    dustStrength: 0.22,
    diskStars: 7000,
    armStars: 3200,
    foreground: 80,
    morphZh: '不规则棒状星系：没有对称旋臂，一根偏心棒加一条残臂，一侧有明亮的粉红色恒星形成区（蜘蛛星云）。',
    morphEn: 'An irregular barred galaxy with no symmetric arms: an off-centre bar, one stubby arm and bright pink star-forming regions (the Tarantula Nebula) on one side.',
  },

  // 小麦哲伦云：被银河系潮汐拉长，几乎看不出旋臂，以蓝色年轻
  // 恒星和几处零散电离氢区为主，形状比大麦更细长、更暗弱。
  smc: {
    shape: 'irregular',
    seed: 20020,
    radius: 8.4,
    inclination: 42,
    positionAngle: 62,
    arms: 0,
    armTwist: 0.3,
    armStart: 0.4,
    armWidth: 0.12,
    armContrast: 0.5,
    flocculent: 0.7,
    bar: 0.30,
    stretch: 0.58,            // 纵向压扁，呈拉长的棒状云
    bulge: 0.035,
    coreGlow: 0.12,
    diskInner: '#e2ecff',
    diskMid: '#9fb8e8',
    diskOuter: '#5f78b0',
    armColor: '#c6dcff',
    coreColor: '#eaf4ff',
    hiiColor: '#ff9fc0',
    hii: 0.62,
    hiiBias: [0.30, -0.18],
    dustRings: [],
    dustWidth: 0.04,
    dustStrength: 0.18,
    diskStars: 7000,
    armStars: 1600,
    foreground: 65,
    morphZh: '被银河系潮汐拉长的不规则星系：没有明显旋臂，整体呈细长的蓝色恒星云，只有零散的粉红电离氢区。',
    morphEn: 'An irregular galaxy stretched by Milky Way tides: no clear arms, an elongated blue stellar cloud with only scattered pink H II regions.',
  },
};

/** 该节点是否拥有自己的形态页（在宇宙层级页里被调用） */
export const hasPortrait = (nodeId) => Object.prototype.hasOwnProperty.call(PORTRAITS, nodeId);
export const portraitOf = (nodeId) => PORTRAITS[nodeId] ?? null;
