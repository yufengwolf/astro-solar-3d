/**
 * 界面语言与单位。
 *
 * 原则：默认中文，界面里不出现「ly / kpc」这类读者看不懂的英文缩写；
 * km、AU、M42、X 射线、JPL 等基础常识或天体编号属于专名，中英两版都保留。
 * 切换到英文时，界面文案、单位、比例尺、天体名一起切，不混排。
 *
 * 语言优先级：?lang=en > localStorage > 中文。切换后刷新页面，
 * 所有动态 UI（菜单 / 标签 / 比例尺 / 信息卡 / 控制面板）会按新语言重建。
 */

const STORE_KEY = 'astro-lang';
const CJK = /[\u4e00-\u9fff]/;   // 不带 g：test() 才不会因 lastIndex 累积而误判

function readLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'zh') return q;
    const saved = localStorage.getItem(STORE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch { /* 隐私模式下 localStorage 可能不可用 */ }
  return 'zh';
}

let lang = readLang();

export const isEn = () => lang === 'en';
export const currentLang = () => lang;

export function setLang(v) {
  lang = v === 'en' ? 'en' : 'zh';
  try { localStorage.setItem(STORE_KEY, lang); } catch { /* 忽略 */ }
  // 保留 ?focus= / ?scale= / ?view= 深链，避免切语言时丢失当前位置
  const u = new URL(location.href);
  if (lang === 'en') u.searchParams.set('lang', 'en');
  else u.searchParams.delete('lang');
  location.href = u.toString();
}

// ---------- 界面文案 ----------
const UI = {
  zh: {
    langButton: '英文',
    langTitle: '切换为英文界面',
    timeScale: '时间流速(天/秒)',
    bodyExaggeration: '视觉放大 ×',
    tailGain: '彗尾强度 ×',
    viewRange: '取景范围',
    sunIntensity: '太阳亮度',
    closeGui: '收起控制面板',
    badge: (n) => `视觉放大 ×${n}（仅放大天体尺寸，轨道比例不变）`,
    infoZoom: (n) => `视觉放大: ×${n}（天体尺寸已放大，轨道比例不变）`,
    back: (s) => `← ${s}`,
    childGo: '卫星系',
    childTitle: (s) => `进入${s}`,
    childBtn: (s) => `进入${s} →`,
    nameSun: '太阳',
    scaleLabel: '比例尺 · 一格 = ',
    scaleHint: '滚轮每跨 10× 自动切一档 · 也可直接点击',
    tierTitle: (label) => `切到${label}视野`,
    unitLy: '光年',
    unitKpc: '千秒差距',
  },
  en: {
    langButton: 'Chinese',
    langTitle: 'Switch to Chinese',
    timeScale: 'Time speed (days/s)',
    bodyExaggeration: 'Visual size ×',
    tailGain: 'Comet tail ×',
    viewRange: 'View',
    sunIntensity: 'Sun brightness',
    closeGui: 'Close Controls',
    badge: (n) => `Visual size ×${n} (bodies only; orbit scale unchanged)`,
    infoZoom: (n) => `Visual size: ×${n} (bodies only; orbit scale unchanged)`,
    back: (s) => `← ${s}`,
    childGo: 'Moons',
    childTitle: (s) => `Enter ${s}`,
    childBtn: (s) => `Enter ${s} →`,
    nameSun: 'Sun',
    scaleLabel: 'Scale · one step = ',
    scaleHint: 'Scroll 10× to switch tier · or click a step',
    tierTitle: (label) => `View: ${label}`,
    unitLy: 'ly',
    unitKpc: 'kpc',
  },
};

export function t(key, ...args) {
  const v = UI[lang][key];
  return typeof v === 'function' ? v(...args) : (v ?? key);
}

// ---------- 距离与比例尺 ----------
export function distText(dLy) {
  const num = dLy < 10 ? dLy.toFixed(1) : Math.round(dLy).toLocaleString('en-US');
  return num + (isEn() ? ' ly' : ' 光年');
}

export function tierLabel(tier) {
  if (!isEn()) return tier.label;
  return tier.spanLy.toLocaleString('en-US') + ' ly';
}

export function tierShort(tier) {
  if (!isEn()) return tier.short;
  const n = tier.spanLy;
  return n >= 1000 ? `${n / 1000}k ly` : `${n} ly`;
}

// ---------- 系统 / 分组 / 视角 ----------
const SYSTEM_EN = {
  '太阳系': 'Solar System', '太阳系总览': 'Solar System', '银河系': 'Milky Way',
  '地月系统': 'Earth–Moon System', '火星系统': 'Mars System', '木星系统': 'Jupiter System',
  '土星系统': 'Saturn System', '天王星系统': 'Uranus System',
  '海王星系统': 'Neptune System', '冥王星系统': 'Pluto System',
  '卫星系': 'Moons', '卫星系统': 'Moon system',
};
const GROUP_EN = {
  '定位锚点': 'Anchors', '星云与遗迹': 'Nebulae & Remnants',
  '致密天体': 'Compact Objects', '球状星团': 'Globular Clusters',
  '邻近恒星': 'Nearby Stars', '疏散星团': 'Open Clusters',
  '系外行星系统': 'Exoplanet Systems',
};
const VIEW_EN = {
  '内卫星': 'Inner moons', '伽利略卫星': 'Galilean moons',
  '+希玛利亚群': '+ Himalia group', '+远距不规则卫星': '+ Distant irregulars',
  '海卫一': 'Triton', '内层小卫星': 'Inner small moons', '+不规则卫星': '+ Irregular moons',
  '冥卫一': 'Charon', '五颗卫星全览': 'All five moons',
  '牧羊犬·中层卫星': 'Shepherds & mid moons', '主卫星（至土卫六）': 'Main moons (to Titan)',
  '至土卫八': 'Out to Iapetus', '+逆行的土卫九': '+ Retrograde Phoebe',
  '内太阳系（至火星）': 'Inner system (to Mars)', '八大行星区': 'Eight planets',
  '柯伊伯带（至冥王星）': 'Kuiper belt (to Pluto)', '含阋神星（全部）': 'All (incl. Eris)',
  '五大卫星': 'Five major moons', '不规则·近群': 'Near irregulars',
  '+不规则卫星全览': '+ All irregular moons',
};
const INFO_KEY_EN = {
  '类型': 'Type', '距离': 'Distance', '银道坐标': 'Galactic coordinates', '简介': 'Notes',
  '平均半径': 'Mean radius', '核半径': 'Nucleus radius', '直径': 'Diameter',
  '轨道半长轴': 'Semi-major axis', '偏心率': 'Eccentricity', '轨道倾角': 'Inclination',
  '公转周期': 'Orbital period', '自转周期': 'Rotation period', '质量': 'Mass',
  '位置': 'Position', '视星等': 'Apparent magnitude', '光谱型': 'Spectral type',
  '发现': 'Discovered', '备注': 'Notes', '卫星数': 'Moons',
};

export const systemName = (s) => (isEn() ? (SYSTEM_EN[s] ?? s) : s);
export const groupName = (g) => (isEn() ? (GROUP_EN[g] ?? g) : g);
export const viewName = (v) => (isEn() ? (VIEW_EN[v] ?? v) : v);
export const infoKey = (k) => (isEn() ? (INFO_KEY_EN[k] ?? null) : k);

/** 信息卡的值：中文模式兜底把 kpc/ly 中文化；英文模式把单位英文化，
 *  仍含中文的长描述（简介等）返回 null，由调用方跳过，避免英文界面混中文。 */
export function infoValue(v) {
  let s = String(v);
  if (!isEn()) return s.replace(/kpc/g, t('unitKpc')).replace(/\bly\b/g, t('unitLy'));
  s = s.replace(/约/g, '~').replace(/光年/g, 'ly').replace(/千秒差距/g, 'kpc')
    .replace(/银经/g, 'l').replace(/银纬/g, 'b')
    .replace(/天文单位/g, 'AU').replace(/公里|千米/g, 'km')
    .replace(/（/g, '(').replace(/）/g, ')').replace(/：/g, ': ');
  return CJK.test(s) ? null : s;
}

// ---------- 天体名（英文模式全量覆盖，缺省回退去掉括号的中文名） ----------
const NAME_EN = {
  sun: 'Sun', sagA: 'Sagittarius A*',
  mercury: 'Mercury', venus: 'Venus', earth: 'Earth', moon: 'Moon',
  mars: 'Mars', ceres: 'Ceres', jupiter: 'Jupiter', saturn: 'Saturn',
  uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto',
  haumea: 'Haumea', makemake: 'Makemake', eris: 'Eris',
  halley: '1P/Halley', encke: '2P/Encke', tempel1: '9P/Tempel 1',
  churyumov: '67P/Churyumov–Gerasimenko', tempelTuttle: '55P/Tempel–Tuttle',
  metis: 'Metis', adrastea: 'Adrastea', amalthea: 'Amalthea', thebe: 'Thebe',
  io: 'Io', europa: 'Europa', ganymede: 'Ganymede', callisto: 'Callisto',
  themisto: 'Themisto', leda: 'Leda', himalia: 'Himalia', lysithea: 'Lysithea',
  elara: 'Elara', ananke: 'Ananke', carme: 'Carme', pasiphae: 'Pasiphae', sinope: 'Sinope',
  phobos: 'Phobos', deimos: 'Deimos',
  naiad: 'Naiad', thalassa: 'Thalassa', despina: 'Despina', galatea: 'Galatea',
  larissa: 'Larissa', hippocampus: 'Hippocamp', proteus: 'Proteus', triton: 'Triton',
  nereid: 'Nereid', halimede: 'Halimede', sao: 'Sao', laomedeia: 'Laomedeia',
  psamathe: 'Psamathe', neso: 'Neso',
  charon: 'Charon', styx: 'Styx', nix: 'Nix', kerberos: 'Kerberos', hydra: 'Hydra',
  prometheus: 'Prometheus', pandora: 'Pandora', epimetheus: 'Epimetheus', janus: 'Janus',
  mimas: 'Mimas', enceladus: 'Enceladus', tethys: 'Tethys', telesto: 'Telesto',
  calypso: 'Calypso', dione: 'Dione', helene: 'Helene', rhea: 'Rhea', titan: 'Titan',
  hyperion: 'Hyperion', iapetus: 'Iapetus', phoebe: 'Phoebe',
  puck: 'Puck', miranda: 'Miranda', ariel: 'Ariel', umbriel: 'Umbriel',
  titania: 'Titania', oberon: 'Oberon', francisco: 'Francisco', caliban: 'Caliban',
  stephano: 'Stephano', trinculo: 'Trinculo', sycorax: 'Sycorax', margaret: 'Margaret',
  prospero: 'Prospero', setebos: 'Setebos', ferdinand: 'Ferdinand',
  proxima: 'Proxima Centauri', alphaCen: 'Alpha Centauri', barnard: "Barnard's Star",
  sirius: 'Sirius', procyon: 'Procyon', altair: 'Altair', vega: 'Vega', pollux: 'Pollux',
  arcturus: 'Arcturus', capella: 'Capella', aldebaran: 'Aldebaran', canopus: 'Canopus',
  polaris: 'Polaris', betelgeuse: 'Betelgeuse', antares: 'Antares', rigel: 'Rigel',
  hyades: 'Hyades', pleiades: 'Pleiades (M45)', m7: 'Ptolemy Cluster (M7)',
  m6: 'Butterfly Cluster (M6)', peg51: '51 Pegasi', kepler452: 'Kepler-452',
  m42: 'Orion Nebula (M42)', m8: 'Lagoon Nebula (M8)', m20: 'Trifid Nebula (M20)',
  m16: 'Eagle Nebula (M16)', ngc3372: 'Carina Nebula (NGC 3372)',
  m1: 'Crab Nebula (M1)', cygx1: 'Cygnus X-1', omegaCen: 'Omega Centauri',
  tuc47: '47 Tucanae', m22: 'M22',
};

export function bodyName(def) {
  if (!isEn()) return def.name;
  return NAME_EN[def.id] ?? def.name.replace(/（[^）]*）/g, '').trim();
}
/** 标签里省略括号后缀，菜单保留全名 */
export const shortName = (name) => name.replace(/（[^）]*）/g, '').trim();

// ---------- 首页静态文案 ----------
const HOME = {
  zh: {
    title: '太阳系 3D 交互可视化',
    h1: '太阳系 · 银河系 3D 交互可视化',
    desc: '从行星系统一路放大到银河系。基于 JPL / PDS 真实轨道参数构建，可逐级下钻：太阳系总览 → 行星卫星系统 →（缩到最外圈再往外滚）银河系。每个页面都支持「视觉放大 ×N」、多取景视角切换与全屏。轨道比例真实，天体尺寸可按需放大。',
    footer1: '所有页面：轨道比例真实 · 天体尺寸可「视觉放大 ×N」· 多取景视角 · 支持全屏（移动端自动横屏）',
    footer2: '基于 Three.js · 数据取自 JPL / PDS · MIT 许可',
    go: '进入 →',
    cards: [
      ['恒星与行星', '太阳系总览', '太阳 + 八大行星 + 小行星带 / 柯伊伯带。行星半径与轨道距离经幂律压缩，便于同屏观察（想看近真实比例请进各子系统）。'],
      ['旋臂与星云', '银河系', '放大一级：太阳只是约 2000 亿颗恒星中普通的一颗。旋臂为定性示意；点「太阳」可下钻回太阳系，在太阳系总览缩到最外圈再往外滚则回到这里。'],
      ['潮汐锁定', '地月系统', '地球位于原点只自转，月球公转 + 自转并始终以同一面朝向地球（潮汐锁定）。'],
      ['两颗小卫星', '火星系统', '火星 + 火卫一 / 火卫二（三维模型）。轨道完全按真实比例呈现，卫星本体放大以便观察。'],
      ['伽利略四卫', '木星系统', '17 颗卫星：内卫星、伽利略四卫（木卫一至木卫四）、以及远距不规则逆行卫星。提供 4 档取景预设。'],
      ['壮观环系', '土星系统', '壮观光环 + 16 颗卫星：牧羊犬卫星、共轨的土卫十/十一、特洛伊卫星，以及逆行的土卫九。'],
      ['侧躺自转', '天王星系统', '轴倾角 97.77°，几乎是「躺着」自转，卫星系统随之竖立。15 颗卫星，9 颗里 8 颗逆行。'],
      ['远距卫星', '海王星系统', '14 颗卫星全部呈现：逆行的海卫一、偏心率 0.75 的海卫二，以及远至希尔球边缘的不规则卫星。'],
      ['双矮行星', '冥王星系统', '冥王星 + 卡戎（双矮行星系统，质心在冥王星之外）+ 4 颗小卫星的近共振链。'],
    ],
  },
  en: {
    title: 'Solar System 3D Visualization',
    h1: 'Solar System · Milky Way in 3D',
    desc: 'Zoom out from planetary systems to the galaxy. Built on real JPL / PDS orbital elements, with step-by-step navigation: Solar System → moon systems → (scroll past the outer limit) Milky Way. Every page supports visual size boost, preset views and fullscreen. Orbit scale is true to data; body sizes can be enlarged for visibility.',
    footer1: 'All pages: true orbit scale · adjustable visual size · preset views · fullscreen (auto landscape on mobile)',
    footer2: 'Built with Three.js · data from JPL / PDS · MIT license',
    go: 'Enter →',
    cards: [
      ['Solar System', 'Solar System Overview', 'Sun + eight planets + asteroid / Kuiper belts. Radii and orbit distances use a power-law compression so everything fits on one screen (open a moon system for near-true proportions).'],
      ['Milky Way', 'Milky Way', 'One level out: the Sun is just one of ~200 billion stars. Spiral arms are qualitative. Click the Sun to dive back, or zoom out past the outer limit on the overview page.'],
      ['Earth · Moon', 'Earth–Moon System', 'Earth sits at the origin and only spins; the Moon orbits, spins, and always shows the same face (tidal locking).'],
      ['Mars', 'Mars System', 'Mars + Phobos / Deimos (GLB models). Orbits at true relative scale; moon bodies are enlarged to stay visible.'],
      ['Jupiter', 'Jupiter System', '17 moons: inner group, the four Galilean moons, and distant retrograde irregulars. Four preset views.'],
      ['Saturn', 'Saturn System', 'Spectacular rings + 16 moons: shepherds, co-orbital Janus/Epimetheus, trojans, and retrograde Phoebe.'],
      ['Uranus', 'Uranus System', 'Axial tilt 97.77° — it spins on its side, and the moon system stands upright with it. 15 moons, 8 of 9 inner ones retrograde.'],
      ['Neptune', 'Neptune System', 'All 14 moons: retrograde Triton, eccentric Nereid (e = 0.75), and irregulars out to the Hill sphere.'],
      ['Pluto', 'Pluto System', 'Pluto + Charon (a double dwarf system, barycenter outside Pluto) + four small moons in a near-resonant chain.'],
    ],
  },
};

const PAGE_TITLES = {
  'index.html': ['太阳系 3D 交互可视化', 'Solar System 3D Visualization'],
  'overview.html': ['太阳系总览', 'Solar System Overview'],
  'galaxy.html': ['银河系', 'Milky Way'],
  'earth-moon.html': ['地月系统', 'Earth–Moon System'],
  'mars.html': ['火星系统', 'Mars System'],
  'jupiter.html': ['木星系统', 'Jupiter System'],
  'saturn.html': ['土星系统', 'Saturn System'],
  'uranus.html': ['天王星系统', 'Uranus System'],
  'neptune.html': ['海王星系统', 'Neptune System'],
  'pluto.html': ['冥王星系统', 'Pluto System'],
};

function applyStaticI18n() {
  document.documentElement.lang = isEn() ? 'en' : 'zh-CN';
  const file = location.pathname.split('/').pop() || 'index.html';
  const pt = PAGE_TITLES[file];
  if (pt) document.title = pt[isEn() ? 1 : 0];

  const H = HOME[lang];
  const h1 = document.querySelector('.home-header h1');
  const d = document.querySelector('.home-header p');
  const f = document.querySelector('.home-footer');
  if (h1) h1.textContent = H.h1;
  if (d) d.textContent = H.desc;
  if (f) {
    // 页脚两行用 <br> 分隔，保留结构
    f.innerHTML = '';
    f.append(document.createTextNode(H.footer1), document.createElement('br'),
      document.createTextNode(H.footer2));
  }
  document.querySelectorAll('.home-card').forEach((card, i) => {
    const c = H.cards[i];
    if (!c) return;
    const sub = card.querySelector('.hc-sub');
    const name = card.querySelector('.hc-name');
    const desc = card.querySelector('.hc-desc');
    const go = card.querySelector('.hc-go');
    if (sub) sub.textContent = c[0];
    if (name) name.textContent = c[1];
    if (desc) desc.textContent = c[2];
    if (go) go.textContent = H.go;
  });
}

function mountLangToggle() {
  if (document.getElementById('langToggle')) return;
  const btn = document.createElement('button');
  btn.id = 'langToggle';
  btn.className = 'lang-toggle';
  btn.type = 'button';
  btn.textContent = t('langButton');
  btn.title = t('langTitle');
  btn.setAttribute('aria-label', t('langTitle'));
  btn.onclick = () => setLang(isEn() ? 'zh' : 'en');
  document.body.appendChild(btn);
}

if (typeof document !== 'undefined') {
  const boot = () => { applyStaticI18n(); mountLangToggle(); };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
