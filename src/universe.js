/**
 * 宇宙层级注册表 —— 全站导航的唯一真相源。
 *
 * 以前每个页面各自硬编码 parentSystem / zoomOutTo / childSystem，
 * 于是「太阳系是出发点、只能往里钻」成了结构性的天花板：
 * 想在太阳系回到银河系只能靠滚轮缩到边界，想再加一层星系团、宇宙，
 * 就得同时改一串互不相关的文件。
 *
 * 现在改成一棵数据驱动的树：
 *   节点 = 一个可到达的尺度层级，带中英名、页面、尺度、在父级里的位置、简介。
 *   新增星系 / 上级结构 = 往 NODES 里加一行（必要时把它的 url 从
 *   `cosmos.html?node=xxx` 换成新的专用页面），导航条、面包屑、宇宙地图、
 *   滚轮上浮边界、首页层级路线图全部自动跟着变。
 *
 * 约定：
 *  - `parent` 为空即根节点；`children` 不写在节点里，由 parent 反推，
 *    这样永远不会出现父子不一致。
 *  - 每一层的「观察原点」= `focus` 指向的子节点（也就是"我们所在的那条链"）：
 *    宇宙→拉尼亚凯亚→室女座→本星系群→银河系→太阳系。该子节点 dLy = 0，
 *    其余成员的 dLy 是到这个原点的真实距离（光年），菜单里直接可读。
 *  - `pos` 是该节点在**父级页面**里的场景坐标（约 ±10，定性示意，不按比例），
 *    `spanLy` 是该层全景档的视野跨度（光年），必须小于父层。
 *  - `dLy` 同时被 main.js 的比例尺档位过滤复用；`detail` 只表示页面细化程度，
 *    不影响可达性 —— 所有节点都能打开，将来替换成专用页只改 url。
 */

import { STELLAR_SYSTEMS, systemSpanLy, systemColor } from './data/stellar-orbits.js';
import { lgById } from './data/galaxies.js';

// 本星系群成员的 pos = 它们在「本星系群页」里的场景坐标，直接取自真实星表
// （lgById(id).pos 由赤经赤纬+真实距离算出），不再手写定性数值。
const lgPos = (id) => lgById(id).pos;

export const ROOT_ID = 'universe';

/** 层级类型名（中英），用于宇宙地图里的类型标注 */
export const LEVELS = {
  universe: ['宇宙', 'Universe'],
  supercluster: ['超星系团', 'Supercluster'],
  cluster: ['星系团', 'Galaxy cluster'],
  group: ['星系群', 'Galaxy group'],
  galaxy: ['星系', 'Galaxy'],
  system: ['恒星 / 行星系统', 'Star / planetary system'],
};

/** 页面细化程度 */
export const DETAILS = {
  full: ['完整三维', 'Full 3D'],
  generic: ['层级总览', 'Level overview'],
  portrait: ['形态示意', 'Morphology sketch'],
  planned: ['待细化', 'Placeholder'],
};

const N = (o) => o;

/**
 * 全部节点。顺序即宇宙地图里同层的显示顺序。
 * 距离/尺度取公开天文数据的常用近似值，属科普量级；pos 为定性示意。
 */
export const NODES = [
  N({
    id: 'universe', parent: null, kind: 'universe', detail: 'generic',
    zh: '可观测宇宙', en: 'Observable Universe',
    url: 'cosmos.html?node=universe', spanLy: 9.3e10, dLy: 0, pos: [0, 0, 0],
    focus: 'laniakea', color: 0xa9c4ff, accent: '#8fa8ff', seed: 93001,
    scaleZh: '直径约 930 亿光年', scaleEn: '~93 billion light-years across',
    briefZh: '一个以我们（地球）为中心、半径约 465 亿光年的球体——所有我们能看到的光都来自这个球内，边界之外光还没来得及到达我们。球内的物质并不均匀，而是聚成纤维、片状结构和巨大空洞，这张网叫「宇宙大尺度结构」，星系团与超星系团在其中按真实位置分布。',
    briefEn: 'A sphere centred on us, with a radius of about 46.5 billion light-years — everything we can see lies inside it; beyond the boundary, light has not yet had time to reach us. Within the sphere, matter gathers into filaments, sheets and vast voids — the cosmic web — with galaxy clusters and superclusters placed at their true positions.',
  }),

  // ---- 宇宙层：拉尼亚凯亚之外的其它超星系团（同级，未来可继续补） ----
  N({
    id: 'laniakea', parent: 'universe', kind: 'supercluster', detail: 'generic',
    zh: '拉尼亚凯亚超星系团', en: 'Laniakea Supercluster',
    url: 'cosmos.html?node=laniakea', spanLy: 5.2e8, dLy: 0, pos: [0, 0, 0],
    focus: 'virgo', color: 0x9fd8ff, accent: '#79b8ff', seed: 52002,
    scaleZh: '直径约 5.2 亿光年', scaleEn: '~520 million light-years across',
    briefZh: '2014 年按星系运动轨迹划定的我们的超星系团，夏威夷语意为「无尽的天堂」。包含约 10 万个星系，引力汇聚方向指向「巨引源」。',
    briefEn: 'Our home supercluster, defined in 2014 by galaxy flow patterns. About 100,000 galaxies; their motions converge toward the Great Attractor.',
  }),
  N({
    id: 'perseuspisces', parent: 'universe', kind: 'supercluster', detail: 'planned',
    zh: '英仙－双鱼超星系团', en: 'Perseus–Pisces Supercluster',
    url: 'cosmos.html?node=perseuspisces', spanLy: 3e8, dLy: 2.5e8, pos: [-8.5, 1.2, -3.4],
    color: 0xc0b0ff, accent: '#a893f0', seed: 25003,
    scaleZh: '直径约 3 亿光年', scaleEn: '~300 million light-years across',
    briefZh: '邻近的一条巨大星系链，是宇宙网中一段清晰的纤维，与拉尼亚凯亚相邻。',
    briefEn: 'A neighbouring chain of galaxies forming one of the clearest nearby cosmic-web filaments.',
  }),
  N({
    id: 'coma', parent: 'universe', kind: 'supercluster', detail: 'planned',
    zh: '后发座超星系团', en: 'Coma Supercluster',
    url: 'cosmos.html?node=coma', spanLy: 3e8, dLy: 3.0e8, pos: [7.6, -1.4, -6.2],
    color: 0xa8c0ff, accent: '#8ba6f0', seed: 30004,
    scaleZh: '直径约 3 亿光年', scaleEn: '~300 million light-years across',
    briefZh: '富含星系团的近邻超星系团，中心是著名的后发座星系团。',
    briefEn: 'A nearby supercluster rich in galaxy clusters, centred on the famous Coma Cluster.',
  }),
  N({
    id: 'shapley', parent: 'universe', kind: 'supercluster', detail: 'planned',
    zh: '夏普力超星系团', en: 'Shapley Supercluster',
    url: 'cosmos.html?node=shapley', spanLy: 5e8, dLy: 6.5e8, pos: [4.2, 2.6, 8.4],
    color: 0xffc8a0, accent: '#e0a070', seed: 65005,
    scaleZh: '直径约 5 亿光年', scaleEn: '~500 million light-years across',
    briefZh: '已知最致密的近邻超星系团之一，质量巨大，是本星系群运动的重要引力来源。',
    briefEn: 'One of the densest nearby superclusters; its mass contributes significantly to the motion of our Local Group.',
  }),
  N({
    id: 'hercules', parent: 'universe', kind: 'supercluster', detail: 'planned',
    zh: '武仙座超星系团', en: 'Hercules Supercluster',
    url: 'cosmos.html?node=hercules', spanLy: 3.3e8, dLy: 5.0e8, pos: [-6.8, -2.2, 7.1],
    color: 0xb8d8c0, accent: '#8fc0a0', seed: 50006,
    scaleZh: '直径约 3.3 亿光年', scaleEn: '~330 million light-years across',
    briefZh: '宇宙网中另一处高密度结点，与夏普力超星系团同属近邻大尺度结构。',
    briefEn: 'Another dense node of the nearby cosmic web, alongside the Shapley concentration.',
  }),

  // ---- 拉尼亚凯亚层 ----
  N({
    id: 'virgo', parent: 'laniakea', kind: 'supercluster', detail: 'generic',
    zh: '室女座超星系团', en: 'Virgo Supercluster',
    url: 'cosmos.html?node=virgo', spanLy: 1.1e8, dLy: 0, pos: [0, 0, 0],
    focus: 'localgroup', color: 0x9fe0ff, accent: '#6fc4f0', seed: 11007,
    scaleZh: '直径约 1.1 亿光年', scaleEn: '~110 million light-years across',
    briefZh: '又称本超星系团，拉尼亚凯亚的一部分。中心是室女座星系团，本星系群位于它的外缘。',
    briefEn: 'Also called the Local Supercluster; part of Laniakea. The Virgo Cluster sits at its centre, with our Local Group on the outskirts.',
  }),
  N({
    id: 'hydra', parent: 'laniakea', kind: 'supercluster', detail: 'planned',
    zh: '长蛇－半人马超星系团', en: 'Hydra–Centaurus Supercluster',
    url: 'cosmos.html?node=hydra', spanLy: 1.5e8, dLy: 1.5e8, pos: [7.4, 0.8, 1.6],
    color: 0xffb9a0, accent: '#e08c70', seed: 15008,
    scaleZh: '直径约 1.5 亿光年', scaleEn: '~150 million light-years across',
    briefZh: '拉尼亚凯亚内最显著的另一条纤维，「巨引源」就在这个方向。',
    briefEn: 'The other prominent filament inside Laniakea; the Great Attractor lies in this direction.',
  }),
  N({
    id: 'norma', parent: 'laniakea', kind: 'supercluster', detail: 'planned',
    zh: '矩尺座超星系团', en: 'Norma Supercluster',
    url: 'cosmos.html?node=norma', spanLy: 1.2e8, dLy: 2.0e8, pos: [5.6, -1.8, 6.8],
    color: 0xffd39a, accent: '#e0b060', seed: 20009,
    scaleZh: '直径约 1.2 亿光年', scaleEn: '~120 million light-years across',
    briefZh: '靠近银河系隐带的富星系团集合，中心是矩尺座星系团（阿贝尔 3627）。',
    briefEn: 'A rich concentration near the Galactic plane, centred on the Norma Cluster (Abell 3627).',
  }),
  N({
    id: 'pavoindus', parent: 'laniakea', kind: 'supercluster', detail: 'planned',
    zh: '孔雀－印第安超星系团', en: 'Pavo–Indus Supercluster',
    url: 'cosmos.html?node=pavoindus', spanLy: 1.0e8, dLy: 1.8e8, pos: [-7.0, 1.6, 5.4],
    color: 0xc7b6ff, accent: '#a48ce0', seed: 18010,
    scaleZh: '直径约 1 亿光年', scaleEn: '~100 million light-years across',
    briefZh: '拉尼亚凯亚边缘的一条星系纤维，与长蛇－半人马结构相连。',
    briefEn: 'A galaxy filament on the outskirts of Laniakea, connected to the Hydra–Centaurus structure.',
  }),

  // ---- 室女座超星系团层 ----
  N({
    id: 'localgroup', parent: 'virgo', kind: 'group', detail: 'generic',
    zh: '本星系群', en: 'Local Group',
    url: 'cosmos.html?node=localgroup', spanLy: 1.0e7, dLy: 0, pos: [0, 0, 0],
    focus: 'milkyway', color: 0xffe6a8, accent: '#ffd76b', seed: 10011,
    scaleZh: '直径约 1000 万光年', scaleEn: '~10 million light-years across',
    briefZh: '银河系所在的星系群，约 80 个星系。质量由银河系与仙女座星系主导，两者正以每秒约 110 公里相互靠近。',
    briefEn: 'The galaxy group containing the Milky Way: about 80 galaxies, dominated by the Milky Way and Andromeda, which are approaching at ~110 km/s.',
  }),
  N({
    id: 'virgocluster', parent: 'virgo', kind: 'cluster', detail: 'planned',
    zh: '室女座星系团', en: 'Virgo Cluster',
    url: 'cosmos.html?node=virgocluster', spanLy: 1.5e7, dLy: 5.4e7, pos: [-5.2, 0.9, -3.0],
    color: 0xffd0b0, accent: '#e8a878', seed: 54012,
    scaleZh: '直径约 1500 万光年', scaleEn: '~15 million light-years across',
    briefZh: '离我们最近的富星系团，含上千个星系，其引力正把本星系群往里拉。',
    briefEn: 'The nearest rich galaxy cluster, with over a thousand galaxies; its gravity pulls the Local Group inward.',
  }),
  N({
    id: 'fornax', parent: 'virgo', kind: 'cluster', detail: 'planned',
    zh: '天炉座星系团', en: 'Fornax Cluster',
    url: 'cosmos.html?node=fornax', spanLy: 6e6, dLy: 6.0e7, pos: [6.4, -0.7, -2.4],
    color: 0xb9d8b0, accent: '#8fc088', seed: 60013,
    scaleZh: '直径约 600 万光年', scaleEn: '~6 million light-years across',
    briefZh: '南天较近的贫星系团，比室女座星系团小得多但结构清楚。',
    briefEn: 'A poorer but well-resolved nearby cluster in the southern sky, much smaller than Virgo.',
  }),
  N({
    id: 'eridanus', parent: 'virgo', kind: 'cluster', detail: 'planned',
    zh: '波江座星系团', en: 'Eridanus Cluster',
    url: 'cosmos.html?node=eridanus', spanLy: 5e6, dLy: 7.0e7, pos: [3.4, 1.8, 6.6],
    color: 0xa8c8e0, accent: '#7fa8c8', seed: 70014,
    scaleZh: '直径约 500 万光年', scaleEn: '~5 million light-years across',
    briefZh: '正在组装中的松散星系团，多个小星系群沿一条纤维排列。',
    briefEn: 'A loose cluster still assembling, with several small galaxy groups strung along a filament.',
  }),
  N({
    id: 'ursamajor', parent: 'virgo', kind: 'cluster', detail: 'planned',
    zh: '大熊座星系团', en: 'Ursa Major Cluster',
    url: 'cosmos.html?node=ursamajor', spanLy: 4e6, dLy: 6.0e7, pos: [-7.2, -1.4, 4.8],
    color: 0xc0b8e8, accent: '#9c92d0', seed: 60015,
    scaleZh: '直径约 400 万光年', scaleEn: '~4 million light-years across',
    briefZh: '疏散、以旋涡星系为主的近邻星系团，密度远低于室女座星系团。',
    briefEn: 'A diffuse nearby cluster dominated by spiral galaxies, far less dense than Virgo.',
  }),

  // ---- 本星系群层 ----
  N({
    id: 'milkyway', parent: 'localgroup', kind: 'galaxy', detail: 'full',
    zh: '银河系', en: 'Milky Way',
    url: 'galaxy.html', spanLy: 1.0e5, dLy: 0, pos: lgPos('milkyway'),
    focus: 'solar', color: 0xfff0c0, accent: '#9b8cff', seed: 10016,
    scaleZh: '直径约 10 万光年', scaleEn: '~100,000 light-years across',
    briefZh: '我们的家园星系，棒旋结构、约 2000 亿颗恒星。太阳位于一条主旋臂上，距银心约 2.7 万光年。',
    briefEn: 'Our home barred spiral, with ~200 billion stars. The Sun sits on a major arm, about 27,000 light-years from the centre.',
  }),
  N({
    id: 'andromeda', parent: 'localgroup', kind: 'galaxy', detail: 'portrait',
    zh: '仙女座星系', en: 'Andromeda Galaxy (M31)',
    url: 'cosmos.html?node=andromeda', spanLy: 2.2e5, dLy: 2.5e6, pos: lgPos('andromeda'),
    color: 0xffd8b0, accent: '#e0a878', seed: 25017,
    scaleZh: '直径约 22 万光年', scaleEn: '~220,000 light-years across',
    briefZh: '本星系群最大的星系，肉眼可见的最远天体。约 45 亿年后将与银河系合并。',
    briefEn: 'The largest galaxy in the Local Group and the most distant object visible to the naked eye. It will merge with the Milky Way in ~4.5 billion years.',
  }),
  N({
    id: 'triangulum', parent: 'localgroup', kind: 'galaxy', detail: 'portrait',
    zh: '三角座星系', en: 'Triangulum Galaxy (M33)',
    url: 'cosmos.html?node=triangulum', spanLy: 6.0e4, dLy: 2.7e6, pos: lgPos('triangulum'),
    color: 0xa8c8ff, accent: '#7fa0e0', seed: 27018,
    scaleZh: '直径约 6 万光年', scaleEn: '~60,000 light-years across',
    briefZh: '本星系群第三大星系，正面朝向我们的旋涡星系，恒星形成活跃。',
    briefEn: 'The third-largest Local Group galaxy, a face-on spiral with active star formation.',
  }),
  N({
    id: 'lmc', parent: 'localgroup', kind: 'galaxy', detail: 'portrait',
    zh: '大麦哲伦云', en: 'Large Magellanic Cloud',
    url: 'cosmos.html?node=lmc', spanLy: 1.4e4, dLy: 1.6e5, pos: lgPos('lmc'),
    color: 0xbfd8ff, accent: '#8fb0e0', seed: 16019,
    scaleZh: '直径约 1.4 万光年', scaleEn: '~14,000 light-years across',
    briefZh: '银河系最大的卫星星系，肉眼可见于南天，内含明亮的蜘蛛星云。',
    briefEn: 'The largest satellite galaxy of the Milky Way, visible in southern skies and home to the bright Tarantula Nebula.',
  }),
  N({
    id: 'smc', parent: 'localgroup', kind: 'galaxy', detail: 'portrait',
    zh: '小麦哲伦云', en: 'Small Magellanic Cloud',
    url: 'cosmos.html?node=smc', spanLy: 7.0e3, dLy: 2.0e5, pos: lgPos('smc'),
    color: 0xc8d8ff, accent: '#9fb0d8', seed: 20020,
    scaleZh: '直径约 7000 光年', scaleEn: '~7,000 light-years across',
    briefZh: '与大麦哲伦云成对，被银河系潮汐拉出一条长长的麦哲伦星流。',
    briefEn: 'Companion to the LMC; Milky Way tides have drawn out the long Magellanic Stream.',
  }),

  // ---- 银河系层 ----
  N({
    id: 'solar', parent: 'milkyway', kind: 'system', detail: 'full',
    zh: '太阳系', en: 'Solar System',
    url: 'solar.html', spanLy: 2, dLy: 0, pos: [-7.73, 0.02, 2.74],
    focus: 'earth-moon', color: 0xffcf4d, accent: '#ffcf4d', seed: 2021,
    scaleZh: '奥尔特云直径约 2 光年', scaleEn: 'Oort cloud ~2 light-years across',
    briefZh: '太阳、八大行星、矮行星、小天体与彗星。这里按 JPL / PDS 真实轨道参数绘制，可继续下钻到各行星的卫星系统。',
    briefEn: 'The Sun, eight planets, dwarf planets, small bodies and comets, drawn from real JPL / PDS orbital elements. Dive further into each moon system.',
  }),

  // ---- 太阳系层：7 个已有的行星/卫星系统页面 ----
  N({
    id: 'earth-moon', parent: 'solar', kind: 'system', detail: 'full',
    zh: '地月系统', en: 'Earth–Moon System',
    url: 'earth-moon.html', spanLy: 4e-8, dLy: 4e-8, pos: [0.4, 0, 0],
    color: 0x6db4ff, accent: '#5aa9ff', seed: 101,
    scaleZh: '地月距离约 38 万公里', scaleEn: 'Earth–Moon distance ~384,000 km',
    briefZh: '地球只自转，月球公转并始终以同一面朝向地球（潮汐锁定）。',
    briefEn: 'Earth spins in place while the Moon orbits, always showing the same face (tidal locking).',
  }),
  N({
    id: 'mars', parent: 'solar', kind: 'system', detail: 'full',
    zh: '火星系统', en: 'Mars System',
    url: 'mars.html', spanLy: 1e-8, dLy: 2e-8, pos: [0.8, 0, 0],
    color: 0xe2683c, accent: '#e2683c', seed: 102,
    scaleZh: '火卫二轨道半径约 2.3 万公里', scaleEn: 'Deimos orbit ~23,000 km',
    briefZh: '火星与火卫一、火卫两颗小卫星，轨道按真实比例呈现。',
    briefEn: 'Mars with its two small moons, Phobos and Deimos, at true relative orbital scale.',
  }),
  N({
    id: 'jupiter', parent: 'solar', kind: 'system', detail: 'full',
    zh: '木星系统', en: 'Jupiter System',
    url: 'jupiter.html', spanLy: 6e-7, dLy: 5e-7, pos: [1.4, 0, 0],
    color: 0xd8a878, accent: '#d8a878', seed: 103,
    scaleZh: '最远不规则卫星约 3000 万公里', scaleEn: 'Outermost irregulars ~30 million km',
    briefZh: '17 颗卫星：内卫星、伽利略四卫与远距逆行不规则卫星。',
    briefEn: '17 moons: inner group, the four Galilean moons and distant retrograde irregulars.',
  }),
  N({
    id: 'saturn', parent: 'solar', kind: 'system', detail: 'full',
    zh: '土星系统', en: 'Saturn System',
    url: 'saturn.html', spanLy: 1.2e-6, dLy: 1e-6, pos: [1.9, 0, 0],
    color: 0xe6c25a, accent: '#e6c25a', seed: 104,
    scaleZh: '土卫九轨道半径约 1300 万公里', scaleEn: 'Phoebe orbit ~13 million km',
    briefZh: '壮观光环与 16 颗卫星，含共轨卫星、特洛伊卫星与逆行的土卫九。',
    briefEn: 'Spectacular rings and 16 moons, including co-orbitals, trojans and retrograde Phoebe.',
  }),
  N({
    id: 'uranus', parent: 'solar', kind: 'system', detail: 'full',
    zh: '天王星系统', en: 'Uranus System',
    url: 'uranus.html', spanLy: 1e-6, dLy: 8e-7, pos: [2.4, 0, 0],
    color: 0x7fe3e0, accent: '#7fe3e0', seed: 105,
    scaleZh: '最远卫星约 2000 万公里', scaleEn: 'Outermost moon ~20 million km',
    briefZh: '轴倾角 97.77°，几乎「躺着」自转，15 颗卫星随之竖立。',
    briefEn: 'Axial tilt 97.77° — spinning on its side, with 15 moons standing upright alongside.',
  }),
  N({
    id: 'neptune', parent: 'solar', kind: 'system', detail: 'full',
    zh: '海王星系统', en: 'Neptune System',
    url: 'neptune.html', spanLy: 1.5e-6, dLy: 1.3e-6, pos: [2.9, 0, 0],
    color: 0x5a7bff, accent: '#5a7bff', seed: 106,
    scaleZh: '海卫二远日点约 970 万公里', scaleEn: 'Nereid apocentre ~9.7 million km',
    briefZh: '14 颗卫星：逆行的海卫一、高偏心率的海卫二与远距不规则卫星。',
    briefEn: '14 moons: retrograde Triton, highly eccentric Nereid and distant irregulars.',
  }),
  N({
    id: 'pluto', parent: 'solar', kind: 'system', detail: 'full',
    zh: '冥王星系统', en: 'Pluto System',
    url: 'pluto.html', spanLy: 7e-8, dLy: 6e-8, pos: [3.4, 0, 0],
    color: 0xb9a98f, accent: '#b9a98f', seed: 107,
    scaleZh: '卡戎轨道半径约 2 万公里', scaleEn: 'Charon orbit ~20,000 km',
    briefZh: '冥王星与卡戎构成双矮行星系统，质心在冥王星之外，另有 4 颗小卫星近共振运行。',
    briefEn: 'Pluto and Charon form a double dwarf system with the barycenter outside Pluto, plus four small moons in near resonance.',
  }),

  // ---- 银河系层：AU 级恒星系统（按真实层级逐层互绕） ----
  // 这些不是「我们所在的那条链」上的节点，而是银河系页里点开某颗恒星后的
  // 侧枝下钻。画面仍复用 cosmos.html，但由 makeStellarSystem() 展开层级轨道树：
  // 三合 / 四合 / 六合星的每一层都按自己的真实六根数绕本层质心互绕。
  // 新增系统只需在 src/data/stellar-orbits.js 里加一项，这里与深链清单自动跟着变。
  ...STELLAR_SYSTEMS.map((s, i) => {
    const ang = (i / STELLAR_SYSTEMS.length) * Math.PI * 2 + 0.4;
    const r = 7.4 + (i % 3) * 1.1;
    const rootA = s.tree.aAu;
    const a = rootA < 1 ? rootA.toFixed(4) : rootA.toFixed(1);
    const color = systemColor(s);
    return N({
      id: s.nodeId, parent: 'milkyway', kind: 'system', detail: 'full',
      zh: s.zh, en: s.en,
      url: `cosmos.html?node=${s.nodeId}`,
      spanLy: systemSpanLy(s), dLy: s.distanceLy,
      pos: [Math.cos(ang) * r, ((i % 3) - 1) * 0.7, Math.sin(ang) * r],
      color, accent: `#${color.toString(16).padStart(6, '0')}`,
      seed: 31000 + i,
      scaleZh: `轨道半长轴约 ${a} 天文单位`,
      scaleEn: `Orbit semi-major axis ~${a} AU`,
      briefZh: s.briefZh,
      briefEn: s.briefEn,
    });
  }),
];

// ---------- 索引 ----------
const BY_ID = new Map(NODES.map((n) => [n.id, n]));
const CHILDREN = new Map();
for (const n of NODES) {
  if (!CHILDREN.has(n.parent)) CHILDREN.set(n.parent, []);
  CHILDREN.get(n.parent).push(n);
}
const BY_PAGE = new Map();
for (const n of NODES) {
  if (!n.url.startsWith('cosmos.html')) {
    BY_PAGE.set(n.url.split('?')[0], n);
  }
}

export const byId = (id) => BY_ID.get(id) ?? null;
export const allNodes = () => NODES.slice();
export const parentOf = (id) => {
  const n = byId(id);
  return n?.parent ? byId(n.parent) : null;
};
export const childrenOf = (id) => (CHILDREN.get(id) ?? []).slice();
export const siblingsOf = (id) => {
  const n = byId(id);
  if (!n) return [];
  return childrenOf(n.parent).filter((x) => x.id !== id);
};
/** 从根到自身的完整链路（面包屑用） */
export function chainOf(id) {
  const out = [];
  let cur = byId(id);
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parent ? byId(cur.parent) : null;
  }
  return out;
}
export const ancestorsOf = (id) => chainOf(id).slice(0, -1);
export const depthOf = (id) => chainOf(id).length - 1;

/** 当前语言：注册表本身不 import i18n，避免校验脚本在 Node 里依赖 DOM */
function langNow() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'zh') return q;
    if (localStorage.getItem('astro-lang') === 'en') return 'en';
  } catch { /* Node 或无 localStorage */ }
  return 'zh';
}

export const isEnglish = () => langNow() === 'en';
export const label = (node) => (node ? (isEnglish() ? node.en : node.zh) : '');
export const levelName = (kind) => {
  const p = LEVELS[kind] ?? ['层级', 'Level'];
  return isEnglish() ? p[1] : p[0];
};
export const detailName = (detail) => {
  const p = DETAILS[detail] ?? ['', ''];
  return isEnglish() ? p[1] : p[0];
};

/** 生成站内相对链接，自动保留 ?lang=en，保证切换语言不丢位置 */
export function href(nodeOrId, extra = {}) {
  const n = typeof nodeOrId === 'string' ? byId(nodeOrId) : nodeOrId;
  if (!n || !n.url) return null;
  const [file, qs] = n.url.split('?');
  const p = new URLSearchParams(qs ?? '');
  for (const [k, v] of Object.entries(extra)) if (v != null) p.set(k, String(v));
  if (langNow() === 'en') p.set('lang', 'en');
  else p.delete('lang');
  const q = p.toString();
  return file + (q ? '?' + q : '');
}

/** 由当前 URL 反查所在节点；首页 / 未知页面返回 null */
export function resolveCurrentId(search = '', pathname = '') {
  try {
    if (!pathname) pathname = location.pathname;
    if (!search) search = location.search;
  } catch { /* Node 下由调用方传入 */ }
  let file = pathname.split('/').pop() || 'index.html';
  // /solar?body=earth 这类无扩展名外链同样要能反查到层级节点
  if (!file.includes('.')) file += '.html';
  if (file === 'cosmos.html') {
    const id = new URLSearchParams(search).get('node');
    return id && byId(id) ? id : ROOT_ID;
  }
  return BY_PAGE.get(file)?.id ?? null;
}

/** 最内档继续放大 / 「下一级」按钮的目标：优先完整三维页，其次任意子节点 */
export function focusChildOf(id) {
  const kids = childrenOf(id);
  return kids.find((k) => k.id === byId(id)?.focus)
    ?? kids.find((k) => k.detail === 'full')
    ?? kids[0]
    ?? null;
}
export const childHref = (id) => href(focusChildOf(id));
export const parentHref = (id) => {
  const p = parentOf(id);
  return p ? href(p) : null;
};

/**
 * 成员在父级全景里的「示意点尺寸」——宇宙层级唯一的尺度视觉真相源。
 *
 * 真实占比 = 成员直径 / 本层全景跨度。若直接按占比画，拉尼亚凯亚页里
 * 室女座超星系团会占到屏宽的五分之一，看上去像一团星云；但在这个视野里
 * 任何星系 / 星系团本质都只是一个像素级的点。所以用立方根压缩到
 * 0.03~0.14 场景单位（全景档约 1.5~6 px）：既保留「仙女座 > 银河系 >
 * 三角座 > 麦哲伦云」这类相对大小顺序与颜色差异，又保证一律只是点。
 *
 * @returns {{size:number, glowSize:number, starBoost:number, weight:number}}
 */
export function anchorPointSize(member, parentSpanLy) {
  const ratio = Math.max(1e-12, Math.min(1, (member.spanLy ?? 1) / parentSpanLy));
  const t = Math.cbrt(ratio);
  const size = 0.032 + 0.105 * t;
  return {
    size,
    // applyScale() 会重写 def.size；只有 def.fixedSize 存在时才会原样保留。
    // 少了它，每个星系都会被兜成 6.4 场景单位的大白球（见 check-universe 断言）。
    fixedSize: size,
    glowSize: size * 2.3 + 0.075,   // 柔光只比核心略大，绝不膨胀成球
    starBoost: 1.2 + 0.6 * t,       // 大结构稍亮，小的更暗弱
    weight: t,
  };
}

/** 地图用的树（根 → 叶子），只包含真实父子关系 */
export function tree() {
  const build = (id) => {
    const n = byId(id);
    if (!n) return null;
    return { node: n, children: childrenOf(id).map((c) => build(c.id)).filter(Boolean) };
  };
  return childrenOf(null).map((c) => build(c.id));
}
