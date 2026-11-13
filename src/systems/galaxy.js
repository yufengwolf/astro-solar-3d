import { starfield } from './shared.js';
import { POINT_STARS } from '../data/star-points.js';
import { SYSTEM_BY_BODY } from '../data/stellar-orbits.js';
// 坐标换算唯一真源（见 src/coord/galactic.js）；再导出 LY_PER_KPC / KPC_PER_LY 以保持对外 API 稳定。
import { LY_PER_KPC, KPC_PER_LY, SUN_GALACTIC_POS, equatorialToGalactic, galacticToScene } from '../coord/galactic.js';
export { LY_PER_KPC, KPC_PER_LY };

/**
 * 银河系页 → AU 级恒星系统页的下钻入口。
 * 数据层里每个系统列出「哪些银河系天体点进去」，这里统一挂 childSystem，
 * 信息卡按钮与左侧菜单行内标签都会自动出现。目标链接由 main.js 用
 * universeHref(stellarSystem) 生成，能自动保留 ?lang=en。
 */
function withStellarDrilldown(def) {
  const s = SYSTEM_BY_BODY.get(def.id);
  if (!s) return def;
  return {
    ...def,
    stellarSystem: s.nodeId,
    childSystem: `cosmos.html?node=${s.nodeId}`,
    childSystemLabel: s.zh,
    childSystemShort: s.multiplicity > 2 ? `${s.multiplicity} 合星系统` : '双星系统',
  };
}

// ---------- 比例尺分档 ----------
// 1 场景单位 = 1 kpc = 3261.56 光年。每档取景半径严格 10× 递减，
// 第 0 档 radiusKpc=17 与既有 extent 一致（画面直径 ≈ 11 万光年，正好整个银盘）。
// 标签里的「光年」是画面直径，与 radiusKpc 自洽：17 kpc×2 ≈ 11 万 ly，1.7 kpc×2 ≈ 1.1 万 ly…
// （LY_PER_KPC / KPC_PER_LY 定义见 src/coord/galactic.js，本文件仅再导出以保持对外 API 稳定）
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

// equatorialToGalactic / galacticToScene 已抽到 src/coord/galactic.js（唯一真源）。

// ---------- 邻近恒星 / 星团 / 系外行星系统（比例尺小档才出现） ----------
// 距离取 Hipparcos / Gaia / RECONS 与 Messier 星表主流值；RA/Dec 为 J2000，
// 由上面的公式换算成 l/b，再复用 galacticToScene 得到真实相对太阳的位置。
// 大档时它们与太阳重合成一个像素，由窗口过滤自动隐藏；小档才逐个分离出来。
// radiusSun = 真实半径 / 太阳半径，只用于「放大后那颗球」的相对大小，
// 不参与银盘定位。数值取自本地参考仓库 size-of-space (src/data/objects.ts)
// 与常用恒星参数表；缺省按 1 倍太阳处理。
// shape='cluster' 的四条其实不是恒星，放大后应显示点云星团而非球体。
const NEARBY_STARS = [
  { id: 'proxima', name: '比邻星（半人马座 αC）', group: '邻近恒星', ra: 217.42896, dec: -62.67944, dLy: 4.24, color: 0xff8a6a, radiusSun: 0.154, type: '红矮星 · 耀星', brief: '离太阳最近的恒星。拥有宜居带行星「比邻星 b」，也是「南门二」三合星系统最外层的成员。' },
  { id: 'alphaCen', name: '南门二（半人马座 α）', group: '邻近恒星', ra: 219.9021, dec: -60.8339, dLy: 4.37, color: 0xffe8b0, radiusSun: 1.22, type: '三合星系统', brief: '全天第三亮星，由两颗类太阳恒星加比邻星组成，是离我们最近的恒星系统。' },
  { id: 'barnard', name: '巴纳德星', group: '邻近恒星', ra: 269.4521, dec: 4.6933, dLy: 5.96, color: 0xff9a70, radiusSun: 0.196, type: '红矮星', brief: '已知自行速度最快的恒星，每年在天上移动约 10 角秒，也在缓慢向太阳靠近。' },
  { id: 'sirius', name: '天狼星（大犬座 α）', group: '邻近恒星', ra: 101.2871, dec: -16.7161, dLy: 8.60, color: 0xc8dcff, radiusSun: 1.711, type: 'A1V 主序星 + 白矮星伴星', brief: '全天最亮恒星，蓝白色。伴星天狼 B 是一颗地球大小、质量却接近太阳的白矮星。' },
  { id: 'procyon', name: '南河三（小犬座 α）', group: '邻近恒星', ra: 114.8254, dec: 5.2250, dLy: 11.46, color: 0xfff0d0, radiusSun: 2.05, type: 'F5 IV-V 亚巨星', brief: '小犬座主星，与天狼星、参宿四构成「冬季大三角」，同样带白矮星伴星。' },
  { id: 'altair', name: '河鼓二（牛郎星）', group: '邻近恒星', ra: 297.6958, dec: 8.8683, dLy: 16.73, color: 0xd8e8ff, radiusSun: 1.79, type: 'A7V 主序星', brief: '天鹰座 α，与织女星隔银河相望。自转极快（约 9 小时），被甩成明显的扁球形。' },
  { id: 'vega', name: '织女星（天琴座 α）', group: '邻近恒星', ra: 279.2346, dec: 38.7836, dLy: 25.04, color: 0xc4d8ff, radiusSun: 2.36, type: 'A0V 主序星', brief: '天琴座主星、0 等亮星，曾是（也将再度成为）北极星。周围有尘埃盘，是标准测光基准星。' },
  { id: 'pollux', name: '北河三（双子座 β）', group: '邻近恒星', ra: 116.3288, dec: 28.0261, dLy: 33.78, color: 0xffc890, radiusSun: 9.06, type: 'K0 III 橙巨星', brief: '双子座最亮星，已确认拥有系外行星，是「亮星带行星」的经典案例。' },
  { id: 'arcturus', name: '大角星（牧夫座 α）', group: '邻近恒星', ra: 213.9154, dec: 19.1825, dLy: 36.7, color: 0xffb070, radiusSun: 25.4, type: 'K1.5 III 红巨星', brief: '北天最亮的橙红巨星，正以高速穿过银盘，属于一个古老的星流。' },
  { id: 'capella', name: '五车二（御夫座 α）', group: '邻近恒星', ra: 79.1725, dec: 45.9981, dLy: 42.9, color: 0xffe0a0, radiusSun: 12.0, type: '双巨星系统', brief: '御夫座主星，肉眼看似一颗，实为两对巨星组成的四合星系统。' },
  { id: 'aldebaran', name: '毕宿五（金牛座 α）', group: '邻近恒星', ra: 68.9804, dec: 16.5092, dLy: 65.0, color: 0xffa860, radiusSun: 45.0, type: 'K5 III 橙巨星', brief: '金牛座的「牛眼」，视觉上落在毕星团前方，其实与星团无关，距离只有它的一半。' },
  { id: 'canopus', name: '老人星（船底座 α）', group: '邻近恒星', ra: 95.9879, dec: -52.6956, dLy: 310.0, color: 0xe8f0ff, radiusSun: 71.0, type: 'A9 II 亮巨星', brief: '全天第二亮星，南天显著。亮度极高，常被用作航天器导航的基准星。' },
  { id: 'polaris', name: '北极星（勾陈一）', group: '邻近恒星', ra: 37.9542, dec: 89.2642, dLy: 433.0, color: 0xfff2d0, radiusSun: 46.0, type: 'F7 Ib 造父变星 · 三合星', brief: '当前最靠近北天极的亮星，也是经典的造父变星，靠光变周期可测宇宙距离。' },
  { id: 'betelgeuse', name: '参宿四（猎户座 α）', group: '邻近恒星', ra: 88.7929, dec: 7.4069, dLy: 550.0, color: 0xff7040, radiusSun: 764.0, type: 'M1-2 Ia 红超巨星', brief: '猎户座左肩，直径约为太阳的 900 倍，已到演化末期，未来会以超新星爆发终结。' },
  { id: 'antares', name: '心宿二（天蝎座 α）', group: '邻近恒星', ra: 247.3519, dec: -26.4319, dLy: 550.0, color: 0xff6a48, radiusSun: 680.0, type: 'M1.5 Iab 红超巨星', brief: '古称「大火」，色红似火星，西方名意为「火星的对手」，是天蝎座心脏位置的红超巨星。' },
  { id: 'rigel', name: '参宿七（猎户座 β）', group: '邻近恒星', ra: 78.6346, dec: -8.2017, dLy: 850.0, color: 0xb8d0ff, radiusSun: 79.0, type: 'B8 Ia 蓝超巨星', brief: '猎户座右脚，实际比参宿四更亮，是银河系里最明亮的蓝超巨星之一。' },
  { id: 'hyades', name: '毕星团', group: '疏散星团', ra: 66.75, dec: 15.8667, dLy: 153.0, color: 0xffd9a8, shape: 'cluster', seed: 1530, type: '疏散星团', brief: '离太阳最近的疏散星团，肉眼可见的 V 字形，与昴星团同属一个古老星流。' },
  { id: 'pleiades', name: '昴星团 M45（七姐妹）', group: '疏散星团', ra: 56.85, dec: 24.1167, dLy: 444.0, color: 0xa8c8ff, shape: 'cluster', seed: 4501, type: '疏散星团 + 反射星云', brief: '肉眼最易辨认的年轻蓝星团，年龄约 1 亿年，周围包裹着蓝色的反射星云。' },
  { id: 'm7', name: '托勒密星团 M7', group: '疏散星团', ra: 268.4625, dec: -34.7928, dLy: 980.0, color: 0xc8dcff, shape: 'cluster', seed: 7001, type: '疏散星团', brief: '公元 130 年托勒密就记录过它，肉眼可见的模糊光斑，位于天蝎座尾端。' },
  { id: 'm6', name: '蝴蝶星团 M6', group: '疏散星团', ra: 265.0875, dec: -32.2542, dLy: 1600.0, color: 0xc8d8ff, shape: 'cluster', seed: 6001, type: '疏散星团', brief: '双筒望远镜里几十颗蓝白恒星排成蝴蝶翅膀，其中一颗橙巨星格外醒目。' },
  { id: 'peg51', name: '飞马座 51（首颗热木星母星）', group: '系外行星系统', ra: 344.3667, dec: 20.7689, dLy: 50.6, color: 0xffe0a0, radiusSun: 1.24, type: '类太阳恒星 + 热木星', brief: '1995 年在这里发现人类第一颗绕主序星运行的系外行星，开创系外行星天文学，获 2019 诺贝尔物理学奖。' },
  { id: 'kepler452', name: '开普勒 452（类地行星系统）', group: '系外行星系统', ra: 296.0042, dec: 44.2775, dLy: 1800.0, color: 0xffe8b8, radiusSun: 1.11, type: '类太阳恒星 + 超级地球', brief: '「地球 2.0」：行星轨道与恒星辐照都接近地球，位于天鹅座的宜居带内。' },
// 2026-11-12 扩容：新增 18 颗独立恒星（角宿一、轩辕十四、天津四、海山二、
// 盾牌座 UY、造父四、TRAPPIST-1 等）。ra/dec 为 J2000 十进制度，取自 SIMBAD /
// Wikipedia 及公开亮星表的可查证值；dLy、radiusSun、type、brief 取自博客仓库
// docs/data/astro.json（radiusSun = physical.radius_km / 695700 km）。
// 多星系统的 A/B 成员（天狼星 B、五车二 Aa…）同样有价值，统一放进下面的
// POINT_STARS「点天体」层：它们与系统主星共用 J2000 坐标，用名字区分。
  { id: 'spica', name: '角宿一', group: '亮星与超巨星', ra: 201.2982, dec: -11.1614, dLy: 250, color: 0xc8dcff, radiusSun: 7.47, type: 'B1III-IV', brief: '两颗蓝白恒星仅约 4 天互绕一周，强潮汐力把彼此拉成蛋形（椭球变星）；与五帝座一、大角星构成春季大三角。' },
  { id: 'regulus', name: '轩辕十四', group: '邻近恒星', ra: 152.0925, dec: 11.9672, dLy: 79.3, color: 0xc8dcff, radiusSun: 4.35, type: 'B8IVn', brief: '几乎正对黄道，是月亮与行星掩星的常客。约 15.9 小时一圈的自转把它甩成明显扁球，两极表面重力比赤道强约一倍。' },
  { id: 'formalhaut', name: '北落师门', group: '邻近恒星', ra: 344.4129, dec: -29.6222, dLy: 25.1, color: 0xdce8ff, radiusSun: 1.84, type: 'A3V', brief: '南天孤悬的亮星（周围 20° 内没有别的亮星）。其尘埃碎屑盘是第一批被望远镜直接拍到的碎屑盘，盘中候选行星\'北落师门 b\'的真身至今仍有争议。' },
  { id: 'deneb', name: '天津四', group: '亮星与超巨星', ra: 310.3583, dec: 45.2803, dLy: 2615, color: 0xd8e4ff, radiusSun: 203, type: 'A2Iae', brief: '光度约为太阳的 20 万倍，是已知最亮的 A 型超巨星之一；距离估计 1400~2600 光年仍有争议（依测量口径而异），此处取约 2600 光年。' },
  { id: 'adhara', name: '弧矢七', group: '亮星与超巨星', ra: 104.6563, dec: -28.9722, dLy: 430, color: 0xc8dcff, radiusSun: 13.9, type: 'B2II', brief: '约 470 万年前它距地球更近，曾以 -3.99 等成为全天最亮的星；今天它仍是夜空中最强的极紫外辐射源，其紫外光子主导着本地星际云的电离状态。' },
  { id: 'alpheratz', name: '壁宿二', group: '邻近恒星', ra: 2.1000, dec: 29.1000, dLy: 97, color: 0xd0e0ff, radiusSun: 2.94, type: 'B8IV', brief: '历史上同时被算作仙女座 α 与飞马座 δ，是两座共用的一角；本身还是一对分光双星，主星比伴星亮数百倍。' },
  { id: 'mirach', name: '奎宿九', group: '亮星与超巨星', ra: 17.4300, dec: 35.6000, dLy: 197, color: 0xffb080, radiusSun: 100, type: 'M0III', brief: '从它出发向东北跳两站就能找到仙女座大星系（M31），是深空观测的经典路标；它本身也是一颗光谱双星。' },
  { id: 'hamal', name: '娄宿三', group: '邻近恒星', ra: 31.8000, dec: 23.5000, dLy: 65.8, color: 0xffc890, radiusSun: 15.19, type: 'K2III', brief: '白羊座最亮的星，质量仅比太阳大一点，半径却已膨胀到约 15 倍；两千多年前春分点就位于它附近，\'白羊座时代\'因此得名。' },
  { id: 'mirfak', name: '天船三', group: '亮星与超巨星', ra: 51.0750, dec: 49.9000, dLy: 510, color: 0xffe0b0, radiusSun: 68, type: 'F5Ib', brief: '英仙座最亮的星，也是年轻疏散星团 Melotte 20 的核心成员；光度约为太阳的 5000 倍，是肉眼可见的最亮黄白超巨星之一。' },
  { id: 'mira', name: '蒭藁增二', group: '亮星与超巨星', ra: 34.8366, dec: -2.9776, dLy: 300, color: 0xff8060, radiusSun: 367, type: 'M7IIIe', brief: '星等以约 332 天为周期在 2 等~10 等之间起伏：亮时肉眼可见，暗时需望远镜。它正剧烈流失质量，在星风中拖着一条约 13 光年长的尾巴。' },
  { id: 'etacar', name: '海山二', group: '亮星与超巨星', ra: 161.2650, dec: -59.6845, dLy: 7500, color: 0xffe0b0, radiusSun: 60, type: 'LBV', brief: '质量（约 100~150 M☉）、半径（约 60~800 R☉）与温度随 1843 年「假超新星」大爆发剧烈变化，无法给出单一数值，故留 null；周身被自己抛出的 Homunculus …' },
  { id: 'uyscuti', name: '盾牌座UY', group: '亮星与超巨星', ra: 276.9022, dec: -12.4664, dLy: 5871, color: 0xff7040, radiusSun: 909, type: 'M4Ia', brief: '曾以约 1708 R☉ 的旧估计闻名，最新观测把半径下修至约 909 R☉——仍接近太阳的千倍。半规则变星，约 8.5 个月内光变约 1 个星等。' },
  { id: 'algol', name: '大陵五', group: '邻近恒星', ra: 47.0422, dec: 40.9556, dLy: 94, color: 0xd8e8ff, radiusSun: 2.73, type: 'B8V', brief: '每 2.87 天，较暗的伴星从亮星前方经过，亮度从 2.1 等骤降到 3.4 等并持续约 10 小时——宇宙级的\'眨眼\'；中国古代因此称它为\'魔星\'。' },
  { id: 'pcygni', name: '天鹅座 P', group: '亮星与超巨星', ra: 304.4467, dec: 38.0329, dLy: 5300, color: 0xd8e8ff, radiusSun: 76, type: 'LBV', brief: '1600 年突然亮如三等星，随后缓慢回落，至今仍在以强劲星风抛射物质；与海山二同类，是\'假超新星\'现象的鼻祖。' },
  { id: 'betapic', name: '绘架座β', group: '邻近恒星', ra: 86.8212, dec: -51.0665, dLy: 63.4, color: 0xdce8ff, radiusSun: 1.53, type: 'A6V', brief: '第一个被直接拍到的恒星碎屑盘，盘中已确认两颗巨行星（绘架座βb/c）；它还是\'绘架座β移动星群\'——一群年龄仅约 2000 万年的年轻恒星——的命名来源。' },
  { id: 'trappist1', name: '特拉比斯特 1', group: '邻近恒星', ra: 346.6224, dec: -5.0414, dLy: 40.66, color: 0xff8060, radiusSun: 0.1192, type: 'M8V', brief: '仅比木星大一点的超冷红矮星，却拥有 7 颗地球大小的行星，其中 3~4 颗位于宜居带；所有行星紧密排列，从最内侧看出去会是天空中的\'大月亮\'。JWST 正在其大气中搜寻生命迹象。' },
  { id: 'mucep', name: '造父四', group: '亮星与超巨星', ra: 325.8769, dec: 58.7800, dLy: 2840, color: 0xff6040, radiusSun: 1260, type: 'M2Ia', brief: '又名\'石榴星\'（Garnet Star），因石榴石般的血红色闻名；半径估计在 972~1650 R☉ 之间依口径而变，此处取 1260 R☉。它的紫外光几乎全被自身大气吸收。' },
  { id: 'naos', name: '弧矢增二十二', group: '亮星与超巨星', ra: 120.8960, dec: -40.0031, dLy: 1093, color: 0xc0d4ff, radiusSun: 14, type: 'O5Ibf', brief: '表面温度约 42000 K，是肉眼可见的最热恒星之一；光度约为太阳的 50 万倍，星风速度高达约 2200 km/s。' },
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
// SUN_GALACTIC_POS / galacticToScene 已抽到 src/coord/galactic.js（唯一真源）。

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
    // 真实恒星：放大后显示球体（半径按 radiusSun 相对缩放）；
    // 疏散星团不是恒星，复用已有的程序化点云星团展示物。
    ...(o.shape === 'cluster'
      ? { deepSky: { kind: 'cluster', seed: o.seed } }
      : { radiusSun: o.radiusSun ?? 1 }),
    info: {
      类型: o.type,
      距离: `约 ${o.dLy < 10 ? o.dLy.toFixed(2) : Math.round(o.dLy)} 光年`,
      银道坐标: `银经 = ${l.toFixed(2)}°，银纬 = ${b.toFixed(2)}°`,
      简介: o.brief,
    },
  };
});

// ---------- 点天体：所有恒星都该在这里，与半径大小无关 ----------
// 这一层只存「真实位置 + 名字」。脉冲星半径只有 10 km、白矮星不到地球大小、
// 聚星成员与主星 J2000 坐标几乎重合——银河系尺度上它们本来就是一个点，
// 不该因为半径小、float32 精度或与主星重合就被排除。
//
// 关键取舍：不带 radiusSun、不带 deepSky。于是 main.js 不会给它挂 9R 近景球
// （10 km 半径会把相机推到 1e-13 光年量级，float32 场景坐标与近裁剪面都会失效），
// 点击名字只做「定位」（在当前尺度下把镜头对准它，不自动切档），远处天体依旧由
// updateBackdropVisibility() 的三维视锥判定留在背景里；近照改为信息卡按钮按需进入。
const pointBodies = POINT_STARS.map((o) => {
  const [l, b] = equatorialToGalactic(o.ra, o.dec);
  const dKpc = o.dLy / LY_PER_KPC;
  const km = o.radiusKm;
  const radiusSun = Number.isFinite(km) ? km / 695700 : undefined;  // 公里 → 太阳半径
  // 真实恒星（带半径数据）挂 9R 球面特写：点击信息卡「查看近照」即可在原位放大看球，
  // 背景仍是三维星空。脉冲星 / 黑洞 / 聚星成员 / 无半径数据的恒星仍是纯点（无球面可看）。
  const hasPortrait = o.pointKind === 'star' && radiusSun !== undefined;
  const radiusText = Number.isFinite(km)
    ? (km >= 1e6 ? `约 ${(km / 695700).toFixed(1)} 倍太阳半径`
      : `约 ${Math.round(km).toLocaleString('en-US')} km`)
    : null;
  return {
    id: o.id,
    name: o.name,
    nameEn: o.nameEn,
    star: true,
    pointOnly: !hasPortrait,   // 有球面特写的真实恒星不再被当成「只按点显示」
    // radiusSun 是「挂 9R 近景球」的开关（见 main.js 的 def.radiusSun 判定）。
    // 脉冲星 / 白矮星 / 黑洞 / 聚星成员虽有 radiusKm，但那只用于信息卡文字；
    // 若也写进 radiusSun，10 km 的中子星会被拖进 1e-13 光年的近景球特写。
    // 因此只有真正带半径数据的恒星（hasPortrait）才带这个字段。
    ...(hasPortrait ? { radiusSun } : {}),
    pointKind: o.pointKind,
    size: 0.07,
    fixedSize: 0.07,
    glowSize: 0.42,
    // 多颗成员共用同一系统坐标时，加法混合光晕会叠成一团白斑。压低透明度，
    // 让「这里其实是若干颗星」在画面上仍然读作一个点。
    ...(o.pointKind === 'member' || o.pointKind === 'pulsar'
      ? { haloOpacity: 0.34, starBoost: 1.1 } : {}),
    color: o.color,
    galaxyPos: galacticToScene(l, b, dKpc),
    dLy: o.dLy,
    tier: tierForDistance(o.dLy),
    navGroup: o.group,
    info: {
      类型: hasPortrait ? '恒星'
        : o.pointKind === 'pulsar' ? '致密残骸 · 只按点显示'
          : o.pointKind === 'blackhole' ? '恒星级黑洞 · 只按点显示'
            : o.pointKind === 'member' ? '聚星系统成员 · 只按点显示' : '恒星 · 只按点显示',
      ...(o.system ? { 所属系统: o.system } : {}),
      距离: `约 ${o.dLy < 10 ? o.dLy.toFixed(2) : Math.round(o.dLy).toLocaleString('en-US')} 光年`,
      ...(radiusText ? { 半径: radiusText } : {}),
      银道坐标: `银经 = ${l.toFixed(2)}°，银纬 = ${b.toFixed(2)}°`,
      坐标来源: o.src,
      简介: o.brief,
    },
  };
});

/**
 * 银河系（形态为定性语境辉光，恒星为真）。
 *
 * 设计取舍（与"太阳系缩放"同一思路）：
 * - 比例尺：1 场景单位 = 1 千秒差距(kpc)。银盘半径约 15 kpc，太阳距银心约 8.2 kpc。
 * - 形态辉光（buildMilkyWayHaze）：真实 4 旋臂对数螺旋密度场——2 条主旋臂
 *   （英仙 / 盾牌-半人马）+ 2 条次旋臂（人马 / 矩尺）+ 以太阳为锚点的本地（猎户）支臂，
 *   中心核球 + 指数盘 + 稀疏银晕。相位经调校，太阳位于两主臂之间的本地支臂，
 *   而非叠在某条主臂亮带上（这是早期版本的几何错误，已修正）。
 * - 真实恒星来自目录（src/data/catalogs.js），目前接入 HYG Database（~12 万颗本地恒星），
 *   坐标全部走 src/coord/galactic.js 唯一真源；OpenNGC（深空）/ Gaia（全银盘）预留。
 *   形态辉光只是"语境层"，真实星点才是可缩放探索的内容主体。
 * - 不做"连续缩放穿出太阳系"：float32 跨 13 个数量级精度不可行，而且会卡死。
 *   改用页面切换作为显式 LOD 边界；上下级边界全部由 src/universe.js 注册表给出：
 *     · 太阳系总览缩到最外圈再往外滚 / 点顶部「上一级」 → 本页
 *     · 本页最内档继续放大 / 点太阳 → 太阳系总览
 *     · 本页最外档继续往外滚 / 点顶部「上一级」 → 本星系群，再往上直到可观测宇宙
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
    // catalogs: 仅「银河系本地星场页」（本文件，galaxy.html 入口）渲染 HYG 星场
    // 与 OpenNGC 深空点云。上层 cosmos 层级页（universe / 超星系团 / 星系团 /
    // 本星系群 …）一律不设该标记，避免把「太阳系周边恒星球」错误地塞进
    // 1000 万光年～930 亿光年尺度的宇宙网 / 星系群页面里。
    catalogs: true,
    scaleKpc: 1,
    diskRadiusKpc: 15,
    thicknessKpc: 0.6,
    // 真实银河系旋臂几何（对数螺旋 r = r0·exp(b·θ)，b = 1/tan(pitch)）。
    // 相位经调校，使太阳（盘面方位≈160.5°、R≈8.2 kpc）落在两条主旋臂之间的
    // 本地（猎户）支臂，而非叠在主臂亮带上（原先"主旋臂 A 中心线"的摆法是错的）。
    // 2 条主旋臂（英仙 / 盾牌-半人马，最亮最密）+ 2 条次旋臂（人马 / 矩尺），
    // 外加一条本地支臂（猎户臂）以太阳为锚点短延伸；中央核球 + 指数盘 + 稀疏银晕。
    // 真实恒星由 HYG / Gaia 等 starfield 目录（见 src/data/catalogs.js）提供。
    armPitchDeg: 12,        // 旋臂俯仰角（越小越卷）；真实银臂约 12°
    majorArmStars: 9000,    // 每条主旋臂星数（密集 → 加法混合下叠出明亮辉光带）
    minorArmStars: 6000,    // 每条次旋臂星数
    localSpurStars: 2500,   // 本地（猎户）支臂星数
    diskStars: 12000,       // 臂间指数盘（老星，暗淡背景）
    bulgeStars: 4000,       // 核球
    haloStars: 2500,        // 银晕
    pointSize: 0.2,
    rotateSpeed: 0.006,     // 银盘整体慢转(弧度/秒)；跟随镜头下小档也保留慢转
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
      // 远景里仍是一颗亮星锚点；真正放大到它身边时，显示的应是黑洞 + 吸积盘
      // （复用 makeBlackHoleShowcase），而不是一颗恒星球体。
      deepSky: { kind: 'blackhole', seed: 8100 },
      info: {
        类型: '超大质量黑洞',
        质量: '约 4.3×10⁶ 太阳质量',
        位置: '银河系动力学中心（银心）',
        简介: '几乎全部银河系恒星都绕着它公转。银河系尺度上用一颗亮星作视觉锚点，放大后可以看到黑洞与吸积盘；真实中心几乎不可见、会吞噬光。',
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
      galaxyPos: [-7.73, 0.02, 2.74], // 距银心 8.2 kpc，位于本地（猎户）支臂——介于英仙臂与人马臂之间（非主旋臂亮带）
      dLy: 0,              // 太阳 = 距离零点，所有档位都保留（小档的观察焦点）
      tier: SCALE_TIERS.length - 1,
      color: 0xfff0c0,
      glowSize: 0.42,
      radiusSun: 1,            // 近景球体的大小基准：其它恒星都相对太阳缩放
      childSystem: 'solar.html',
      childSystemLabel: '太阳系',
      info: {
        位置: '距银心约 8.2 千秒差距，位于银河系一条主旋臂上',
        类型: 'G 型主序星（黄矮星）',
        简介: '点击「太阳系」可下钻回我们的行星系统。从银河系尺度看，太阳系只是约 2000 亿颗恒星中普通的一颗。',
      },
    },
    ...deepSkyBodies,
    ...nearbyBodies,
    ...pointBodies,
  ].map(withStellarDrilldown),
};
