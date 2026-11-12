/**
 * 银河系「点天体」目录 —— 只按真实 J2000 坐标定位、只用名字指示。
 *
 * 为什么单独一层：银河系尺度上这些天体本来就是「一个点」。它们不该因为
 * 半径只有 10 km（脉冲星 / 白矮星 / 磁星）、或者与主星 J2000 坐标几乎重合
 * （聚星成员）就被排除。点击名字时 main.js 会按 dLy 自动切到合适比例尺，
 * 并把镜头对准它；不会进入 9R 恒星特写（10 km 半径会把相机推到 float32
 * 精度与近裁剪面失效的区间）。三维背景仍由 updateBackdropVisibility() 的
 * 视锥判定给出：1 光年视野里照样看得见几百、几千光年外的天体。
 *
 * 坐标来源（每条 src 字段单独标注，可逐条复核）：
 *   · HYG v37   astronexus/HYG-Database hyg/v3/hyg_v37.csv.gz —— J2000 RA/Dec
 *     来自 Hipparcos；表内 ra 为小时制，此处已 ×15 转成十进制度。
 *     自检：Sirius HIP 32349 → 101.287215°, −16.716116°，与 galaxy.js 现有值一致。
 *   · NASA Exoplanet Archive TAP / ps —— hostname/ra/dec/sy_dist（J2000）。
 *   · Wikipedia / SIMBAD infobox —— 脉冲星、磁星、特超巨星、恒星级黑洞的 J2000。
 *   · 距离 dLy 优先取博客 docs/data/astro.json 的 distance_ly；未收录者由
 *     HYG / NASA 的视差秒差距 × 3.26156 换算成光年。
 *   · 聚星成员与系统主星共用 J2000 坐标：成员间角秒级分离在光年尺度下
 *     远小于一个像素，共用系统坐标既是真实位置，也不会伪造轨道偏移。
 *
 * 字段：pointKind = star | pulsar | blackhole | member（只影响配色/文案，
 * 不参与定位）；radiusKm 仅用于信息卡展示，绝不参与任何几何计算。
 * 本文件是纯数据，不依赖 DOM / Three.js，Node 自检可直接 import。
 */

export const POINT_STARS = [
  { id: "wezen", name: "弧矢一", nameEn: "Wezen", group: "亮星与超巨星", ra: 107.097855, dec: -26.3932, dLy: 1600, color: 0xffe0a8, pointKind: "star", radiusKm: 130791600.0, src: "HYG v37 (J2000, Hipparcos) · HIP 34444", brief: "大犬座第二亮星，直径约太阳 188 倍的黄白超巨星" },
  { id: "aludra", name: "弧矢二", nameEn: "Aludra", group: "亮星与超巨星", ra: 111.02376, dec: -29.303104, dLy: 2000, color: 0xc8dcff, pointKind: "star", radiusKm: 39167910.0, src: "HYG v37 (J2000, Hipparcos) · HIP 35904", brief: "大犬座的蓝白超巨星，将以超新星结束一生" },
  { id: "markab", name: "室宿一", nameEn: "Markab", group: "亮星与超巨星", ra: 346.19022, dec: 15.205264, dLy: 140, color: 0xc8dcff, pointKind: "star", src: "HYG v37 (J2000, Hipparcos) · HIP 113963", brief: "飞马座四边形的一角，正值暮年的蓝白巨星" },
  { id: "sheliak", name: "渐台二", nameEn: "Sheliak", group: "亮星与超巨星", ra: 282.519975, dec: 33.362667, dLy: 960, color: 0xc8dcff, pointKind: "star", radiusKm: 10574640.0, src: "HYG v37 (J2000, Hipparcos) · HIP 92420", brief: "物质正从一颗星流向另一颗的食双星" },
  { id: "almaaz", name: "柱一", nameEn: "Almaaz", group: "亮星与超巨星", ra: 75.492225, dec: 43.823308, dLy: 2132, color: 0xffe0a8, pointKind: "star", radiusKm: 99485100.0, src: "HYG v37 (J2000, Hipparcos) · HIP 23416", brief: "每 27 年才发生一次罕见星食的'柱一'" },
  { id: "castor", name: "北河二", nameEn: "Castor", group: "亮星与超巨星", ra: 113.64951, dec: 31.888276, dLy: 51, color: 0xc8dcff, pointKind: "star", radiusKm: 1453317.3, src: "HYG v37 (J2000, Hipparcos) · HIP 36850", brief: "六颗恒星组成的聚星系统，冬季大三角的一角" },
  { id: "alnitak", name: "参宿一", nameEn: "Alnitak", group: "亮星与超巨星", ra: 85.189695, dec: -1.942572, dLy: 736, color: 0xc8dcff, pointKind: "star", src: "HYG v37 (J2000, Hipparcos) · HIP 26727", brief: "参宿一（Alnitak）。J2000 坐标取自 HYG v37 / Hipparcos，距离由视差换算。" },
  { id: "bellatrix", name: "参宿五", nameEn: "Bellatrix", group: "亮星与超巨星", ra: 81.282765, dec: 6.349702, dLy: 252, color: 0xc8dcff, pointKind: "star", src: "HYG v37 (J2000, Hipparcos) · HIP 25336", brief: "参宿五（Bellatrix）。J2000 坐标取自 HYG v37 / Hipparcos，距离由视差换算。" },
  { id: "alnilam", name: "参宿二", nameEn: "Alnilam", group: "亮星与超巨星", ra: 84.053385, dec: -1.20192, dLy: 1977, color: 0xc8dcff, pointKind: "star", src: "HYG v37 (J2000, Hipparcos) · HIP 26311", brief: "参宿二（Alnilam）。J2000 坐标取自 HYG v37 / Hipparcos，距离由视差换算。" },
  { id: "mintaka", name: "参宿三", nameEn: "Mintaka", group: "亮星与超巨星", ra: 83.001675, dec: -0.299092, dLy: 692, color: 0xc8dcff, pointKind: "star", src: "HYG v37 (J2000, Hipparcos) · HIP 25930", brief: "参宿三（Mintaka）。J2000 坐标取自 HYG v37 / Hipparcos，距离由视差换算。" },
  { id: "saiph", name: "参宿六", nameEn: "Saiph", group: "亮星与超巨星", ra: 86.939115, dec: -9.669605, dLy: 647, color: 0xc8dcff, pointKind: "star", src: "HYG v37 (J2000, Hipparcos) · HIP 27366", brief: "参宿六（Saiph）。J2000 坐标取自 HYG v37 / Hipparcos，距离由视差换算。" },
  { id: "shaula", name: "尾宿八", nameEn: "Shaula", group: "亮星与超巨星", ra: 263.402175, dec: -37.103821, dLy: 571, color: 0xc8dcff, pointKind: "star", src: "HYG v37 (J2000, Hipparcos) · HIP 85927", brief: "尾宿八（Shaula）。J2000 坐标取自 HYG v37 / Hipparcos，距离由视差换算。" },
  { id: "gacrux", name: "十字架三", nameEn: "Gacrux", group: "亮星与超巨星", ra: 187.791435, dec: -57.113212, dLy: 88.6, color: 0xff7a58, pointKind: "star", src: "HYG v37 (J2000, Hipparcos) · HIP 61084", brief: "十字架三（Gacrux）。J2000 坐标取自 HYG v37 / Hipparcos，距离由视差换算。" },
  { id: "mimosa", name: "十字架二", nameEn: "Mimosa", group: "亮星与超巨星", ra: 191.930385, dec: -59.688764, dLy: 279, color: 0xc8dcff, pointKind: "star", src: "HYG v37 (J2000, Hipparcos) · HIP 62434", brief: "十字架二（Mimosa）。J2000 坐标取自 HYG v37 / Hipparcos，距离由视差换算。" },
  { id: "acrux", name: "十字架一", nameEn: "Acrux", group: "亮星与超巨星", ra: 186.649665, dec: -63.099092, dLy: 322, color: 0xc8dcff, pointKind: "star", src: "HYG v37 (J2000, Hipparcos) · HIP 60718", brief: "十字架一（Acrux）。J2000 坐标取自 HYG v37 / Hipparcos，距离由视差换算。" },
  { id: "hadar", name: "马腹一", nameEn: "Hadar", group: "亮星与超巨星", ra: 210.955935, dec: -60.373039, dLy: 392, color: 0xc8dcff, pointKind: "star", src: "HYG v37 (J2000, Hipparcos) · HIP 68702", brief: "马腹一（Hadar）。J2000 坐标取自 HYG v37 / Hipparcos，距离由视差换算。" },
  { id: "alphecca", name: "贯索四", nameEn: "Alphecca", group: "亮星与超巨星", ra: 233.67192, dec: 26.714693, dLy: 75, color: 0xe8f0ff, pointKind: "star", src: "HYG v37 (J2000, Hipparcos) · HIP 76267", brief: "贯索四（Alphecca）。J2000 坐标取自 HYG v37 / Hipparcos，距离由视差换算。" },
  { id: "elnath", name: "五车五", nameEn: "Elnath", group: "亮星与超巨星", ra: 81.57297, dec: 28.60745, dLy: 134, color: 0xc8dcff, pointKind: "star", src: "HYG v37 (J2000, Hipparcos) · HIP 25428", brief: "五车五（Elnath）。J2000 坐标取自 HYG v37 / Hipparcos，距离由视差换算。" },
  { id: "pistol_star", name: "手枪星", nameEn: "Pistol Star", group: "特超巨星", ra: 266.56375, dec: -28.8344444, dLy: 25000, color: 0xc8dcff, pointKind: "star", radiusKm: 214275600.0, src: "Wikipedia / SIMBAD infobox (J2000) · Pistol Star / V4647 Sgr", brief: "银河系中心附近的蓝色特超巨星，曾抛出手枪星云，是已知最明亮的恒星之一" },
  { id: "stephenson_2_18", name: "斯蒂芬森 2-18", nameEn: "Stephenson 2-18", group: "特超巨星", ra: 279.7598787, dec: -6.0862599, dLy: 18900, color: 0xff7a58, pointKind: "star", radiusKm: 1495755000.0, src: "Wikipedia / SIMBAD infobox (J2000) · Stephenson 2-18 / 2MASS J18390238-0605106", brief: "位于盾牌座方向的红超巨星，是目前已知体积最大的恒星之一" },
  { id: "rw_cephei", name: "仙王座 RW", nameEn: "RW Cephei", group: "特超巨星", ra: 335.77923, dec: 55.963229, dLy: 12790, color: 0xffe0a8, pointKind: "star", radiusKm: 765270000.0, src: "Wikipedia / SIMBAD infobox (J2000) · RW Cep / HIP 110504", brief: "会不规则变暗的特超巨星，2022 年经历创纪录变暗" },
  { id: "s_persei", name: "英仙座 S", nameEn: "S Persei", group: "特超巨星", ra: 35.7154553, dec: 58.5198466, dLy: 7900, color: 0xff7a58, pointKind: "star", radiusKm: 834840000.0, src: "Wikipedia / SIMBAD infobox (J2000) · S Per / HIP 11093", brief: "英仙座双星团方向的红超巨星，半规则变星" },
  { id: "r136a1", name: "R136a1", nameEn: "R136a1", group: "特超巨星", ra: 84.676625, dec: -69.1008083, dLy: 163000, color: 0xc8dcff, pointKind: "star", system: "大麦哲伦云 R136 星团", radiusKm: 29706390.0, src: "Wikipedia / SIMBAD infobox (J2000) · R136a1 / BAT99 108", brief: "目前已知质量最大的恒星，藏在蜘蛛星云核心" },
  { id: "crab_pulsar", name: "蟹云脉冲星", nameEn: "Crab Pulsar", group: "致密天体", ra: 83.633125, dec: 22.0145, dLy: 6524, color: 0x9fe8ff, pointKind: "pulsar", system: "蟹状星云 M1", radiusKm: 10.0, src: "Wikipedia / SIMBAD infobox (J2000) · PSR B0531+21 / Crab Pulsar", brief: "蟹状星云中心高速自转的中子星，每 33 毫秒转一圈" },
  { id: "vela_pulsar", name: "船帆座脉冲星", nameEn: "Vela Pulsar", group: "致密天体", ra: 128.8360635, dec: -45.1764318, dLy: 959, color: 0x9fe8ff, pointKind: "pulsar", system: "船帆座超新星遗迹", src: "Wikipedia / SIMBAD infobox (J2000) · PSR J0835-4510 / Vela Pulsar", brief: "船帆座超新星遗迹中心的中子星，自转突变的经典样本" },
  { id: "sgr_1806_20", name: "磁星 SGR 1806−20", nameEn: "SGR 1806-20", group: "致密天体", ra: 272.1638333, dec: -20.4109722, dLy: 50000, color: 0xc9b8ff, pointKind: "pulsar", radiusKm: 10.0, src: "Wikipedia / SIMBAD infobox (J2000) · SGR 1806-20 / PSR J1808-2024", brief: "银河系最强的磁星，一次巨耀斑曾照亮半个银河" },
  { id: "v404_cyg", name: "V404 天鹅座（黑洞）", nameEn: "V404 Cygni", group: "致密天体", ra: 306.0159167, dec: 33.8672222, dLy: 7800, color: 0xffd0a0, pointKind: "blackhole", radiusKm: 26.579, src: "Wikipedia / SIMBAD infobox (J2000) · V404 Cyg / GS 2023+338", brief: "低质量 X 射线双星，2015 年剧烈爆发出名的黑洞" },
  { id: "gaia_bh1", name: "Gaia BH1", nameEn: "Gaia BH1", group: "致密天体", ra: 262.1712359, dec: -0.5809787, dLy: 1560, color: 0xffd0a0, pointKind: "blackhole", radiusKm: 28.962, src: "Wikipedia / SIMBAD infobox (J2000) · Gaia DR3 4373465352415301632", brief: "距离地球约1560光年的休眠恒星级黑洞，拥有一颗G型伴星" },
  { id: "sirius_b", name: "天狼星 B", nameEn: "Sirius B", group: "聚星系统成员", ra: 101.287215, dec: -16.716116, dLy: 8.61, color: 0xe8f0ff, pointKind: "pulsar", system: "天狼星双星", radiusKm: 5634.0, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "质量与太阳相当，体积却只有地球大小——最早被发现的白矮星" },
  { id: "procyon_b", name: "南河三 B", nameEn: "Procyon B", group: "聚星系统成员", ra: 114.825495, dec: 5.224993, dLy: 11.46, color: 0xe8f0ff, pointKind: "pulsar", system: "南河三双星", radiusKm: 8584.938, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "第三亮白矮星" },
  { id: "alphacen_a", name: "南门二 A", nameEn: "Alpha Centauri A", group: "聚星系统成员", ra: 219.911475, dec: -60.833976, dLy: 4.37, color: 0xffe0a8, pointKind: "member", system: "南门二三合星", radiusKm: 851119.38, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "距太阳系最近的恒星系统主星，与太阳宛如孪生" },
  { id: "alphacen_b", name: "南门二 B", nameEn: "Alpha Centauri B", group: "聚星系统成员", ra: 219.911475, dec: -60.833976, dLy: 4.37, color: 0xffd0a0, pointKind: "member", system: "南门二三合星", radiusKm: 600528.24, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "南门二系统的橙矮星伴星，肉眼与主星不可分" },
  { id: "eridani_40a", name: "波江座 40 A", nameEn: "40 Eridani A", group: "聚星系统成员", ra: 63.818055, dec: -7.652871, dLy: 16.35, color: 0xffd0a0, pointKind: "member", system: "波江座 40 三合星", radiusKm: 559342.8, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "《星际迷航》中瓦肯人的太阳，一颗宁静的橙黄矮星" },
  { id: "eridani_40b", name: "波江座 40 B", nameEn: "40 Eridani B", group: "聚星系统成员", ra: 63.818055, dec: -7.652871, dLy: 16.35, color: 0xe8f0ff, pointKind: "pulsar", system: "波江座 40 三合星", radiusKm: 9099.756, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "肉眼不可见的白矮星，人类最早确认的白矮星之一" },
  { id: "eridani_40c", name: "波江座 40 C", nameEn: "40 Eridani C", group: "聚星系统成员", ra: 63.818055, dec: -7.652871, dLy: 16.35, color: 0xff7a58, pointKind: "member", system: "波江座 40 三合星", radiusKm: 215667.0, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "一颗耀星红矮星，与白矮星 B 组成近距离双星对" },
  { id: "capella_aa", name: "五车二 Aa", nameEn: "Capella Aa", group: "聚星系统成员", ra: 79.17225, dec: 45.997991, dLy: 42.92, color: 0xffe0a8, pointKind: "member", system: "五车二四合星", radiusKm: 8334486.0, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "五车二 A 子系统的亮巨星主星" },
  { id: "capella_ab", name: "五车二 Ab", nameEn: "Capella Ab", group: "聚星系统成员", ra: 79.17225, dec: 45.997991, dLy: 42.8, color: 0xffe0a8, pointKind: "member", system: "五车二四合星", radiusKm: 6143031.0, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "五车二 A 子系统的次巨星伴星" },
  { id: "capella_ba", name: "五车二 Ba", nameEn: "Capella Ba", group: "聚星系统成员", ra: 79.17225, dec: 45.997991, dLy: 42.9, color: 0xff7a58, pointKind: "member", system: "五车二四合星", radiusKm: 333936.0, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "五车二系统远端红矮星" },
  { id: "capella_bb", name: "五车二 Bb", nameEn: "Capella Bb", group: "聚星系统成员", ra: 79.17225, dec: 45.997991, dLy: 42.92, color: 0xff7a58, pointKind: "member", system: "五车二四合星", radiusKm: 375678.0, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "五车二系统暗弱红矮星伴星" },
  { id: "castor_a1", name: "北河二 A1", nameEn: "Castor A1", group: "聚星系统成员", ra: 113.64951, dec: 31.888276, dLy: 51, color: 0xc8dcff, pointKind: "member", system: "北河二六合星", radiusKm: 1669680.0, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "北河二主星，A型主序星" },
  { id: "castor_a2", name: "北河二 A2", nameEn: "Castor A2", group: "聚星系统成员", ra: 113.64951, dec: 31.888276, dLy: 51, color: 0xff7a58, pointKind: "member", system: "北河二六合星", radiusKm: 417420.0, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "北河二A的伴星，红矮星耀星" },
  { id: "castor_b1", name: "北河二 B1", nameEn: "Castor B1", group: "聚星系统成员", ra: 113.64951, dec: 31.888276, dLy: 50.9, color: 0xc8dcff, pointKind: "member", system: "北河二六合星", radiusKm: 2295810.0, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "北河二六合星系统B子系统主星" },
  { id: "castor_b2", name: "北河二 B2", nameEn: "Castor B2", group: "聚星系统成员", ra: 113.64951, dec: 31.888276, dLy: 51.6, color: 0xff7a58, pointKind: "member", system: "北河二六合星", radiusKm: 347850.0, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "北河二 B 子系统的红矮星伴星" },
  { id: "castor_c1", name: "北河二 C1", nameEn: "Castor C1", group: "聚星系统成员", ra: 113.64951, dec: 31.888276, dLy: 51, color: 0xff7a58, pointKind: "member", system: "北河二六合星", radiusKm: 431334.0, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "北河二六合星系统的红矮星子星" },
  { id: "castor_c2", name: "北河二 C2", nameEn: "Castor C2", group: "聚星系统成员", ra: 113.64951, dec: 31.888276, dLy: 51, color: 0xff7a58, pointKind: "member", system: "北河二六合星", radiusKm: 347850.0, src: "HYG v37 (J2000, Hipparcos) · 系统 J2000 坐标（成员角秒级分离在此尺度不可分辨）", brief: "北河二六合星系统中的红矮星" },
  { id: "kepler_16_a", name: "开普勒 16 A", nameEn: "Kepler-16 A", group: "聚星系统成员", ra: 289.0758307, dec: 51.757229, dLy: 245.4, color: 0xffe0a8, pointKind: "member", system: "开普勒 16 双星", radiusKm: 451439.73, src: "NASA Exoplanet Archive TAP ps (J2000) · Kepler-16", brief: "开普勒16双星系统的 K 型主星" },
  { id: "kepler_16_b", name: "开普勒 16 B", nameEn: "Kepler-16 B", group: "聚星系统成员", ra: 289.0758307, dec: 51.757229, dLy: 245.4, color: 0xff7a58, pointKind: "member", system: "开普勒 16 双星", radiusKm: 157367.34, src: "NASA Exoplanet Archive TAP ps (J2000) · Kepler-16", brief: "开普勒16双星系统的 M 型伴星" },
  { id: "epsilon_lyrae_a1", name: "天琴座 ε1 A", nameEn: "Epsilon Lyrae A1", group: "聚星系统成员", ra: 281.0847745, dec: 39.6701259, dLy: 162, color: 0xc8dcff, pointKind: "member", system: "天琴座 ε 四合星", radiusKm: 1934046.0, src: "Wikipedia / SIMBAD infobox (J2000) · eps1 Lyr / HIP 91919", brief: "织女二 ε1 对的 A 成员，A 型主序星" },
  { id: "epsilon_lyrae_a2", name: "天琴座 ε1 B", nameEn: "Epsilon Lyrae A2", group: "聚星系统成员", ra: 281.0847745, dec: 39.6701259, dLy: 162, color: 0xc8dcff, pointKind: "member", system: "天琴座 ε 四合星", src: "Wikipedia / SIMBAD infobox (J2000) · eps1 Lyr / HIP 91919", brief: "织女二 ε1 对的 B 成员，F 型主序星" },
  { id: "epsilon_lyrae_b1", name: "天琴座 ε2 A", nameEn: "Epsilon Lyrae B1", group: "聚星系统成员", ra: 281.094919, dec: 39.6127181, dLy: 156, color: 0xc8dcff, pointKind: "member", system: "天琴座 ε 四合星", radiusKm: 1447056.0, src: "Wikipedia / SIMBAD infobox (J2000) · eps2 Lyr / HIP 91926", brief: "织女二 ε2 对的 A 成员，快速自转的 A 型主序星" },
  { id: "epsilon_lyrae_b2", name: "天琴座 ε2 B", nameEn: "Epsilon Lyrae B2", group: "聚星系统成员", ra: 281.094919, dec: 39.6127181, dLy: 156, color: 0xc8dcff, pointKind: "member", system: "天琴座 ε 四合星", radiusKm: 1419228.0, src: "Wikipedia / SIMBAD infobox (J2000) · eps2 Lyr / HIP 91926", brief: "织女二 ε2 对的 B 成员，A7V 主序星" },
  { id: "kepler_22", name: "开普勒 22", nameEn: "Kepler-22", group: "系外行星系统", ra: 289.2172051, dec: 47.8841427, dLy: 644, color: 0xa8e9c8, pointKind: "star", radiusKm: 604563.3, src: "NASA Exoplanet Archive TAP ps (J2000) · Kepler-22", brief: "拥有首颗宜居带系外行星的类太阳恒星" },
  { id: "kepler_186", name: "开普勒 186", nameEn: "Kepler-186", group: "系外行星系统", ra: 298.652736, dec: 43.9549884, dLy: 579, color: 0xa8e9c8, pointKind: "star", radiusKm: 363851.1, src: "NASA Exoplanet Archive TAP ps (J2000) · Kepler-186", brief: "拥有宜居带'地球大小'行星的红矮星" },
  { id: "gliese_581", name: "格利泽 581", nameEn: "Gliese 581", group: "系外行星系统", ra: 229.8564725, dec: -7.7226935, dLy: 20.4, color: 0xa8e9c8, pointKind: "star", radiusKm: 208710.0, src: "NASA Exoplanet Archive TAP ps (J2000) · GJ 581", brief: "拥有多颗系外行星的红矮星，宜居性争论的经典目标" },
  { id: "cancri_55", name: "巨蟹座 55", nameEn: "55 Cancri", group: "系外行星系统", ra: 133.1468373, dec: 28.3298154, dLy: 40.9, color: 0xa8e9c8, pointKind: "star", radiusKm: 800055.0, src: "NASA Exoplanet Archive TAP ps (J2000) · 55 Cnc", brief: "已发现五颗行星的双星系统，含一颗'岩浆海'超级地球" },
  { id: "tau_cet", name: "天仓五", nameEn: "Tau Ceti", group: "系外行星系统", ra: 26.0093029, dec: -15.9337987, dLy: 11.75, color: 0xa8e9c8, pointKind: "star", src: "NASA Exoplanet Archive TAP ps (J2000) · tau Cet", brief: "天仓五（Tau Ceti）：已确认拥有系外行星的宿主恒星。" },
  { id: "eps_eri", name: "波江座 ε", nameEn: "Epsilon Eridani", group: "系外行星系统", ra: 53.2284306, dec: -9.4581715, dLy: 10.45, color: 0xa8e9c8, pointKind: "star", src: "NASA Exoplanet Archive TAP ps (J2000) · eps Eri", brief: "波江座 ε（Epsilon Eridani）：已确认拥有系外行星的宿主恒星。" },
  { id: "hd_209458", name: "HD 209458", nameEn: "HD 209458", group: "系外行星系统", ra: 330.7950219, dec: 18.8842419, dLy: 157.5, color: 0xa8e9c8, pointKind: "star", src: "NASA Exoplanet Archive TAP ps (J2000) · HD 209458", brief: "HD 209458（HD 209458）：已确认拥有系外行星的宿主恒星。" },
  { id: "hat_p_7", name: "HAT-P-7", nameEn: "HAT-P-7", group: "系外行星系统", ra: 292.24719, dec: 47.9695429, dLy: 1112.4, color: 0xa8e9c8, pointKind: "star", src: "NASA Exoplanet Archive TAP ps (J2000) · HAT-P-7", brief: "HAT-P-7（HAT-P-7）：已确认拥有系外行星的宿主恒星。" },
  { id: "k2_18", name: "K2-18", nameEn: "K2-18", group: "系外行星系统", ra: 172.560141, dec: 7.5878315, dLy: 124.0, color: 0xa8e9c8, pointKind: "star", src: "NASA Exoplanet Archive TAP ps (J2000) · K2-18", brief: "K2-18（K2-18）：已确认拥有系外行星的宿主恒星。" },
  { id: "lhs_1140", name: "LHS 1140", nameEn: "LHS 1140", group: "系外行星系统", ra: 11.248632, dec: -15.2741085, dLy: 48.9, color: 0xa8e9c8, pointKind: "star", src: "NASA Exoplanet Archive TAP ps (J2000) · LHS 1140", brief: "LHS 1140（LHS 1140）：已确认拥有系外行星的宿主恒星。" },
  { id: "hd_189733", name: "HD 189733", nameEn: "HD 189733", group: "系外行星系统", ra: 300.1821223, dec: 22.7097759, dLy: 64.5, color: 0xa8e9c8, pointKind: "star", src: "NASA Exoplanet Archive TAP ps (J2000) · HD 189733", brief: "HD 189733（HD 189733）：已确认拥有系外行星的宿主恒星。" },
];

export default POINT_STARS;
