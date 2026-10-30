import * as THREE from 'three';
import sunTexture from '/images/sun.jpg';
import mercuryTexture from '/images/mercurymap.jpg';
import mercuryBump from '/images/mercurybump.jpg';
import venusTexture from '/images/venusmap.jpg';
import venusBump from '/images/venusbump.jpg';
import venusAtmosphere from '/images/venus_atmosphere.jpg';
import earthDayTexture from '/images/earth_daymap.jpg';
import earthNightTexture from '/images/earth_nightmap.jpg';
import earthAtmosphere from '/images/earth_atmosphere.jpg';
import marsTexture from '/images/marsmap.jpg';
import marsBump from '/images/marsbump.jpg';
import jupiterTexture from '/images/jupiter.jpg';
import saturnTexture from '/images/saturnmap.jpg';
import saturnRing from '/images/saturn_ring.png';
import uranusTexture from '/images/uranus.jpg';
import uranusRing from '/images/uranus_ring.png';
import neptuneTexture from '/images/neptune.jpg';
import plutoTexture from '/images/plutomap.jpg';
import { starfield } from './shared.js';
import { mk } from './mk.js';

// 地球昼夜混合材质（总览里太阳在原点，可算出真实昼夜分界）
const earthMaterial = new THREE.ShaderMaterial({
  uniforms: {
    dayTexture: { type: 't', value: new THREE.TextureLoader().load(earthDayTexture) },
    nightTexture: { type: 't', value: new THREE.TextureLoader().load(earthNightTexture) },
    sunPosition: { type: 'v3', value: new THREE.Vector3(0, 0, 0) },
  },
  vertexShader: `
    varying vec3 vNormal; varying vec2 vUv; varying vec3 vSunDirection;
    uniform vec3 sunPosition;
    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(modelMatrix * vec4(normal, 0.0)).xyz;
      vSunDirection = normalize(sunPosition - worldPosition.xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D dayTexture; uniform sampler2D nightTexture;
    varying vec3 vNormal; varying vec2 vUv; varying vec3 vSunDirection;
    void main() {
      float intensity = max(dot(vNormal, vSunDirection), 0.0);
      vec4 dayColor = texture2D(dayTexture, vUv);
      vec4 nightColor = texture2D(nightTexture, vUv) * 0.2;
      gl_FragColor = mix(nightColor, dayColor, intensity);
    }`,
});

/**
 * 太阳系总览。
 *
 * 尺度说明（重要）：
 * - 轨道距离用幂律压缩 a^0.45：真实 0.39–39.5 AU 跨度太大，线性映射会让
 *   水星贴到太阳上、海王星跑到屏幕外。压缩后仍严格保持"越远越靠外、次序不变"。
 * - 行星半径用 radiusPower 0.35 压缩：真实比例下木星半径（地球的 11 倍）
 *   会直接盖住土星轨道，整张图会糊成一团。压缩后大小次序不变，但都能分辨。
 * - 想看更接近真实的行星/卫星比例，请打开对应的子系统页。
 */
export default {
  id: 'solar',
  label: '太阳系',
  hasSun: true,
  sun: { texture: sunTexture, intensity: 1.9 },
  background: starfield,
  timeScale: 30,
  // position 只作方向用，距离由 fitCamera 按最远轨道（冥王星）自动算出
  camera: { position: [-0.83, 0.55, 0.06], target: [0, 0, 0], frameTo: 'auto' },
  // 分档视角：矮行星把外缘推到阋神星(67.86 AU)。默认停在「含阋神星」一屏看全 13 个天体，
  // 想细看内行星 / 八大行星请切到对应档位，避免一屏塞全部时内四行星显得偏小。
  views: [
    { id: 'inner', label: '内太阳系（至火星）', frameTo: 'mars' },
    { id: 'planets', label: '八大行星区', frameTo: 'neptune' },
    { id: 'kuiper', label: '柯伊伯带（至冥王星）', frameTo: 'pluto' },
    { id: 'all', label: '含阋神星（全部）', frameTo: 'auto' },
  ],
  scale: {
    radiusRef: 'earth',
    radiusRefUnits: 6.4,
    radiusPower: 0.35,
    distanceMode: 'power',
    distancePower: 0.45,
    // 外缘由冥王星(39.48 AU)变成阋神星(67.86 AU)。为让既有行星轨道的屏幕位置完全不变，
    // maxDistance 按同一比例放大：520 ÷ (39.48/67.86)^0.45 ≈ 663
    // 校验：冥王星仍落在 520，火星 120、木星 209、海王星 460 —— 与加矮行星前一致
    maxDistance: 663,
    sunUnits: 26,
    // 彗核真实半径仅 1.8–5.5 km，按 radiusPower 0.35 压缩后不到 1 个场景单位（<1px，根本看不见）。
    // 与卫星同样的处理：给半径下限，让彗核至少与谷神星(2.58)同量级。既有天体最小者是谷神星，不受影响。
    minBodyUnits: 2.5,
    // 近日点下限：太阳球体(26 单位)本身是被夸大的（真实比例下只有约 0.2 单位，小到不可见），
    // 于是哈雷(近日点 0.587 AU → 压缩后约 12 单位)这类高偏心率轨道会"陷进"太阳里。
    // 只收渲染用的偏心率、不动半长轴；真实值保存在 eReal，彗尾活动强度仍按真实日心距计算。
    minPerihelionUnits: 34,
  },
  asteroids: [
    // 主带：火星轨道(120) 与木星轨道(209) 之间
    { path: './asteroids/asteroidPack.glb', count: 900, min: 138, max: 172 },
    // 柯伊伯带：海王星轨道(460) 与冥王星轨道(520) 之间
    { path: './asteroids/asteroidPack.glb', count: 1200, min: 470, max: 500 },
  ],
  bodies: [
    mk('mercury', '水星', {
      texture: mercuryTexture, bump: mercuryBump,
      orbit: { opacity: 0.10, color: 0xbfd4ff },
      info: {
        赤道半径: '2,439.7 km', 轨道半长轴: '0.387 AU', 偏心率: '0.2056',
        轨道倾角: '7.005°（八大行星中最大）', 自转周期: '58.6 天', 公转周期: '87.97 天', 轴倾角: '0.034°',
        简介: '轨道最扁、倾角最大的行星，昼夜温差可达 600℃。',
      },
    }),
    mk('venus', '金星', {
      texture: venusTexture, bump: venusBump, atmosphere: venusAtmosphere,
      atmosphereRotateHours: 96, // 金星大气"超级旋转"，约 4 天绕行一周
      orbit: { opacity: 0.10, color: 0xffd9a0 },
      info: {
        赤道半径: '6,051.8 km', 轨道半长轴: '0.723 AU', 偏心率: '0.0068（最接近正圆）',
        轨道倾角: '3.39°', 自转周期: '243 天（逆向自转）', 公转周期: '224.7 天', 轴倾角: '177.36°',
        简介: '自转方向与公转相反，一天比一年还长。',
      },
    }),
    mk('earth', '地球', {
      texture: earthMaterial, atmosphere: earthAtmosphere,
      atmosphereRotateHours: 25.5, // 略慢于地表自转，云层缓慢漂移
      orbit: { opacity: 0.10, color: 0xa8d8ff },
      info: {
        赤道半径: '6,371 km', 轨道半长轴: '1.000 AU', 偏心率: '0.0167',
        轨道倾角: '0°（黄道面即其轨道面）', 自转周期: '23 小时 56 分', 公转周期: '365.26 天', 轴倾角: '23.44°',
        简介: '轨道偏心导致 1 月初过近日点、7 月初过远日点，但季节主要由轴倾角而非距离决定。',
      },
    }),
    mk('mars', '火星', {
      texture: marsTexture, bump: marsBump,
      orbit: { opacity: 0.10, color: 0xff9b7a },
      info: {
        赤道半径: '3,389.5 km', 轨道半长轴: '1.524 AU', 偏心率: '0.0934',
        轨道倾角: '1.85°', 自转周期: '24 小时 37 分', 公转周期: '686.98 天', 轴倾角: '25.19°',
        简介: '偏心率较大，近日点与远日点接收到的太阳辐射相差约 45%。',
      },
    }),
    mk('ceres', '谷神星', {
      color: 0x9a8f80, // 无贴图：按真实反照率(0.09)调制的灰褐色占位球
      orbit: { opacity: 0.12, color: 0xbfae95 },
      info: {
        赤道半径: '473 km', 轨道半长轴: '2.77 AU', 偏心率: '0.0785',
        轨道倾角: '10.59°', 自转周期: '9.07 小时', 公转周期: '4.60 年',
        分类: '矮行星（主带内唯一）',
        简介: '主带中最大的天体，质量约占主带总质量的四分之一；轨道正好落在主带内(157/663)。黎明号在其表面发现含水矿物与明亮盐斑。',
      },
    }),
    mk('jupiter', '木星', {
      texture: jupiterTexture,
      orbit: { opacity: 0.10, color: 0xffd8b0 },
      info: {
        赤道半径: '69,911 km', 轨道半长轴: '5.203 AU', 偏心率: '0.0489',
        轨道倾角: '1.30°', 自转周期: '9 小时 56 分', 公转周期: '11.86 年', 轴倾角: '3.13°',
        简介: '自转最快的行星，快速自转使它明显呈扁球形。',
      },
    }),
    mk('saturn', '土星', {
      texture: saturnTexture,
      ring: { texture: saturnRing, innerScale: 1.24, outerScale: 2.27 },
      orbit: { opacity: 0.10, color: 0xffe9b8 },
      info: {
        赤道半径: '58,232 km', 轨道半长轴: '9.537 AU', 偏心率: '0.0565',
        轨道倾角: '2.49°', 自转周期: '10 小时 39 分', 公转周期: '29.46 年', 轴倾角: '26.73°',
        简介: '环系宽度约为本体半径的 1.24–2.27 倍，厚度却往往不足百米。',
      },
    }),
    mk('uranus', '天王星', {
      texture: uranusTexture,
      ring: { texture: uranusRing, innerScale: 1.6, outerScale: 2.0 },
      orbit: { opacity: 0.10, color: 0xb8f0ff },
      info: {
        赤道半径: '25,362 km', 轨道半长轴: '19.19 AU', 偏心率: '0.0457',
        轨道倾角: '0.773°', 自转周期: '17 小时 14 分（逆向）', 公转周期: '84.01 年', 轴倾角: '97.77°',
        简介: '轴倾角接近 90°，几乎是躺着绕太阳滚动，环系也因此近乎垂直于轨道面。',
      },
    }),
    mk('neptune', '海王星', {
      texture: neptuneTexture,
      orbit: { opacity: 0.10, color: 0x9fc8ff },
      info: {
        赤道半径: '24,622 km', 轨道半长轴: '30.07 AU', 偏心率: '0.0113',
        轨道倾角: '1.77°', 自转周期: '16 小时 6 分', 公转周期: '164.8 年', 轴倾角: '28.32°',
        简介: '风速可超 2,000 km/h，是太阳系风暴最猛烈之处。',
      },
    }),
    mk('pluto', '冥王星', {
      texture: plutoTexture,
      orbit: { opacity: 0.10, color: 0xd8c8ff },
      info: {
        赤道半径: '1,188.3 km', 轨道半长轴: '39.48 AU', 偏心率: '0.2488',
        轨道倾角: '17.16°（最倾斜的"行星"轨道）', 自转周期: '6.39 天（逆向）', 公转周期: '248 年', 轴倾角: '122.53°',
        简介: '轨道倾角与偏心率都远大于八大行星，正是它被重新归类为矮行星的原因之一。',
      },
    }),
    mk('haumea', '妊神星', {
      color: 0xd8d4cc, // 无贴图：反照率约 0.6–0.8，表面为结晶水冰，中性亮白
      orbit: { opacity: 0.12, color: 0xdcd8d0 },
      info: {
        赤道半径: '约 780 km（长轴约 1,050 km）', 轨道半长轴: '43.12 AU', 偏心率: '0.196',
        轨道倾角: '28.19°', 自转周期: '3.92 小时', 公转周期: '283 年',
        形状: '橄榄球形（自转过快被拉长）',
        简介: '太阳系大型天体中自转最快，快到把自己甩成橄榄球；拥有环系与两颗卫星。',
      },
    }),
    mk('makemake', '鸟神星', {
      color: 0xc08a6e, // 无贴图：表面富甲烷 / 乙烷冰，呈淡红色
      orbit: { opacity: 0.12, color: 0xe0a07a },
      info: {
        赤道半径: '约 715 km', 轨道半长轴: '45.43 AU', 偏心率: '0.161',
        轨道倾角: '28.98°', 自转周期: '22.83 小时', 公转周期: '306 年',
        简介: '表面覆盖甲烷与乙烷冰而显淡红；已知有一颗卫星 S/2015 (136472) 1。',
      },
    }),
    mk('eris', '阋神星', {
      color: 0xe8e6e0, // 无贴图：反照率高达 0.96，太阳系最亮的大型天体之一
      orbit: { opacity: 0.12, color: 0xe8e4dc },
      info: {
        赤道半径: '1,163 km', 轨道半长轴: '67.86 AU', 偏心率: '0.434',
        轨道倾角: '44.04°（总览中最倾斜）', 自转周期: '约 15.8 天（数值存疑）', 公转周期: '559 年',
        质量: '比冥王星大约 27%',
        简介: '已知质量最大的矮行星；轨道又扁又斜，远日点可达 97 AU、近日点仅 38 AU。它是本页外缘(663)，想看全貌请切到「含阋神星」档。',
      },
    }),

    // ---------------- 彗星 ----------------
    // 彗核半径只有几公里，按真实比例压缩后不足 1 单位（见 minSizeUnits）；真正的看点是彗发与彗尾——
    // 它们只在接近太阳时才出现，把「时间流速」拉到 200 天/秒最容易看到彗尾长出来。
    mk('halley', '哈雷彗星 1P', {
      // 彗核：反照率仅约 0.04（比煤还黑），所以颜色极暗、且不受光照（见 bodies.js）。
      // minSizeUnits：不用系统的 minBodyUnits(2.5) 兜底——那会让几 km 的彗核
      // 涨到和谷神星同量级。真实压缩值只有 0.37–0.54 单位，就该小到几乎看不见，
      // 我们看到的"亮"全部来自彗发与彗尾。
      color: 0x1a1712,
      minSizeUnits: 0.35,
      // node = 升交点经度。本模型未建模「近日点幅角」，若不指定 node，
      // 所有彗星的近日点会落在同一方向，活跃彗尾便统统指向同一侧——默认相机在 -X 侧，
      // 尾巴正对镜头会被压缩成一个点。真实彗星各有不同升交点，这里取不同值把近日点错开。
      // M0：初始平近点角，决定"画面一开始各彗星在轨道的哪个位置"。
      // 全部取**真实值**——由 JPL SBDB 的历元平近点角按各自周期统一推进到
      // 1986-02-09（哈雷那次回归的过近日点时刻）得到。这样初始画面里哈雷正值
      // 最活跃（尾长满值 150），其余几颗散在轨道各处、长短不一，既有看点又不糊成一团。
      orbit: { opacity: 0.18, color: 0x8fd8ff, node: 90, M0: 6.2781 },
      // comaRadiusUnits：哈雷是最亮的大彗星，彗发比其它几颗略大（默认 3.6）。
      // 量级对照：太阳 26 / 木星 14.8 / 地球 6.4 —— 彗发必须远小于太阳，只占"扫把头"。
      comet: { onsetAU: 6, ionTailUnits: 150, comaRadiusUnits: 4.6 },
      info: {
        核半径: '约 5.5 km（11×8 km）', 轨道半长轴: '17.83 AU', 偏心率: '0.967（本页最扁）',
        近日点: '0.587 AU（在水星与金星之间）', 远日点: '35.1 AU（海王星轨道之外）',
        轨道倾角: '162.26°（逆行）', 公转周期: '75.3 年',
        看点: '尾巴只在近日点附近长出；远日点它就是一颗又黑又小的核。时间流速调到 200 天/秒，约 2 分钟可看完一圈。',
        简介: '人类首颗算出回归周期的彗星，也是唯一肉眼可定期得见的短周期彗星；上次回归 1986 年，下次 2061 年。',
      },
    }),
    mk('encke', '恩克彗星 2P', {
      color: 0x1a1712,
      minSizeUnits: 0.35,
      orbit: { opacity: 0.16, color: 0x9fe0ff, node: 130, M0: 3.9007 },
      comet: { onsetAU: 3, ionTailUnits: 60 },
      info: {
        核半径: '约 2.4 km', 轨道半长轴: '2.21 AU', 偏心率: '0.848',
        近日点: '0.336 AU（水星轨道之内）', 远日点: '4.09 AU（主带外侧）',
        轨道倾角: '11.78°', 公转周期: '3.30 年（已知最短）',
        简介: '周期最短的彗星，轨道整个落在木星以内；金牛座流星雨的母体。因频繁回归，活动已明显减弱。',
      },
    }),
    mk('tempel1', '坦普尔 1 号彗星 9P', {
      color: 0x1a1712,
      minSizeUnits: 0.35,
      orbit: { opacity: 0.16, color: 0xa8dcff, node: 220, M0: 3.4178 },
      comet: { onsetAU: 3.2, ionTailUnits: 70 },
      info: {
        核半径: '约 2.9 km（7.6×4.9 km）', 轨道半长轴: '3.14 AU', 偏心率: '0.512',
        近日点: '1.53 AU', 远日点: '4.75 AU', 轨道倾角: '10.50°', 公转周期: '5.56 年',
        简介: '2005 年"深度撞击"号发射撞击器砸中其表面，人类第一次直接窥见彗核内部的物质。',
      },
    }),
    mk('churyumov', '67P 丘留莫夫-格拉西缅科', {
      color: 0x1a1712,
      minSizeUnits: 0.35,
      orbit: { opacity: 0.16, color: 0xa8dcff, node: 40, M0: 2.6011 },
      comet: { onsetAU: 3, ionTailUnits: 80 },
      info: {
        核半径: '约 2.1 km（4.3×4.1 km，双瓣状）', 轨道半长轴: '3.46 AU', 偏心率: '0.641',
        近日点: '1.24 AU', 远日点: '5.67 AU', 轨道倾角: '7.04°', 公转周期: '6.44 年',
        简介: '罗塞塔号 2014 年环绕探测并投放"菲莱"着陆器，首个被人类长期近距离伴飞的彗核；外形像一只橡皮鸭。',
      },
    }),
    mk('tempelTuttle', '坦普尔-塔特尔彗星 55P', {
      color: 0x1a1712,
      minSizeUnits: 0.35,
      orbit: { opacity: 0.16, color: 0xb0c8ff, node: 270, M0: 3.9970 },
      comet: { onsetAU: 4, ionTailUnits: 130 },
      info: {
        核半径: '约 1.8 km', 轨道半长轴: '10.34 AU', 偏心率: '0.906',
        近日点: '0.98 AU（几乎与地球轨道相交）', 远日点: '19.70 AU（天王星轨道附近）',
        轨道倾角: '162.49°（逆行）', 公转周期: '33.2 年',
        简介: '狮子座流星雨的母体；每 33 年回归一次时，地球穿过它留下的尘埃带往往引发流星暴。',
      },
    }),
  ],
};
