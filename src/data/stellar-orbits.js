/**
 * 恒星系统「真实层级 + 真实互绕」目录 —— AU 级系统页的唯一数据真相源。
 *
 * ── 为什么是树，不是一对二体 ───────────────────────────────────────
 * 银河系页里所有恒星只是「一个点 + 名字」，多星成员与主星共用 J2000 坐标。
 * 下钻一层后必须画出**真实的引力层级**：南门二是 (A+B) 内层双星再加外层
 * 比邻星的三合星；五车二是 (Aa+Ab) 与 (H+L) 两对双星组成的四合星；北河二
 * 是三对分光双星组成的六合星。把它们一律画成「两颗星对转」是错的。
 *
 * 因此每个系统是一棵二叉树：
 *   pair —— 一对互绕，节点自身带该层的六根数（a/e/i/Ω/ω/T0/P）与质量来源；
 *           两个子节点可以是 star（叶）也可以是另一个 pair（子系统）。
 *   star —— 一颗真实恒星（含白矮星 / 黑洞等致密成员）。
 * 层级系统的标准近似：每一层都当作一个二体问题，子系统的总质量集中在它
 * 自己的质心上参与外层互绕。这在 a_outer / a_inner > 10 时精度很好。
 *
 * ── 每层都是真互绕，没有「一颗静止的主星」 ───────────────────────
 * 相对轨道 r = r2 − r1 是以质心为焦点的开普勒椭圆，六根数为
 * a_rel / e / i / Ω / ω / T0；两成员各自绕质心的半长轴
 *   a1 = a_rel·m2/(m1+m2),  a2 = a_rel·m1/(m1+m2)
 * e、i、Ω、P 相同，ω 差 180°，任意时刻 m1·r1 + m2·r2 = 0。
 * 若某个成员本身是子系统，m_i 取该子系统全部成员质量之和，其质心
 * 按同样的开普勒椭圆运动，内部再各自互绕。
 *
 * ── 数据精度分级（每个 pair 独立标注） ────────────────────────────
 *   published —— 六根数与质量直接取自论文 / 星表 infobox；
 *   derived   —— 周期、质量取自文献，半长轴或周期由开普勒第三定律反算；
 *   schematic —— 外层轨道的倾角 / 近星点历元 / 偏心率无可靠公开值，
 *                仅作为相位与观察角度起点，页面明确标注，绝不冒充观测值。
 * 星体球径为便于观察而放大（真实恒星在 AU 尺度下不足一个像素）；
 * 半长轴、偏心率、倾角、周期、相位全部为真实值，跨层级的**显示间距**
 * 可被压缩以保证同屏可见，页面会显式标出压缩倍数，且可切回严格线性。
 *
 * 本文件是纯数据，不依赖 DOM / Three.js，Node 自检可直接 import。
 */

/** 1 天文单位 = 1/63241.077 光年（IAU 2012） */
export const AU_IN_LY = 1 / 63241.077;
/** 儒略年天数 */
export const DAYS_PER_YEAR = 365.25;
/** 儒略年（年）→ 天 */
export const years = (y) => y * DAYS_PER_YEAR;
/** 由 a(AU) 与总质量(M☉) 反算周期(天)：a³ = M·P²，P 单位年 */
export function periodFromKepler(aAu, totalMass) {
  return years(Math.sqrt((aAu ** 3) / totalMass));
}
/** 由 P(天) 与总质量(M☉) 反算半长轴(AU) */
export function axisFromKepler(periodDays, totalMass) {
  const pYears = periodDays / DAYS_PER_YEAR;
  return Math.cbrt(totalMass * pYears * pYears);
}

const BLUE = 0xc8dcff;
const WARM = 0xffd9a0;
const GOLD = 0xffcf70;
const RED = 0xff8a6a;
const WHITE = 0xe8f0ff;
const ORANGE = 0xffa860;
const GREEN = 0xa8e9c8;
const VIOLET = 0xb090ff;

/** 一颗恒星（叶子节点）。mass 单位 M☉，radius 单位 R☉。 */
const star = (o) => ({ kind: 'star', ...o });
/** 一对互绕（内部节点）。periodDays 单位天，aAu 单位 AU，角度单位度。 */
const pair = (o) => ({ kind: 'pair', ...o });

const WIKI = 'Wikipedia / SIMBAD infobox (J2000)';
const KEPLER = '开普勒第三定律 a³=M·P² 反算（derived）';
const KEPLER_EN = "Kepler's third law a³=M·P² (derived)";

/**
 * 系统字段：
 *   key/nodeId      系统键名 / 宇宙层级节点 ID
 *   zh/en           系统中英名（写明几合星）
 *   multiplicity    真实成员星数（2/3/4/6）
 *   distanceLy      到太阳的距离（光年）
 *   tree            层级根 pair
 *   extras          绕整个根质心的额外天体（如环双星行星）
 *   bodies          银河系页里哪些天体可以下钻到本系统
 *   briefZh/En      系统简介；sourceZh/En 各层根数来源汇总
 *   levelRatio      跨层级显示压缩比（子层显示半长轴 / 父成员显示半长轴）
 */
export const STELLAR_SYSTEMS = [
  {
    key: 'sirius', nodeId: 'sys_sirius',
    zh: '天狼星双星', en: 'Sirius binary',
    multiplicity: 2, distanceLy: 8.61, levelRatio: 0.26,
    tree: pair({
      tag: 'ab', zh: '天狼星 A / B', en: 'Sirius A / B',
      aAu: 19.8, e: 0.59142, periodDays: years(50.1284),
      inc: 136.336, node: 45.400, argPeri: 149.161, epochYear: 1994.5715,
      quality: 'published',
      sourceZh: 'Bond 等 2017 / Wikipedia infobox：P=50.1284±0.0043 年，a=7.4957″(19.8 AU)，e=0.59142，i=136.336°，Ω=45.400°，ω=149.161°，T0=1994.5715；质量 2.063 / 1.018 M☉。',
      sourceEn: 'Bond et al. 2017 / Wikipedia infobox: P=50.1284 yr, a=19.8 AU, e=0.59142, i=136.336°, Omega=45.400°, omega=149.161°, T0=1994.5715; masses 2.063 / 1.018 Msun.',
      a: star({
        tag: 'a', zh: '天狼星 A', en: 'Sirius A', spectral: 'A0mA1 Va',
        typeZh: '蓝白主序星', typeEn: 'Blue-white main-sequence star',
        mass: 2.063, radius: 1.7144, color: BLUE,
        noteZh: '全天最亮恒星的主星。', noteEn: 'The primary of the brightest star in our sky.',
      }),
      b: star({
        tag: 'b', zh: '天狼星 B', en: 'Sirius B', spectral: 'DA2',
        typeZh: '白矮星（地球大小、约 1 个太阳质量）', typeEn: 'White dwarf (Earth-sized, ~1 solar mass)',
        bodyKind: 'whitedwarf', mass: 1.018, radius: 0.008098, color: WHITE,
        noteZh: '人类发现的第一颗白矮星之一，密度极高。', noteEn: 'One of the first white dwarfs ever found; extremely dense.',
      }),
    }),
    briefZh: '全天最亮的恒星其实是一对：蓝白色的天狼星 A 与一颗地球大小的白矮星，以 50.13 年周期、0.591 偏心率绕共同质心互绕。近星点约 8 天文单位、远星点约 31 天文单位，能清楚看出开普勒第二定律的「近快远慢」。这是真正的双星系统，不是三合星。',
    briefEn: 'The brightest star in our sky is a genuine pair: blue-white Sirius A and an Earth-sized white dwarf, orbiting their common barycentre every 50.13 years on a distinctly eccentric (e=0.591) orbit. This is a true binary, not a triple.',
    sourceZh: 'Bond 等 2017；天狼星 C 仅为历史上的可疑第三体，未获证实，故不画。',
    sourceEn: 'Bond et al. 2017. A putative "Sirius C" has never been confirmed and is deliberately omitted.',
    bodies: ['sirius', 'sirius_b'],
  },

  {
    key: 'alphacen', nodeId: 'sys_alphacen',
    zh: '南门二 三合星', en: 'Alpha Centauri triple',
    multiplicity: 3, distanceLy: 4.37, levelRatio: 0.26,
    tree: pair({
      tag: 'outer', zh: '外层：AB 质心 ↔ 比邻星', en: 'Outer: AB barycentre ↔ Proxima',
      aAu: 8700, e: 0.50, periodDays: years(547000),
      inc: 107.6, node: 126, argPeri: 72.3, epochYear: 283,
      quality: 'published',
      sourceZh: 'Kervella 等 2017 / Wikipedia 比邻星 infobox：P=547000+6600−4000 年，a=8700+700−400 AU，e=0.50，i=107.6°，Ω=126°，ω(伴星)=72.3°，近星点历元约公元 283 年；比邻星质量 0.1221 M☉。a³/P²≈2.20 M☉，与 AB(1.988)+C(0.1221)=2.110 M☉ 自洽。',
      sourceEn: 'Kervella et al. 2017 / Proxima Centauri infobox: P=547,000 yr, a=8,700 AU, e=0.50, i=107.6°, Omega=126°, omega(secondary)=72.3°, periastron ~AD 283; Proxima 0.1221 Msun. a³/P²~2.20 Msun is consistent with 2.110 Msun total.',
      a: pair({
        tag: 'ab', zh: '内层：南门二 A / B', en: 'Inner: Alpha Centauri A / B',
        aAu: 23.299, e: 0.51947, periodDays: years(79.762),
        inc: 79.243, node: 205.073, argPeri: 231.519, epochYear: 1875.66,
        quality: 'published',
        sourceZh: 'Pourbaix 等 2002 / Kervella 等 2016 infobox：P=79.762 年，a=23.299 AU，e=0.51947，i=79.243°，Ω=205.073°，ω=231.519°，T0=1875.66；质量 1.0788 / 0.9092 M☉。',
        sourceEn: 'Pourbaix et al. 2002 / Kervella et al. 2016 infobox: P=79.762 yr, a=23.299 AU, e=0.51947, i=79.243°, Omega=205.073°, omega=231.519°, T0=1875.66; masses 1.0788 / 0.9092 Msun.',
        a: star({
          tag: 'a', zh: '南门二 A', en: 'Alpha Centauri A', spectral: 'G2V',
          typeZh: '类太阳主序星', typeEn: 'Sun-like main-sequence star',
          mass: 1.0788, radius: 1.223, color: GOLD,
          noteZh: '与太阳几乎同型，是离我们最近的类太阳恒星。', noteEn: 'Nearly a solar twin; the closest Sun-like star.',
        }),
        b: star({
          tag: 'b', zh: '南门二 B', en: 'Alpha Centauri B', spectral: 'K1V',
          typeZh: '橙矮星', typeEn: 'Orange dwarf',
          mass: 0.9092, radius: 0.864, color: ORANGE,
          noteZh: '与 A 每 79.76 年互绕一圈。', noteEn: 'Orbits A every 79.76 years.',
        }),
      }),
      b: star({
        tag: 'c', zh: '比邻星（南门二 C）', en: 'Proxima Centauri (Alpha Cen C)', spectral: 'M5.5Ve',
        typeZh: '红矮星 · 耀星（已知最近的恒星）', typeEn: 'Red dwarf / flare star (the nearest star)',
        mass: 0.1221, radius: 0.1542, color: RED,
        noteZh: '在约 8700 天文单位外绕 A/B 共同质心运行，周期约 54.7 万年。', noteEn: 'Circles the A/B barycentre at ~8,700 AU with a ~547,000-year period.',
      }),
    }),
    briefZh: '离我们最近的恒星系统是**三合星**：南门二 A 与 B 以 79.76 年互绕，比邻星（C）在约 8700 天文单位外绕 A/B 的共同质心运行，周期约 54.7 万年。三颗星都在画面里，各自按本层真实轨道运动；跨层间距为便于同屏观察做了压缩，层内比例保持真实。',
    briefEn: 'Our nearest stellar system is a **triple**: Alpha Centauri A and B orbit each other every 79.76 years, while Proxima (C) circles their common barycentre at ~8,700 AU with a ~547,000-year period. All three stars are drawn and move on their own real orbits; inter-level distances are compressed for visibility, intra-level ratios stay true.',
    sourceZh: '外层 Kervella 等 2017；内层 Pourbaix 等 2002。三级质量分别 1.0788 / 0.9092 / 0.1221 M☉。',
    sourceEn: 'Outer orbit Kervella et al. 2017; inner orbit Pourbaix et al. 2002. Masses 1.0788 / 0.9092 / 0.1221 Msun.',
    bodies: ['alphaCen', 'alphacen_a', 'alphacen_b', 'proxima'],
  },

  {
    key: 'procyon', nodeId: 'sys_procyon',
    zh: '南河三双星', en: 'Procyon binary',
    multiplicity: 2, distanceLy: 11.46, levelRatio: 0.26,
    tree: pair({
      tag: 'ab', zh: '南河三 A / B', en: 'Procyon A / B',
      aAu: 15.137, e: 0.39785, periodDays: years(40.840),
      inc: 31.408, node: 100.683, argPeri: 89.23, epochYear: 1968.076,
      quality: 'published',
      sourceZh: 'Gatewood 等 / Wikipedia infobox：P=40.840 年，a=15.137 AU，e=0.39785，i=31.408°，Ω=100.683°，ω=89.23°，T0=1968.076；质量 1.478 / 0.592 M☉。',
      sourceEn: 'Gatewood et al. / Wikipedia infobox: P=40.840 yr, a=15.137 AU, e=0.39785, i=31.408°, Omega=100.683°, omega=89.23°, T0=1968.076; masses 1.478 / 0.592 Msun.',
      a: star({
        tag: 'a', zh: '南河三 A', en: 'Procyon A', spectral: 'F5 IV–V',
        typeZh: '黄白亚巨星', typeEn: 'Yellow-white subgiant',
        mass: 1.478, radius: 2.043, color: WARM,
      }),
      b: star({
        tag: 'b', zh: '南河三 B', en: 'Procyon B', spectral: 'DQZ',
        typeZh: '白矮星', typeEn: 'White dwarf', bodyKind: 'whitedwarf',
        mass: 0.592, radius: 0.01234, color: WHITE,
      }),
    }),
    briefZh: '与天狼星几乎同构的一对：一颗正在膨胀的 F 型亚巨星，加一颗白矮星。倾角只有 31.4°，轨道面几乎正对我们，这一屏看到的椭圆与真实形状最接近。它是双星，不是聚星。',
    briefEn: 'A near-twin of Sirius: an evolving F-type subgiant plus a white dwarf. With i=31.4° the orbital plane faces us almost squarely, so the ellipse on screen is close to its true shape. A genuine binary.',
    sourceZh: 'Gatewood 等 / Wikipedia infobox。', sourceEn: 'Gatewood et al. / Wikipedia infobox.',
    bodies: ['procyon', 'procyon_b'],
  },

  {
    key: 'eridani40', nodeId: 'sys_eridani40',
    zh: '波江座 40 三合星', en: '40 Eridani triple',
    multiplicity: 3, distanceLy: 16.35, levelRatio: 0.26,
    tree: pair({
      tag: 'outer', zh: '外层：A ↔ B/C 质心', en: 'Outer: A ↔ B/C barycentre',
      aAu: 400, e: 0.30, periodDays: periodFromKepler(400, 1.54),
      inc: 108.9, node: 150.9, argPeri: 327.8, epochYear: 1849.6,
      quality: 'derived',
      sourceZh: 'Wikipedia 波江座 40 infobox：BC/A 轨道 P≈8000 年、a≈400 AU（均为约数）。此处按 a=400 AU 与总质量 1.54 M☉ 用开普勒第三定律反算 P≈6450 年；外层 e / i / Ω / ω / T0 无公开轨道解，沿用内层角度作示意起点，仅决定观察方位。',
      sourceEn: '40 Eridani infobox: outer BC/A orbit P~8000 yr, a~400 AU (both approximate). P~6450 yr is recomputed from a=400 AU and 1.54 Msun; outer e/i/Omega/omega/T0 have no published solution and are view/phase references only.',
      a: star({
        tag: 'a', zh: '波江座 40 A', en: '40 Eridani A', spectral: 'K1V',
        typeZh: '橙矮星（系统主星）', typeEn: 'Orange dwarf (system primary)',
        mass: 0.84, radius: 0.81, color: GOLD,
        noteZh: '在约 400 天文单位外绕 B/C 的共同质心运行。', noteEn: 'Circles the B/C barycentre at ~400 AU.',
      }),
      b: pair({
        tag: 'bc', zh: '内层：B / C', en: 'Inner: B / C',
        aAu: 35, e: 0.410, periodDays: years(252.1),
        inc: 108.9, node: 150.9, argPeri: 327.8, epochYear: 1849.6,
        quality: 'published',
        sourceZh: 'Wikipedia 波江座 40 infobox：C/B P=252.1 年，a=6.943″(≈35 AU)，e=0.410，i=108.9°，Ω=150.9°，ω=327.8°，T=1849.6；质量 0.50 / 0.20 M☉。a³/P²≈0.675 M☉ 与 0.70 M☉ 自洽。',
        sourceEn: '40 Eridani infobox: C/B P=252.1 yr, a=6.943" (~35 AU), e=0.410, i=108.9°, Omega=150.9°, omega=327.8°, T=1849.6; masses 0.50 / 0.20 Msun. a³/P²~0.675 Msun is consistent with 0.70 Msun.',
        a: star({
          tag: 'b', zh: '波江座 40 B', en: '40 Eridani B', spectral: 'DA4',
          typeZh: '白矮星（人类发现的第一颗白矮星）', typeEn: 'White dwarf (the first ever discovered)',
          bodyKind: 'whitedwarf', mass: 0.50, radius: 0.014, color: WHITE,
        }),
        b: star({
          tag: 'c', zh: '波江座 40 C', en: '40 Eridani C', spectral: 'M4.5eV',
          typeZh: '红矮星 · 耀星', typeEn: 'Red dwarf / flare star',
          mass: 0.20, radius: 0.31, color: RED,
        }),
      }),
    }),
    briefZh: '**三合星**：K 型主星 A 在约 400 天文单位外绕内层 B/C 的共同质心运行；内层是一颗白矮星与一颗红矮星以 252 年互绕。两层共 3 颗星，质量差让每层的两条椭圆大小明显不同。',
    briefEn: '**Triple system**: the K-type primary A circles the inner B/C barycentre at ~400 AU, while the inner pair — a white dwarf and a red dwarf — orbit each other every 252 years. Three stars on two hierarchical levels.',
    sourceZh: 'Wikipedia 波江座 40 infobox（内外两层根数）；外层周期由开普勒第三定律反算。',
    sourceEn: '40 Eridani infobox for both levels; the outer period is recomputed from Kepler\'s third law.',
    bodies: ['eridani_40a', 'eridani_40b', 'eridani_40c'],
  },

  {
    key: 'capella', nodeId: 'sys_capella',
    zh: '五车二 四合星', en: 'Capella quadruple',
    multiplicity: 4, distanceLy: 42.92, levelRatio: 0.28,
    tree: pair({
      tag: 'outer', zh: '外层：黄巨星对 ↔ 红矮星对', en: 'Outer: giant pair ↔ red-dwarf pair',
      aAu: 10000, e: 0.30, periodDays: periodFromKepler(10000, 5.7715),
      inc: 62, node: 20, argPeri: 0, epochYear: 2000,
      quality: 'schematic',
      sourceZh: 'Wikipedia 五车二条目：两对双星投影间距约 10,000 AU（原文「距离第一对大约 10,000 天文单位」）。此处把该投影距当作半长轴，按总质量 5.7715 M☉ 反算 P≈41.6 万年；e / i / Ω / ω / T0 无公开轨道解，均为观察与相位起点，标为 schematic。',
      sourceEn: 'Capella article: the two binary pairs are ~10,000 AU apart (a projected separation). Treated here as the semi-major axis, P~416,000 yr follows from 5.7715 Msun; e/i/Omega/omega/T0 are unpublished and used only as view/phase references (schematic).',
      a: pair({
        tag: 'giants', zh: '内层：五车二 Aa / Ab', en: 'Inner: Capella Aa / Ab',
        aAu: 0.74272, e: 0.001, periodDays: 104.02128,
        inc: 0, node: 0, argPeri: 0, epochYear: 2000,
        quality: 'schematic',
        sourceZh: 'Torres 等 2015 / Wikipedia infobox：P=104.02128 天，a=0.74272 AU，e≈0，质量 2.5687 / 2.4828 M☉，半径 11.98 / 8.83 R☉。轨道倾角与近星点历元无可靠公开值，取 0° / J2000 作观察与相位起点，不影响周期与半长轴。',
        sourceEn: 'Torres et al. 2015 / Capella infobox: P=104.02128 d, a=0.74272 AU, e~0, masses 2.5687 / 2.4828 Msun. Inclination and periastron epoch are not reliably published; 0° / J2000 are view/phase references only.',
        a: star({
          tag: 'aa', zh: '五车二 Aa', en: 'Capella Aa', spectral: 'K0 III',
          typeZh: '黄色巨星（氦核聚变）', typeEn: 'Yellow giant (core helium burning)',
          mass: 2.5687, radius: 11.98, color: GOLD,
        }),
        b: star({
          tag: 'ab', zh: '五车二 Ab', en: 'Capella Ab', spectral: 'G1 III',
          typeZh: '黄色巨星 / 次巨星', typeEn: 'Yellow giant / subgiant',
          mass: 2.4828, radius: 8.83, color: WARM,
        }),
      }),
      b: pair({
        tag: 'dwarfs', zh: '内层：五车二 H / L', en: 'Inner: Capella H / L',
        aAu: 48, e: 0.20, periodDays: years(388),
        inc: 55, node: 110, argPeri: 0, epochYear: 2000,
        quality: 'derived',
        sourceZh: 'Wikipedia / NBAS 御夫座条目：H 与 L 相距约 48 AU、周期约 350 年，是一对红矮星。此处取 P=388 年由 a=48 AU 与质量 0.53+0.19=0.72 M☉ 反算（a³/P²≈0.735 M☉ 自洽）；e / i / Ω / ω / T0 为示意起点。',
        sourceEn: 'Capella / Auriga references: H and L are ~48 AU apart with a ~350-year period. P=388 yr is recomputed from a=48 AU and 0.53+0.19=0.72 Msun (a³/P²~0.735 Msun); other angles are indicative.',
        a: star({
          tag: 'h', zh: '五车二 H', en: 'Capella H', spectral: 'M1V',
          typeZh: '红矮星（GJ 195 A）', typeEn: 'Red dwarf (GJ 195 A)',
          mass: 0.53, radius: 0.55, color: RED,
        }),
        b: star({
          tag: 'l', zh: '五车二 L', en: 'Capella L', spectral: 'M5V',
          typeZh: '红矮星（GJ 195 B）', typeEn: 'Red dwarf (GJ 195 B)',
          mass: 0.19, radius: 0.24, color: 0xff9d80,
        }),
      }),
    }),
    briefZh: '**四合星**，两对双星：黄巨星 Aa/Ab 相距 0.74 天文单位、每 104 天互绕；另一对红矮星 H/L 相距约 48 天文单位、周期约 388 年；两对质心又相隔约 1 万天文单位互绕。四颗星都在画面里，各自按本层真实轨道运动。历史上称为 C~K 的视场伴星与系统无物理关联，不画。',
    briefEn: '**Quadruple**: two binary pairs. The yellow giants Aa/Ab are 0.74 AU apart with a 104-day period; the red dwarfs H/L sit ~48 AU apart with a ~388-year period; the two pair barycentres orbit each other ~10,000 AU apart. All four stars are drawn, each moving on its own real orbit. Companions C–K are optical and omitted.',
    sourceZh: 'Torres 等 2015、Wikipedia 五车二条目；外层与 H/L 对周期由开普勒第三定律反算。',
    sourceEn: 'Torres et al. 2015 and the Capella article; outer and H/L periods recomputed from Kepler\'s third law.',
    bodies: ['capella', 'capella_aa', 'capella_ab', 'capella_ba', 'capella_bb'],
  },

  {
    key: 'castor', nodeId: 'sys_castor',
    zh: '北河二 六合星', en: 'Castor sextuple',
    multiplicity: 6, distanceLy: 51, levelRatio: 0.30,
    tree: pair({
      tag: 'outer', zh: '最外层：AB ↔ C（双子座 YY）', en: 'Outermost: AB ↔ C (YY Gem)',
      aAu: 1130, e: 0.30, periodDays: years(14000),
      inc: 70, node: 0, argPeri: 0, epochYear: 2000,
      quality: 'derived',
      sourceZh: 'Wikipedia / star-facts 北河二条目：C 距 AB 约 73″（15.64 pc 处 ≈1130 AU），绕行周期约 14,000 年；质量 AB≈5.2、C=1.19 M☉。a³/P²≈7.4 M☉ 与 6.39 M☉ 同量级。外层 e / i / Ω / ω / T0 为示意起点。',
      sourceEn: 'Castor references: C lies ~73" from AB (~1,130 AU at 15.64 pc) with a ~14,000-year period; AB~5.2 and C=1.19 Msun. Outer angles are indicative.',
      a: pair({
        tag: 'ab', zh: '外层：北河二 A ↔ B', en: 'Outer: Castor A ↔ B',
        aAu: 106, e: 0.343, periodDays: years(467),
        inc: 114.5, node: 41.3, argPeri: 249.5, epochYear: 1958.0,
        quality: 'published',
        sourceZh: 'Heintz 1988 (PASP 100:834)：P=467 年，a=6.805″(≈106 AU @51 ly)，e=0.343，i=114.5°，Ω=41.3°，ω=249.5°，T0=1958.0。a³/P²≈5.46 M☉ 与 A(2.871)+B(2.289)=5.16 M☉ 自洽。',
        sourceEn: 'Heintz 1988 (PASP 100:834): P=467 yr, a=6.805" (~106 AU at 51 ly), e=0.343, i=114.5°, Omega=41.3°, omega=249.5°, T0=1958.0.',
        a: pair({
          tag: 'a', zh: '内层：北河二 Aa / Ab', en: 'Inner: Castor Aa / Ab',
          aAu: axisFromKepler(9.2128, 2.871), e: 0.10,
          periodDays: 9.2128, inc: 60, node: 0, argPeri: 0, epochYear: 2000,
          quality: 'derived',
          sourceZh: 'Wikiwand / A&A 2001 (Güdel 等)：Aa/Ab P=9.2128 天，Aa=2.371 M☉ / 2.089 R☉ (A1V)，Ab 约 0.4–0.6 M☉ 的 M 矮星。半长轴由开普勒第三定律反算约 0.122 AU；e / i / Ω / ω / T0 为示意起点。',
          sourceEn: 'Castor references / A&A 2001: Aa/Ab P=9.2128 d, Aa=2.371 Msun / 2.089 Rsun (A1V), Ab an M dwarf of 0.4–0.6 Msun. a~0.122 AU from Kepler\'s law; other angles indicative.',
          a: star({
            tag: 'aa', zh: '北河二 Aa', en: 'Castor Aa', spectral: 'A1V',
            typeZh: '白色主序星', typeEn: 'White main-sequence star',
            mass: 2.371, radius: 2.089, color: BLUE,
          }),
          b: star({
            tag: 'ab', zh: '北河二 Ab', en: 'Castor Ab', spectral: 'M5V?',
            typeZh: '红矮星（分光伴星）', typeEn: 'Red dwarf (spectroscopic companion)',
            mass: 0.5, radius: 0.5, color: RED,
          }),
        }),
        b: pair({
          tag: 'b', zh: '内层：北河二 Ba / Bb', en: 'Inner: Castor Ba / Bb',
          aAu: axisFromKepler(2.9283, 2.289), e: 0.0,
          periodDays: 2.9283, inc: 60, node: 0, argPeri: 0, epochYear: 2000,
          quality: 'derived',
          sourceZh: 'Wikiwand / A&A 2001：Ba/Bb P=2.9283 天圆轨道，Ba=1.789 M☉ / 1.648 R☉ (A2Vm)，Bb 约 0.4–0.6 M☉ 的 M 矮星；半长轴由开普勒第三定律反算约 0.053 AU。',
          sourceEn: 'Castor references / A&A 2001: Ba/Bb P=2.9283 d circular, Ba=1.789 Msun / 1.648 Rsun (A2Vm), Bb an M dwarf of 0.4–0.6 Msun; a~0.053 AU from Kepler\'s law.',
          a: star({
            tag: 'ba', zh: '北河二 Ba', en: 'Castor Ba', spectral: 'A2Vm',
            typeZh: '白色主序星（金属线星）', typeEn: 'White main-sequence star (Am)',
            mass: 1.789, radius: 1.648, color: BLUE,
          }),
          b: star({
            tag: 'bb', zh: '北河二 Bb', en: 'Castor Bb', spectral: 'M2V',
            typeZh: '红矮星（分光伴星）', typeEn: 'Red dwarf (spectroscopic companion)',
            mass: 0.5, radius: 0.5, color: RED,
          }),
        }),
      }),
      b: pair({
        tag: 'c', zh: '内层：双子座 YY（Ca / Cb）', en: 'Inner: YY Gem (Ca / Cb)',
        aAu: axisFromKepler(0.814, 1.19), e: 0.0,
        periodDays: 0.814, inc: 86.2, node: 0, argPeri: 0, epochYear: 2000,
        quality: 'published',
        sourceZh: 'Pettersen 1976 / A&A 2001：YY Gem 两颗几乎相同的 dMe 红矮星以 0.814 天圆轨道互食，i=86.2°，质量 0.62 / 0.57 M☉、半径 0.66 / 0.58 R☉；半长轴由开普勒第三定律反算约 0.018 AU。',
        sourceEn: 'Pettersen 1976 / A&A 2001: YY Gem is two nearly identical dMe red dwarfs in a 0.814-day circular eclipsing orbit, i=86.2°, masses 0.62 / 0.57 Msun, radii 0.66 / 0.58 Rsun; a~0.018 AU from Kepler\'s law.',
        a: star({
          tag: 'ca', zh: '双子座 YY A（Ca）', en: 'YY Gem A (Ca)', spectral: 'M0.5Ve',
          typeZh: '红矮星 · 耀星', typeEn: 'Red dwarf / flare star',
          mass: 0.62, radius: 0.66, color: ORANGE,
        }),
        b: star({
          tag: 'cb', zh: '双子座 YY B（Cb）', en: 'YY Gem B (Cb)', spectral: 'M0.5Ve',
          typeZh: '红矮星 · 耀星', typeEn: 'Red dwarf / flare star',
          mass: 0.57, radius: 0.58, color: ORANGE,
        }),
      }),
    }),
    briefZh: '**六合星**：三对分光双星。Aa/Ab（9.21 天）与 Ba/Bb（2.93 天）各自的质心再以 467 年互绕；更外侧的 YY Gem（Ca/Cb，0.814 天食双星）在约 1130 天文单位外绕 AB 运行。六颗星全部画出，按四层真实周期运动（0.814 天到 1.4 万年）。',
    briefEn: '**Sextuple**: three spectroscopic pairs. Aa/Ab (9.21 d) and Ba/Bb (2.93 d) barycentres orbit each other every 467 years, while YY Gem (Ca/Cb, a 0.814-day eclipsing binary) circles AB at ~1,130 AU. All six stars are drawn across four hierarchy levels (0.814 d to 14,000 yr).',
    sourceZh: 'Heintz 1988、A&A 2001 (Güdel 等)、Pettersen 1976、Wikipedia 北河二条目；三条内层半长轴由开普勒第三定律反算。',
    sourceEn: 'Heintz 1988, A&A 2001 (Güdel et al.), Pettersen 1976 and Castor references; the three inner semi-major axes come from Kepler\'s third law.',
    bodies: ['castor', 'castor_a1', 'castor_a2', 'castor_b1', 'castor_b2', 'castor_c1', 'castor_c2'],
  },

  {
    key: 'kepler16', nodeId: 'sys_kepler16',
    zh: '开普勒 16 双星 + 环双星行星', en: 'Kepler-16 binary + circumbinary planet',
    multiplicity: 2, distanceLy: 245.4, levelRatio: 0.26,
    tree: pair({
      tag: 'ab', zh: '开普勒 16 A / B', en: 'Kepler-16 A / B',
      aAu: 0.22431, e: 0.15944, periodDays: 41.079220,
      inc: 90.304, node: 0, argPeri: 263.464, epochYear: 2010.04,
      quality: 'published',
      sourceZh: 'Doyle 等 2011 (Science) / Bender 等 2012 (ApJL 751:L31)：双星 P=41.079220 天，a=0.22431 AU，e=0.15944，i=90.304°，ω=263.464°，质量 0.6897 / 0.20255 M☉；行星 b：a=0.7048 AU，P=228.776 天，e=0.0069，i=90.032°。',
      sourceEn: 'Doyle et al. 2011 (Science) / Bender et al. 2012 (ApJL 751:L31): binary P=41.079220 d, a=0.22431 AU, e=0.15944, i=90.304°, omega=263.464°, masses 0.6897 / 0.20255 Msun; planet b: a=0.7048 AU, P=228.776 d, e=0.0069, i=90.032°.',
      a: star({
        tag: 'a', zh: '开普勒 16 A', en: 'Kepler-16 A', spectral: 'K-type V',
        typeZh: '橙矮星', typeEn: 'K-type main-sequence star',
        mass: 0.6897, radius: 0.6489, color: GOLD,
      }),
      b: star({
        tag: 'b', zh: '开普勒 16 B', en: 'Kepler-16 B', spectral: 'M-type V',
        typeZh: '红矮星', typeEn: 'M-type red dwarf',
        mass: 0.20255, radius: 0.22623, color: RED,
      }),
    }),
    extras: [
      {
        tag: 'p', zh: '开普勒 16b', en: 'Kepler-16b',
        aAu: 0.7048, e: 0.0069, periodDays: 228.776,
        inc: 90.032, node: 0, argPeri: 0, epochYear: 2010.04,
        color: GREEN, bodyKind: 'planet',
        typeZh: '环双星气态巨行星（土星大小，0.333 木星质量）',
        typeEn: 'Circumbinary gas giant (Saturn-sized, 0.333 Jupiter masses)',
        noteZh: '绕两颗恒星的共同质心运行，不绕任何单颗恒星。轨道半径约为双星间距的 3.1 倍，处于环双星稳定极限附近。',
        noteEn: 'It orbits the common barycentre, not either star. Its radius is ~3.1 times the binary separation, close to the circumbinary stability limit.',
      },
    ],
    briefZh: '第一颗被确认的环双星行星系统：两颗恒星每 41.08 天互绕一圈，土星大小的行星开普勒 16b 在 0.7048 天文单位外绕整个双星的质心公转，周期 228.78 天。这是双星 + 行星，不是三合星。',
    briefEn: 'The first confirmed circumbinary planet: two stars orbit each other every 41.08 days while the Saturn-sized Kepler-16b circles the whole binary at 0.7048 AU every 228.78 days. A binary plus a planet, not a triple star.',
    sourceZh: 'Doyle 等 2011、Bender 等 2012。', sourceEn: 'Doyle et al. 2011, Bender et al. 2012.',
    bodies: ['kepler_16_a', 'kepler_16_b'],
  },

  {
    key: 'algol', nodeId: 'sys_algol',
    zh: '大陵五 三合星', en: 'Algol triple',
    multiplicity: 3, distanceLy: 92.8, levelRatio: 0.26,
    tree: pair({
      tag: 'outer', zh: '外层：Aa 质心 ↔ Ab', en: 'Outer: Aa barycentre ↔ Ab',
      aAu: 2.69, e: 0.227, periodDays: 680.168,
      inc: 83.66, node: 132.66, argPeri: 310.02 + 180, epochYear: 1987.36,
      quality: 'published',
      sourceZh: 'Wikipedia 大陵五 infobox：Aa/Ab P=680.168 天，a=0.09343″(≈2.69 AU)，e=0.227，i=83.66°，Ω=132.66°，ω(主星)=310.02°，T=JD 2446927.22(≈1987.36)；质量 Aa=3.87、Ab=1.76 M☉。a³/P²≈5.61 M☉ 与总质量 5.63 M☉ 自洽。',
      sourceEn: 'Algol infobox: Aa/Ab P=680.168 d, a=0.09343" (~2.69 AU), e=0.227, i=83.66°, Omega=132.66°, omega(primary)=310.02°, T=JD 2446927.22 (~1987.36); Aa=3.87, Ab=1.76 Msun. a³/P²~5.61 Msun is consistent with 5.63 Msun total.',
      a: pair({
        tag: 'aa', zh: '内层：大陵五 Aa1 / Aa2', en: 'Inner: Algol Aa1 / Aa2',
        aAu: 0.062, e: 0.0, periodDays: 2.867328,
        inc: 98.70, node: 43.43, argPeri: 90, epochYear: 2000,
        quality: 'derived',
        sourceZh: 'Wikipedia 大陵五 infobox：Aa1/Aa2 P=2.867328 天，a=0.00215″(≈0.062 AU)，e=0，i=98.70°，Ω=43.43°，质量 3.17 / 0.70 M☉、半径 2.73 / 3.48 R☉。a³/P²≈3.86 M☉ 与 3.87 M☉ 自洽；近星点历元无公开值，仅作相位起点。',
        sourceEn: 'Algol infobox: Aa1/Aa2 P=2.867328 d, a=0.00215" (~0.062 AU), e=0, i=98.70°, Omega=43.43°, masses 3.17 / 0.70 Msun, radii 2.73 / 3.48 Rsun. Periastron epoch is a phase reference only.',
        a: star({
          tag: 'a1', zh: '大陵五 Aa1', en: 'Algol Aa1', spectral: 'B8V',
          typeZh: '蓝白主序星', typeEn: 'Blue-white main-sequence star',
          mass: 3.17, radius: 2.73, color: BLUE,
          noteZh: '每 2.867 天被伴星掩食一次，造成著名的「恶魔之星」变光。', noteEn: 'Eclipsed every 2.867 days, producing the famous "Demon Star" variability.',
        }),
        b: star({
          tag: 'a2', zh: '大陵五 Aa2', en: 'Algol Aa2', spectral: 'K0IV',
          typeZh: '橙色次巨星（充满洛希瓣）', typeEn: 'Orange subgiant (Roche-lobe filling)',
          mass: 0.70, radius: 3.48, color: ORANGE,
          noteZh: '质量较小却演化更快，是「大陵五佯谬」：它曾把物质转移给今天的主星。', noteEn: 'Less massive but more evolved — the classic Algol paradox from past mass transfer.',
        }),
      }),
      b: star({
        tag: 'ab', zh: '大陵五 Ab', en: 'Algol Ab', spectral: 'F1V',
        typeZh: '黄白主序星', typeEn: 'Yellow-white main-sequence star',
        mass: 1.76, radius: 1.73, color: WARM,
        noteZh: '第三颗星，在 2.69 天文单位外绕内层食双星的质心运行。', noteEn: 'The third star, circling the inner eclipsing pair at 2.69 AU.',
      }),
    }),
    briefZh: '**三合星**：著名的「恶魔之星」食双星 Aa1/Aa2（2.867 天）只是内层；第三颗星 Ab 在 2.69 天文单位外、每 680 天绕内层质心一圈。三颗星同屏，两层各按真实周期运动。',
    briefEn: '**Triple**: the famous eclipsing pair Aa1/Aa2 (2.867 d) is only the inner level. A third star, Ab, circles their barycentre at 2.69 AU every 680 days. All three stars are drawn with their own real periods.',
    sourceZh: 'Wikipedia 大陵五 infobox（内外两层根数）。', sourceEn: 'Algol infobox for both orbital levels.',
    bodies: ['algol'],
  },

  {
    key: 'cygx1', nodeId: 'sys_cygx1',
    zh: '天鹅座 X-1 双星', en: 'Cygnus X-1 binary',
    multiplicity: 2, distanceLy: 6070, levelRatio: 0.26,
    tree: pair({
      tag: 'ab', zh: 'HDE 226868 ↔ 黑洞', en: 'HDE 226868 ↔ black hole',
      aAu: 0.2, e: 0.018, periodDays: 5.599829,
      inc: 48, node: 0, argPeri: 0, epochYear: 2000,
      quality: 'schematic',
      sourceZh: 'Reid 等 2011 / Orosz 等 2011：P=5.599829 天，e=0.018±0.002，a≈0.2 AU，i≈48°，质量 19.2 / 14.8 M☉。倾角仍有 27°~65° 的文献分歧；近星点历元为示意起点。',
      sourceEn: 'Reid et al. 2011 / Orosz et al. 2011: P=5.599829 d, e=0.018, a~0.2 AU, i~48°, masses 19.2 / 14.8 Msun. Inclination is uncertain; periastron epoch is a phase reference.',
      a: star({
        tag: 'a', zh: 'HDE 226868', en: 'HDE 226868', spectral: 'O9.7 Iab',
        typeZh: '蓝超巨星（供物质给黑洞）', typeEn: 'Blue supergiant (mass donor)',
        mass: 19.2, radius: 20, color: BLUE,
      }),
      b: star({
        tag: 'b', zh: '天鹅座 X-1（黑洞）', en: 'Cygnus X-1 (black hole)', spectral: '~14.8 M☉',
        typeZh: '恒星级黑洞（吸积盘发 X 射线）', typeEn: 'Stellar-mass black hole (X-ray accretion disc)',
        bodyKind: 'blackhole', mass: 14.8, radius: 0.00004, color: VIOLET,
        noteZh: '视界只有几十公里，屏幕上用小暗点表示，绝不画成一颗大黑球。', noteEn: 'Only tens of km across; drawn as a tiny dark dot, never a giant black sphere.',
      }),
    }),
    briefZh: '人类确认的第一颗恒星级黑洞候选体：一颗蓝超巨星与约 14.8 倍太阳质量的黑洞每 5.6 天互绕。两者质量相近，质心几乎在正中。这是双星，不是三合星。',
    briefEn: 'The first widely accepted stellar-mass black hole: a blue supergiant and a ~14.8 Msun black hole orbit each other every 5.6 days. With comparable masses the barycentre sits near the middle. A binary.',
    sourceZh: 'Reid 等 2011 / Orosz 等 2011。', sourceEn: 'Reid et al. 2011 / Orosz et al. 2011.',
    bodies: ['cygx1'],
  },

  {
    key: 'v404cyg', nodeId: 'sys_v404cyg',
    zh: 'V404 天鹅座双星', en: 'V404 Cygni binary',
    multiplicity: 2, distanceLy: 7800, levelRatio: 0.26,
    tree: pair({
      tag: 'ab', zh: '黑洞 ↔ K 型巨星', en: 'Black hole ↔ K-type giant',
      aAu: 0.145, e: 0.0, periodDays: 6.47129,
      inc: 60, node: 0, argPeri: 0, epochYear: 2000,
      quality: 'derived',
      sourceZh: 'Casares 等 / Wikipedia infobox：P=6.47129 天，质量 9.0 / 0.7 M☉，e≈0；半长轴 0.145 AU 由开普勒第三定律推算。倾角、近星点历元为示意值。',
      sourceEn: 'Casares et al. / Wikipedia infobox: P=6.47129 d, masses 9.0 / 0.7 Msun, e~0; a=0.145 AU derived from Kepler\'s law. Inclination and periastron epoch are indicative.',
      a: star({
        tag: 'a', zh: 'V404 Cyg A（黑洞）', en: 'V404 Cyg A (black hole)', spectral: '~9 M☉',
        typeZh: '黑洞（2015 年大爆发现象）', typeEn: 'Black hole (2015 giant outburst)',
        bodyKind: 'blackhole', mass: 9.0, radius: 0.00003, color: VIOLET,
      }),
      b: star({
        tag: 'b', zh: 'V404 Cyg B', en: 'V404 Cyg B', spectral: 'K3 III',
        typeZh: '橙巨星（供物质给吸积盘）', typeEn: 'Orange giant (mass donor)',
        mass: 0.7, radius: 6.0, color: ORANGE,
      }),
    }),
    briefZh: '质量比约 13:1 的黑洞双星：黑洞几乎不动，橙巨星绕着它划出大椭圆，每 6.47 天一圈。与天鹅座 X-1 对照看，最能体会质量比怎样决定质心位置。',
    briefEn: 'A ~13:1 mass-ratio black-hole binary: the black hole barely moves while an orange giant sweeps a wide ellipse every 6.47 days. Compare with Cygnus X-1 to see how the mass ratio fixes the barycentre.',
    sourceZh: 'Casares 等 / Wikipedia infobox。', sourceEn: 'Casares et al. / Wikipedia infobox.',
    bodies: ['v404_cyg'],
  },

  {
    key: 'epsilonlyr', nodeId: 'sys_epsilonlyr',
    zh: '织女二（天琴座 ε）四合星', en: 'Epsilon Lyrae quadruple',
    multiplicity: 4, distanceLy: 162, levelRatio: 0.28,
    tree: pair({
      tag: 'outer', zh: '外层：ε1 对 ↔ ε2 对', en: 'Outer: eps1 pair ↔ eps2 pair',
      aAu: 10100, e: 0.40, periodDays: years(400000),
      inc: 65, node: 0, argPeri: 0, epochYear: 2000,
      quality: 'schematic',
      sourceZh: 'Wikipedia 织女二条目：两对双星相距不小于 0.16 光年（≈10100 AU），互绕周期「可能为数十万年」；此处取 40 万年，按总质量 6.54 M☉ 与 a=10100 AU 用开普勒第三定律自洽（a³/P²≈6.44 M☉）。外层角度与偏心率无可靠公开值，标为 schematic。',
      sourceEn: 'Epsilon Lyrae article: the two pairs are at least 0.16 ly (~10,100 AU) apart with a period of "hundreds of thousands of years"; 400,000 yr is used, consistent with 6.54 Msun (a³/P²~6.44 Msun). Outer angles are schematic.',
      a: pair({
        tag: 'e1', zh: '内层：ε1（织女二北对）', en: 'Inner: eps1 (northern pair)',
        aAu: 160, e: 0.30, periodDays: years(1200),
        inc: 60, node: 0, argPeri: 0, epochYear: 2000,
        quality: 'derived',
        sourceZh: 'Wikipedia 织女二条目：ε1 两星相距约 2.8″(≈160 AU @50 pc)，周期粗略估计约 1200 年，光谱 F1V / A8V。质量取 1.50 / 1.34 M☉ 使 a³/P²≈2.84 M☉ 自洽；e / i / Ω / ω / T0 为示意起点。',
        sourceEn: 'Epsilon Lyrae article: eps1 components are ~2.8" (~160 AU at 50 pc) apart with a rough ~1,200-year period, spectral types F1V / A8V. Masses 1.50 / 1.34 Msun keep a³/P²~2.84 Msun; other angles are indicative.',
        a: star({
          tag: 'a', zh: '织女二 ε1 A', en: 'Epsilon1 Lyrae A', spectral: 'A8V',
          typeZh: '白色主序星', typeEn: 'White main-sequence star',
          mass: 1.50, radius: 1.6, color: BLUE,
        }),
        b: star({
          tag: 'b', zh: '织女二 ε1 B', en: 'Epsilon1 Lyrae B', spectral: 'F1V',
          typeZh: '黄白主序星', typeEn: 'Yellow-white main-sequence star',
          mass: 1.34, radius: 1.4, color: WHITE,
        }),
      }),
      b: pair({
        tag: 'e2', zh: '内层：ε2（织女二南对）', en: 'Inner: eps2 (southern pair)',
        aAu: 110, e: 0.30, periodDays: years(600),
        inc: 55, node: 90, argPeri: 0, epochYear: 2000,
        quality: 'derived',
        sourceZh: 'Wikipedia 织女二条目：ε2 两星相距约 2.2″(≈110 AU @50 pc)，周期可能约为 ε1 的一半（≈600 年）。质量取 1.85 / 1.85 M☉ 使 a³/P²≈3.70 M☉ 自洽；e / i / Ω / ω / T0 为示意起点。',
        sourceEn: 'Epsilon Lyrae article: eps2 components are ~2.2" (~110 AU at 50 pc) apart with a period perhaps half that of eps1 (~600 yr). Masses 1.85 / 1.85 Msun keep a³/P²~3.70 Msun; other angles are indicative.',
        a: star({
          tag: 'a', zh: '织女二 ε2 A', en: 'Epsilon2 Lyrae A', spectral: 'A8V',
          typeZh: '白色主序星', typeEn: 'White main-sequence star',
          mass: 1.85, radius: 1.9, color: BLUE,
        }),
        b: star({
          tag: 'b', zh: '织女二 ε2 B', en: 'Epsilon2 Lyrae B', spectral: 'A8V',
          typeZh: '白色主序星', typeEn: 'White main-sequence star',
          mass: 1.85, radius: 1.9, color: BLUE,
        }),
      }),
    }),
    briefZh: '**四合星「双双星」**：ε1 与 ε2 各自都是一对双星（内层约 160 / 110 天文单位、周期约 1200 / 600 年），两对质心再相隔至少 0.16 光年互绕。四颗星同屏，各自按本层轨道运动。1985 年斑纹干涉还发现第 5 颗候选伴星，但轨道未定，故不画。',
    briefEn: '**Quadruple "Double Double"**: eps1 and eps2 are each a binary (~160 / 110 AU, ~1,200 / 600 yr), and the two pair barycentres orbit each other at least 0.16 ly apart. All four stars are drawn. A fifth candidate companion found in 1985 has no orbit and is omitted.',
    sourceZh: 'Wikipedia 织女二条目；内层质量与外层周期由开普勒第三定律自洽反算。',
    sourceEn: 'Epsilon Lyrae article; inner masses and the outer period are recomputed from Kepler\'s third law.',
    bodies: ['epsilon_lyrae_a1', 'epsilon_lyrae_a2', 'epsilon_lyrae_b1', 'epsilon_lyrae_b2'],
  },
];

/** 递归求一个节点（star 或 pair）的总质量，供外层质心分解使用。 */
export function nodeMass(node) {
  return node.kind === 'pair'
    ? nodeMass(node.a) + nodeMass(node.b)
    : node.mass;
}

/** 系统主色：取树里第一颗恒星的颜色，供层级地图结点使用。 */
export function systemColor(s) {
  const find = (n) => (n.kind === 'pair' ? find(n.a) : n.color);
  return find(s.tree);
}

/** 递归统计真实恒星数（不含质心点与行星）。 */
export function countStars(node) {
  return node.kind === 'pair'
    ? countStars(node.a) + countStars(node.b)
    : 1;
}

/** 递归遍历所有 pair，回调 (pair, depth, path)。 */
export function walkPairs(node, cb, depth = 0, path = []) {
  if (node.kind !== 'pair') return;
  cb(node, depth, path);
  walkPairs(node.a, cb, depth + 1, [...path, 'a']);
  walkPairs(node.b, cb, depth + 1, [...path, 'b']);
}

/** 银河系页天体 ID → 可下钻的恒星系统节点 ID */
export const SYSTEM_BY_BODY = new Map();
for (const s of STELLAR_SYSTEMS) {
  for (const id of s.bodies ?? []) SYSTEM_BY_BODY.set(id, s);
}

/** 宇宙层级节点 ID → 系统配置 */
export const SYSTEM_BY_NODE = new Map(STELLAR_SYSTEMS.map((s) => [s.nodeId, s]));

export const isStellarSystemNode = (nodeId) => SYSTEM_BY_NODE.has(nodeId);

/** 系统真实跨度（根层轨道远星距）换算成光年，作为层级节点尺度 */
export function systemSpanLy(s) {
  const root = s.tree;
  const farAu = Math.max(
    root.aAu * (1 + root.e),
    ...(s.extras ?? []).map((x) => x.aAu * (1 + x.e)),
  );
  return Math.max(1e-9, 2 * farAu * AU_IN_LY * 1.35);
}

export default STELLAR_SYSTEMS;
