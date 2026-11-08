import { starfield } from './shared.js';

// ---------- 比例尺分档 ----------
// 1 场景单位 = 1 kpc = 3261.56 光年。每档取景半径严格 10× 递减，
// 第 0 档 radiusKpc=17 与既有 extent 一致（画面直径 ≈ 11 万光年，正好整个银盘）。
// 标签里的「光年」是画面直径，与 radiusKpc 自洽：17 kpc×2 ≈ 11 万 ly，1.7 kpc×2 ≈ 1.1 万 ly…
export const LY_PER_KPC = 3261.56;
export const SCALE_TIERS = [
  // short 是比例尺按钮上的文字：中文模式直接显示「光年」，不再用看不懂的 ly。
  // 英文模式的短标签由 i18n.tierShort() 按 spanLy 生成。
  { label: '10 万光年', short: '10万光年', spanLy: 100000, radiusKpc: 17 },
  { label: '1 万光年', short: '1万光年', spanLy: 10000, radiusKpc: 1.7 },
  { label: '1 千光年', short: '1千光年', spanLy: 1000, radiusKpc: 0.17 },
  { label: '100 光年', short: '100光年', spanLy: 100, radiusKpc: 0.017 },
  { label: '10 光年', short: '10光年', spanLy: 10, radiusKpc: 0.0017 },
  { label: '1 光年', short: '1光年', spanLy: 1, radiusKpc: 0.00017 },
];

// 天体「属于」哪一档：选一个刚好框得住它、又不至于空旷的视野。
export function tierForDistance(dLy) {
  for (let i = SCALE_TIERS.length - 1; i >= 0; i--) {
    if (dLy <= SCALE_TIERS[i].spanLy * 0.75) return i;
  }
  return 0;
}

// J2000 赤道坐标 → 银道坐标 (l, b)。标准球面三角，常数取 IAU 1958 银道极：
// 北银极 RA=192.85948°, Dec=+27.12825°，银心方向 l_NCP=122.93192°。
// 自检：Sgr A* (266.4168°, −29.0078°) → l=359.944°, b=−0.046°；北银极 → b=90°。
function equatorialToGalactic(raDeg, decDeg) {
  const a = raDeg * Math.PI / 180, d = decDeg * Math.PI / 180;
  const ap = 192.85948 * Math.PI / 180, dp = 27.12825 * Math.PI / 180;
  const lNCP = 122.93192 * Math.PI / 180;
  const sinB = Math.sin(d) * Math.sin(dp) + Math.cos(d) * Math.cos(dp) * Math.cos(a - ap);
  const b = Math.asin(Math.max(-1, Math.min(1, sinB)));
  const y = Math.cos(d) * Math.sin(a - ap);
  const x = Math.sin(d) * Math.cos(dp) - Math.cos(d) * Math.sin(dp) * Math.cos(a - ap);
  const l = ((lNCP - Math.atan2(y, x)) * 180 / Math.PI % 360 + 360) % 360;
  return [l, b * 180 / Math.PI];
}

// ---------- 邻近恒星 / 星团 / 系外行星系统（比例尺小档才出现） ----------
// 距离取 Hipparcos / Gaia / RECONS 与 Messier 星表主流值；RA/Dec 为 J2000，
// 由上面的公式换算成 l/b，再复用 galacticToScene 得到真实相对太阳的位置。
// 大档时它们与太阳重合成一个像素，由窗口过滤自动隐藏；小档才逐个分离出来。
const NEARBY_STARS = [
  { id: 'proxima', name: '比邻星（半人马座 αC）', group: '邻近恒星', ra: 217.42896, dec: -62.67944, dLy: 4.24, color: 0xff8a6a, type: '红矮星 · 耀星', brief: '离太阳最近的恒星。拥有宜居带行星「比邻星 b」，也是「南门二」三合星系统最外层的成员。' },
  { id: 'alphaCen', name: '南门二（半人马座 α）', group: '邻近恒星', ra: 219.9021, dec: -60.8339, dLy: 4.37, color: 0xffe8b0, type: '三合星系统', brief: '全天第三亮星，由两颗类太阳恒星加比邻星组成，是离我们最近的恒星系统。' },
  { id: 'barnard', name: '巴纳德星', group: '邻近恒星', ra: 269.4521, dec: 4.6933, dLy: 5.96, color: 0xff9a70, type: '红矮星', brief: '已知自行速度最快的恒星，每年在天上移动约 10 角秒，也在缓慢向太阳靠近。' },
  { id: 'sirius', name: '天狼星（大犬座 α）', group: '邻近恒星', ra: 101.2871, dec: -16.7161, dLy: 8.60, color: 0xc8dcff, type: 'A1V 主序星 + 白矮星伴星', brief: '全天最亮恒星，蓝白色。伴星天狼 B 是一颗地球大小、质量却接近太阳的白矮星。' },
  { id: 'procyon', name: '南河三（小犬座 α）', group: '邻近恒星', ra: 114.8254, dec: 5.2250, dLy: 11.46, color: 0xfff0d0, type: 'F5 IV-V 亚巨星', brief: '小犬座主星，与天狼星、参宿四构成「冬季大三角」，同样带白矮星伴星。' },
  { id: 'altair', name: '河鼓二（牛郎星）', group: '邻近恒星', ra: 297.6958, dec: 8.8683, dLy: 16.73, color: 0xd8e8ff, type: 'A7V 主序星', brief: '天鹰座 α，与织女星隔银河相望。自转极快（约 9 小时），被甩成明显的扁球形。' },
  { id: 'vega', name: '织女星（天琴座 α）', group: '邻近恒星', ra: 279.2346, dec: 38.7836, dLy: 25.04, color: 0xc4d8ff, type: 'A0V 主序星', brief: '天琴座主星、0 等亮星，曾是（也将再度成为）北极星。周围有尘埃盘，是标准测光基准星。' },
  { id: 'pollux', name: '北河三（双子座 β）', group: '邻近恒星', ra: 116.3288, dec: 28.0261, dLy: 33.78, color: 0xffc890, type: 'K0 III 橙巨星', brief: '双子座最亮星，已确认拥有系外行星，是「亮星带行星」的经典案例。' },
  { id: 'arcturus', name: '大角星（牧夫座 α）', group: '邻近恒星', ra: 213.9154, dec: 19.1825, dLy: 36.7, color: 0xffb070, type: 'K1.5 III 红巨星', brief: '北天最亮的橙红巨星，正以高速穿过银盘，属于一个古老的星流。' },
  { id: 'capella', name: '五车二（御夫座 α）', group: '邻近恒星', ra: 79.1725, dec: 45.9981, dLy: 42.9, color: 0xffe0a0, type: '双巨星系统', brief: '御夫座主星，肉眼看似一颗，实为两对巨星组成的四合星系统。' },
  { id: 'aldebaran', name: '毕宿五（金牛座 α）', group: '邻近恒星', ra: 68.9804, dec: 16.5092, dLy: 65.0, color: 0xffa860, type: 'K5 III 橙巨星', brief: '金牛座的「牛眼」，视觉上落在毕星团前方，其实与星团无关，距离只有它的一半。' },
  { id: 'canopus', name: '老人星（船底座 α）', group: '邻近恒星', ra: 95.9879, dec: -52.6956, dLy: 310.0, color: 0xe8f0ff, type: 'A9 II 亮巨星', brief: '全天第二亮星，南天显著。亮度极高，常被用作航天器导航的基准星。' },
  { id: 'polaris', name: '北极星（勾陈一）', group: '邻近恒星', ra: 37.9542, dec: 89.2642, dLy: 433.0, color: 0xfff2d0, type: 'F7 Ib 造父变星 · 三合星', brief: '当前最靠近北天极的亮星，也是经典的造父变星，靠光变周期可测宇宙距离。' },
  { id: 'betelgeuse', name: '参宿四（猎户座 α）', group: '邻近恒星', ra: 88.7929, dec: 7.4069, dLy: 550.0, color: 0xff7040, type: 'M1-2 Ia 红超巨星', brief: '猎户座左肩，直径约为太阳的 900 倍，已到演化末期，未来会以超新星爆发终结。' },
  { id: 'antares', name: '心宿二（天蝎座 α）', group: '邻近恒星', ra: 247.3519, dec: -26.4319, dLy: 550.0, color: 0xff6a48, type: 'M1.5 Iab 红超巨星', brief: '古称「大火」，色红似火星，西方名意为「火星的对手」，是天蝎座心脏位置的红超巨星。' },
  { id: 'rigel', name: '参宿七（猎户座 β）', group: '邻近恒星', ra: 78.6346, dec: -8.2017, dLy: 850.0, color: 0xb8d0ff, type: 'B8 Ia 蓝超巨星', brief: '猎户座右脚，实际比参宿四更亮，是银河系里最明亮的蓝超巨星之一。' },
  { id: 'hyades', name: '毕星团', group: '疏散星团', ra: 66.75, dec: 15.8667, dLy: 153.0, color: 0xffd9a8, type: '疏散星团', brief: '离太阳最近的疏散星团，肉眼可见的 V 字形，与昴星团同属一个古老星流。' },
  { id: 'pleiades', name: '昴星团 M45（七姐妹）', group: '疏散星团', ra: 56.85, dec: 24.1167, dLy: 444.0, color: 0xa8c8ff, type: '疏散星团 + 反射星云', brief: '肉眼最易辨认的年轻蓝星团，年龄约 1 亿年，周围包裹着蓝色的反射星云。' },
  { id: 'm7', name: '托勒密星团 M7', group: '疏散星团', ra: 268.4625, dec: -34.7928, dLy: 980.0, color: 0xc8dcff, type: '疏散星团', brief: '公元 130 年托勒密就记录过它，肉眼可见的模糊光斑，位于天蝎座尾端。' },
  { id: 'm6', name: '蝴蝶星团 M6', group: '疏散星团', ra: 265.0875, dec: -32.2542, dLy: 1600.0, color: 0xc8d8ff, type: '疏散星团', brief: '双筒望远镜里几十颗蓝白恒星排成蝴蝶翅膀，其中一颗橙巨星格外醒目。' },
  { id: 'peg51', name: '飞马座 51（首颗热木星母星）', group: '系外行星系统', ra: 344.3667, dec: 20.7689, dLy: 50.6, color: 0xffe0a0, type: '类太阳恒星 + 热木星', brief: '1995 年在这里发现人类第一颗绕主序星运行的系外行星，开创系外行星天文学，获 2019 诺贝尔物理学奖。' },
  { id: 'kepler452', name: '开普勒 452（类地行星系统）', group: '系外行星系统', ra: 296.0042, dec: 44.2775, dLy: 1800.0, color: 0xffe8b8, type: '类太阳恒星 + 超级地球', brief: '「地球 2.0」：行星轨道与恒星辐照都接近地球，位于天鹅座的宜居带内。' },
];

// ---------- 深空天体（只收录坐标与距离有可靠公开来源者） ----------
// 为什么用银道坐标 (l, b, d)：l/b 是从太阳看去的方向，d 是距太阳距离，
// 这样"相对太阳系的位置"才是可查证的真实数据，而不是随手摆的点。
// 为什么不收亮星/疏散星团/系外行星：天狼星 8.6 ly、织女 25 ly、昴星团 440 ly、
// 比邻星 4.2 ly……在 15 kpc 银盘上全都与太阳重合为一个像素，加进去反而误导。
// 只保留 kpc 级、且坐标可查的天体，才能真正让银河系"有内容"又站得住。
//
// 数据来源（l/b 单位度，d 单位 千秒差距）：
//  · 恒星形成区/星云 M42/M8/M20/M16/NGC3372：ApJ (2018) 大质量恒星形成区表，Gaia 距离
//  · 蟹状星云 M1：NASA/IPAC NED、SIMBAD（l=184.567, b=−5.777, d≈2.0）
//  · 天鹅座 X-1：ApJ 965,172 (2024)（l=71.33, b=3.07, d=2.22）
//  · 球状星团 ωCen / 47Tuc：arXiv:2306.01765 表1（Harris 星表）；M22：GGCs / A&A (2011)
//  · 未采用的：环状星云 M57、马头星云 IC434 等查不到可靠 l/b/d，按约定不加
const SUN_GALACTIC_POS = [-7.73, 0.02, 2.74]; // 太阳：距银心 8.2 kpc，位于主旋臂

// 银道坐标 → 场景坐标。基向量：l=0 指向银心，+Y 为北银极，l=90 沿盘面与之正交。
// 自洽性检验：l=0,b=0,d=8.2 应回到银心 (0,0,0)。
function galacticToScene(l, b, d) {
  const S = SUN_GALACTIC_POS;
  const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
  const norm = (v) => { const m = Math.hypot(...v); return v.map((x) => x / m); };
  const X = norm(S.map((v) => -v));           // l=0：太阳 → 银心
  const Y = norm(cross([0, 1, 0], X));        // l=90
  const Z = norm(cross(X, Y));                // b=+90：北银极
  const L = l * Math.PI / 180, B = b * Math.PI / 180;
  const u = d * Math.cos(B) * Math.cos(L);
  const v = d * Math.cos(B) * Math.sin(L);
  const w = d * Math.sin(B);
  return [
    // 精度必须到 1e-9 kpc（≈0.003 光年）：原先的 toFixed(3) 是 3.26 光年，
    // 会把 4~10 光年的邻近恒星全部舍入成「和太阳同一个点」，比例尺小档就失效了。
    +(S[0] + u * X[0] + v * Y[0] + w * Z[0]).toFixed(9),
    +(S[1] + u * X[1] + v * Y[1] + w * Z[1]).toFixed(9),
    +(S[2] + u * X[2] + v * Y[2] + w * Z[2]).toFixed(9),
  ];
}

// kind 决定放大后的展示形态：星云/遗迹→生成图片精灵；球状星团→点云球；黑洞→暗球+吸积环
const DEEP_SKY = [
  {
    id: 'm42', name: '猎户座大星云 M42', navGroup: '星云与遗迹', kind: 'nebula',
    l: 209.0, b: -19.4, d: 0.41, seed: 4201, color: 0xff8fbf,
    palette: ['255,90,150', '90,170,255', '255,180,120', '150,110,255'],
    info: {
      类型: '发射星云 · 恒星诞生区',
      距离: '约 1,340 光年（0.41 千秒差距）',
      银道坐标: '银经 = 209.0°，银纬 = −19.4°',
      简介: '离我们最近的大质量恒星形成区，肉眼可见的模糊光斑。核心的「猎户四边形」四颗年轻恒星照亮了整片气体云。',
    },
  },
  {
    id: 'm8', name: '礁湖星云 M8', navGroup: '星云与遗迹', kind: 'nebula',
    l: 6.0, b: -1.2, d: 1.17, seed: 8001, color: 0xff7d9e,
    palette: ['255,70,110', '255,140,170', '120,140,255', '255,210,180'],
    info: {
      类型: '发射星云 · 恒星诞生区',
      距离: '约 3,800 光年（1.17 千秒差距）',
      银道坐标: '银经 = 6.0°，银纬 = −1.2°（近银心方向）',
      简介: '人马座方向的明亮大星云，一条暗尘埃带把它劈成两半，因而得名「礁湖」。核心有著名的沙漏结构。',
    },
  },
  {
    id: 'm20', name: '三叶星云 M20', navGroup: '星云与遗迹', kind: 'nebula',
    l: 7.1, b: -0.3, d: 1.57, seed: 2001, color: 0xff6f9f,
    palette: ['255,60,100', '90,140,255', '255,170,200', '120,190,255'],
    info: {
      类型: '发射 + 反射复合星云',
      距离: '约 5,100 光年（1.57 千秒差距）',
      银道坐标: '银经 = 7.1°，银纬 = −0.3°',
      简介: '三条暗尘埃带把红色电离氢云切成三瓣，是彩色星云里最经典的一张「教科书照片」。',
    },
  },
  {
    id: 'm16', name: '鹰星云 M16（创生之柱）', navGroup: '星云与遗迹', kind: 'nebula',
    l: 17.0, b: 0.8, d: 1.71, seed: 1601, color: 0x8fd0ff,
    palette: ['90,170,255', '255,170,110', '120,220,200', '255,120,150'],
    info: {
      类型: '发射星云 · 疏散星团',
      距离: '约 5,600 光年（1.71 千秒差距）',
      银道坐标: '银经 = 17.0°，银纬 = +0.8°',
      简介: '哈勃 1995 年拍下的「创生之柱」让这里成为最著名的恒星摇篮；柱内正孕育着新生恒星。',
    },
  },
  {
    id: 'ngc3372', name: '船底座星云 NGC 3372', navGroup: '星云与遗迹', kind: 'nebula',
    l: 287.7, b: -0.8, d: 2.6, seed: 3372, color: 0xffa070,
    palette: ['255,110,80', '255,190,120', '110,190,255', '255,90,140'],
    info: {
      类型: '超大发射星云',
      距离: '约 8,500 光年（2.6 千秒差距）',
      银道坐标: '银经 = 287.7°，银纬 = −0.8°（船底–人马臂）',
      简介: '比猎户座大星云大四倍、也更亮，内部藏着高光度蓝变星「海山二」。韦布空间望远镜首批影像的「宇宙悬崖」就在这里。',
    },
  },
  {
    id: 'm1', name: '蟹状星云 M1', navGroup: '星云与遗迹', kind: 'remnant',
    l: 184.567, b: -5.777, d: 2.0, seed: 1054, color: 0x9fd8ff,
    palette: ['255,140,80', '120,190,255', '255,200,120', '180,120,255'],
    info: {
      类型: '超新星遗迹 · 脉冲风星云',
      距离: '约 6,500 光年（2.0 千秒差距）',
      银道坐标: '银经 = 184.57°，银纬 = −5.78°',
      简介: '公元 1054 年中国天象官记录的「天关客星」遗迹，中心是每秒自转 30 圈的蟹状星云脉冲星。',
    },
  },
  {
    id: 'cygx1', name: '天鹅座 X-1', navGroup: '致密天体', kind: 'blackhole',
    l: 71.33, b: 3.07, d: 2.22, seed: 7101, color: 0xffb066,
    info: {
      类型: '恒星级黑洞 · X 射线双星',
      距离: '约 7,200 光年（2.22 千秒差距）',
      银道坐标: '银经 = 71.33°，银纬 = +3.07°',
      简介: '人类最早确认的恒星级黑洞，约 21 倍太阳质量，正从伴星吸积气体并发出强 X 射线。',
    },
  },
  {
    id: 'omegaCen', name: '半人马座 ω 星团', navGroup: '球状星团', kind: 'cluster',
    l: 309.10, b: 14.97, d: 5.2, seed: 5139, color: 0xffe2a8,
    info: {
      类型: '球状星团（银河系最大）',
      距离: '约 17,000 光年（5.2 千秒差距）',
      银道坐标: '银经 = 309.10°，银纬 = +14.97°（明显高出银盘）',
      简介: '含数百万颗老年恒星，是银河系最大最亮的球状星团；天文学家怀疑它其实是被吞并矮星系留下的核心。',
    },
  },
  {
    id: 'tuc47', name: '杜鹃座 47 星团', navGroup: '球状星团', kind: 'cluster',
    l: 305.89, b: -44.89, d: 4.5, seed: 1041, color: 0xffe6b8,
    info: {
      类型: '球状星团（全天第二亮）',
      距离: '约 14,700 光年（4.5 千秒差距）',
      银道坐标: '银经 = 305.89°，银纬 = −44.89°（远在银盘之下）',
      简介: '南天最壮观的球状星团之一，年龄约 130 亿年，拥有大量毫秒脉冲星与「蓝离散星」。',
    },
  },
  {
    id: 'm22', name: 'M22 人马座大星团', navGroup: '球状星团', kind: 'cluster',
    l: 9.89, b: -7.55, d: 3.2, seed: 6656, color: 0xffe0a0,
    info: {
      类型: '球状星团（近银心方向）',
      距离: '约 10,400 光年（3.2 千秒差距）',
      银道坐标: '银经 = 9.89°，银纬 = −7.55°',
      简介: '北半球可见的最亮球状星团之一，也是最早被发现的球状星团（1665 年）；内部竟含有行星状星云。',
    },
  },
];

// 银河系尺度上它们「只是一个点」：极小的自发光标记 + 小光晕，不画大。
// 点击左侧菜单聚焦后，才在原地显示放大的示意图像（见 main.js makeDeepSkyShowcase）。
const deepSkyBodies = DEEP_SKY.map((o) => {
  const dLy = o.d * LY_PER_KPC;
  return {
    id: o.id,
    name: o.name,
    star: true,
    fixedSize: 0.07,
    glowSize: 0.42,
    color: o.color,
    galaxyPos: galacticToScene(o.l, o.b, o.d),
    dLy,
    tier: tierForDistance(dLy),
    navGroup: o.navGroup,
    deepSky: { kind: o.kind, palette: o.palette, seed: o.seed, l: o.l, b: o.b, d: o.d },
    info: o.info,
  };
});

// 邻近恒星：银河系大档里它们与太阳重合，靠 dLy 窗口过滤；
// 档位越细才逐个分离出现，正好补上用户最初清单里那批著名恒星。
const nearbyBodies = NEARBY_STARS.map((o) => {
  const [l, b] = equatorialToGalactic(o.ra, o.dec);
  const dKpc = o.dLy / LY_PER_KPC;
  return {
    id: o.id,
    name: o.name,
    star: true,
    fixedSize: 0.07,
    glowSize: 0.42,
    color: o.color,
    galaxyPos: galacticToScene(l, b, dKpc),
    dLy: o.dLy,
    tier: tierForDistance(o.dLy),
    navGroup: o.group,
    info: {
      类型: o.type,
      距离: `约 ${o.dLy < 10 ? o.dLy.toFixed(2) : Math.round(o.dLy)} 光年`,
      银道坐标: `银经 = ${l.toFixed(2)}°，银纬 = ${b.toFixed(2)}°`,
      简介: o.brief,
    },
  };
});

/**
 * 银河系（定性示意，非物理精确）。
 *
 * 设计取舍（与"太阳系缩放"同一思路）：
 * - 比例尺：1 场景单位 = 1 千秒差距(kpc)。银盘半径约 15 kpc，太阳距银心约 8.2 kpc。
 * - 旋臂用对数螺旋近似（总缠绕 < 1 圈）：2 条主旋臂 + 6 条错落的次旋臂 + 羽状支臂，
 *   构成絮状多旋臂（贴近真实星系照片，而非 4 条等间距整齐长臂）；
 *   恒星是一团 THREE.Points 点云（自带柔光贴图 + 加法混合），
 *   SagA* 在中心作视觉锚点，太阳位于一条主旋臂上，是一颗带「下钻」入口的恒星。
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
  extent: 17,              // 第 0 档取景半径（场景单位），框住整个银盘
  scaleTiers: SCALE_TIERS, // 6 档比例尺（10 万 / 1 万 / 1 千 / 100 / 10 / 1 光年）
  sunPos: SUN_GALACTIC_POS,// 小档的观察焦点：太阳（大档焦点仍是银心原点）
  timeScale: 0,            // 星系自转走 galaxyGroup 专用慢转，不依赖 timeScale
  galaxy: {
    scaleKpc: 1,
    diskRadiusKpc: 15,
    thicknessKpc: 0.6,
    // 对数螺旋（关键）：总缠绕 < 1 圈 → 开放的 S 形旋涡，而非"绕满一圈=同心环蚊香"
    armThetaMax: 4.0,      // 旋臂总缠绕弧度（4.0≈0.64 圈；调大更卷、>5 会开始像蚊香）
    armRMin: 2.0,          // 旋臂起始半径(kpc)，从核球外缘伸出
    // —— 2 条主旋臂：贯穿全盘、最粗最亮最密 ——
    mainArmCount: 2,
    mainArmStars: 3800,    // 主旋臂星数（密集 → 在加法混合下叠出明亮辉光带）
    mainArmWidth: 0.10,    // 主旋臂角向半宽(rad)，收得紧所以是一条清晰的亮带
    mainArmRadial: 0.45,   // 主旋臂径向厚度(kpc)
    mainArmBrightness: 1.35,   // 主旋臂亮度系数（最亮，但不过曝，留住蓝/粉颜色）
    // —— 6 条次旋臂：起始角/长短错落，形成"旋臂挺多"的丰富感但不整齐 ——
    minorArmCount: 6,
    minorArmStars: 1200,   // 每条次臂星数（提密，让多条臂都看得清）
    minorArmWidth: 0.055,  // 次旋臂更窄
    minorArmRadial: 0.28,
    minorArmBrightness: 0.82,  // 暗于主臂，但足够可见（"旋臂挺多"的关键）
    minorArmStartMin: 0.06,    // 次臂起始 t 下限（错落，不都从中心长出）
    minorArmStartMax: 0.36,    // 次臂起始 t 上限
    // —— 羽状支臂：从旋臂分叉出的细碎短片段，絮状感的关键 ——
    spurCount: 46,         // 分叉数量（更多细碎分支）
    spurStars: 75,         // 每条分叉星数
    spurBrightness: 0.7,   // 提亮，让分叉可辨认但不抢主臂
    spurShear: 1.9,        // 分叉相对宿主臂的角向剪切强度（越大分叉越张开）
    spurLenT: 0.22,        // 分叉沿 t 的长度（加长，羽状感更明显）
    spurWidth: 0.035,
    spurRadial: 0.2,
    pointSize: 0.2,
    rotateSpeed: 0.006,    // 银盘整体慢转(弧度/秒)，聚焦时冻结
    interArmStars: 100,    // 臂间几乎掏空，只留极暗背景
    bulgeStars: 900,
    haloStars: 550,
    seed: 20261107,
  },
  // 仅保留"属于银河系"的卫星星系（大麦/小麦哲伦云），作为远处模糊的小点；
  // 银河系之外的独立星系（仙女座、M81 等）不在此尺度表示，避免尺度错乱。
  otherGalaxies: [
    { name: '大麦哲伦云', pos: [15, -1.5, 13], size: 1.1, color: 0xbfd8ff, stretch: 0.6, opacity: 0.5 },
    { name: '小麦哲伦云', pos: [19, 2, 16], size: 0.8, color: 0xc8d8ff, stretch: 0.7, opacity: 0.5 },
  ],
  camera: { position: [0, 0.62, 1], target: [0, 0, 0], frameTo: 'auto' },
  // 天体用 fixedSize，完全不经过半径换算（星系尺度与行星尺度不在同一把尺子上）
  scale: {},
  bodies: [
    {
      id: 'sagA',
      name: '人马座 A*（银河系中心）',
      navGroup: '定位锚点',
      star: true,
      fixedSize: 1.1,
      galaxyPos: [0, 0, 0],
      dLy: 8.2 * LY_PER_KPC,  // 太阳到银心 ≈ 2.67 万光年
      tier: tierForDistance(8.2 * LY_PER_KPC),
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
      navGroup: '定位锚点',
      star: true,
      // 与其它银盘天体完全同尺寸：从银河系尺度看太阳就是普通一颗恒星，
      // 不再特殊放大（小档里靠名字标签辨认，而不是靠画得更大）。
      fixedSize: 0.07,
      galaxyPos: [-7.73, 0.02, 2.74], // 距银心 8.2 kpc，落在「主旋臂 A」中心线上（非次臂/支臂）
      dLy: 0,              // 太阳 = 距离零点，所有档位都保留（小档的观察焦点）
      tier: SCALE_TIERS.length - 1,
      color: 0xfff0c0,
      glowSize: 0.42,
      childSystem: 'overview.html',
      childSystemLabel: '太阳系',
      info: {
        位置: '距银心约 8.2 千秒差距，位于银河系一条主旋臂上',
        类型: 'G 型主序星（黄矮星）',
        简介: '点击「太阳系」可下钻回我们的行星系统。从银河系尺度看，太阳系只是约 2000 亿颗恒星中普通的一颗。',
      },
    },
    ...deepSkyBodies,
    ...nearbyBodies,
  ],
};
