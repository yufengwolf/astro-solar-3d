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
  camera: { position: [-0.83, 0.55, 0.06], target: [0, 0, 0] },
  scale: {
    radiusRef: 'earth',
    radiusRefUnits: 6.4,
    radiusPower: 0.35,
    distanceMode: 'power',
    distancePower: 0.45,
    maxDistance: 520, // 再小的话金星(85.9)与地球(99.4)的轨道间距会小于两者半径之和
    sunUnits: 26,
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
  ],
};
