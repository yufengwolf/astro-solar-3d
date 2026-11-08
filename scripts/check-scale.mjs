/**
 * 尺度自检（跑的是生产代码，不是副本）：
 *   1. 把 src/systems/*.js 里的图片 import 替换成占位符，生成临时 .mjs 后用 node 直接 import，
 *      因此校验的是**真实配置文件**本身。
 *   2. 调用 src/scale.js 的 applyScale / frameRadius —— 与浏览器运行时同一套换算逻辑。
 *   3. 检查：中心天体误带公转轨道、天体在这个系统的**所有取景档**里都看不见、
 *      大天体之间穿插、轨道陷入中心天体（含环）、逆行表达是否正确。
 *
 * 用法：npm run check
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REAL } from '../src/data/bodies-real.js';
import { applyScale, frameRadius } from '../src/scale.js';
import { COMET_DEFAULTS } from '../src/comet.js';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '..', 'src');
const TMP = resolve(SRC, '.check-tmp');
const FOV = 45;
const DEG = Math.PI / 180;
const TAN_HALF = Math.tan((FOV * DEG) / 2);

// 图片 import 在 node 下无法解析，替换成字符串占位；shared.js 的星空同理
function toNodeModule(code) {
  return code
    .replace(/^import\s+\w+\s+from\s+'\/?images\/[^']+';\s*$/gm, (m) =>
      `const ${m.match(/import\s+(\w+)/)[1]} = '${m.match(/images\/[^']+/)[0]}';`)
    .replace(/^import\s+\{\s*starfield\s*\}\s+from\s+'\.\/shared\.js';\s*$/gm,
      "const starfield = ['1','2','3','4','5','6'];");
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
writeFileSync(resolve(TMP, 'mk.js'), readFileSync(resolve(SRC, 'systems', 'mk.js'), 'utf8'));
for (const f of readdirSync(resolve(SRC, 'systems'))) {
  // cosmos.js 是运行时页面工厂（导出 makeCosmosSystem，不是默认 system 配置），
  // 它的尺度由 universe.js 注册表计算，不属于这里的「静态系统配置」校验对象。
  if (!f.endsWith('.js') || f === 'mk.js' || f === 'shared.js' || f === 'cosmos.js') continue;
  writeFileSync(resolve(TMP, f), toNodeModule(readFileSync(resolve(SRC, 'systems', f), 'utf8')));
}

// solar.js 在模块顶层就 new THREE.ShaderMaterial + TextureLoader().load()，
// 需要最小 DOM 桩才能在 node 下 import
globalThis.document = {
  createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }),
  createElement: () => ({ addEventListener() {}, removeEventListener() {}, style: {}, getContext: () => null }),
};

let problems = 0;
const warn = (m) => { problems++; console.log('   [!] ' + m); };
const info = (m) => console.log('   · ' + m);

const extentOf = (b) => {
  if (b.ring) return b.ring.outerRadius ?? b.size * (b.ring.outerScale ?? 1.5);
  if (b.model) return b.model.radiusUnits ?? b.size;
  // 彗星：核只有几 km、压缩后不足 1 单位（本来就该看不见），
  // 肉眼所见的"彗星"其实是彗发，所以可见范围要按彗发半径算，否则会误报"看不见"。
  if (b.comet) return b.comet.comaRadiusUnits ?? COMET_DEFAULTS.comaRadiusUnits;
  return b.size;
};

for (const f of readdirSync(TMP).sort()) {
  if (f === 'mk.js') continue;
  const system = (await import(pathToFileURL(resolve(TMP, f)).href)).default;

  // ---- 结构检查（在 applyScale 之前）----
  for (const b of system.bodies) {
    // fixedSize 天体（如银河系里的恒星锚点）本就不在 REAL 表里，跳过该警告
    if (!REAL[b.id] && !b.fixedSize) warn(`${f}: 天体 ${b.id} 不在 REAL 数据表中`);
    if (b.parent && !system.bodies.some((x) => x.id === b.parent)) {
      warn(`${f}: ${b.id} 的 parent=${b.parent} 不存在`);
    }
    // 逆行必须由 inc>90° 表达；periodDays 取负会二次反转，反而变顺行
    if (b.orbit && b.orbit.periodDays < 0) {
      warn(`${f}: ${b.id} 周期取了负值（${b.orbit.periodDays}）。逆行请用 inc>90° 表达，否则方向会反向`);
    }
  }
  const centre = system.bodies.find((b) => !b.parent);
  if (!system.hasSun && centre?.orbit) {
    warn(`${f}: 中心天体 ${centre.id} 仍带公转轨道（半长轴 ${centre.orbit.aAU ?? centre.orbit.aKm}），会飞出画面；请加 noOrbit: true`);
  }

  applyScale(system);

  // ---- 逐个取景档算可见性 ----
  const views = system.views ?? [{ id: 'default', label: '默认', frameTo: system.camera?.frameTo ?? 'auto' }];
  console.log(`\n== ${system.id.padEnd(11)} ${system.label}  天体 ${system.bodies.length} 个  取景档 ${views.length} 个`);

  const bestPct = new Map();
  const distOf = new Map();
  for (const v of views) {
    const frameR = frameRadius(system, v.frameTo);
    const dist = (frameR / TAN_HALF) * (system.camera?.fitMargin ?? 1.25);
    const visibleH = 2 * dist * TAN_HALF;
    distOf.set(v.id, dist);
    console.log(`   -- ${v.label.padEnd(16)} 取景半径=${frameR.toFixed(1).padStart(8)}  相机距离=${dist.toFixed(0).padStart(7)}`);
    for (const b of system.bodies) {
      const pct = ((extentOf(b) * 2) / visibleH) * 100;
      if (!bestPct.has(b.id) || pct > bestPct.get(b.id)) bestPct.set(b.id, pct);
    }
  }

  let farthest = 0;
  for (const b of system.bodies) if (b.orbit?.a) farthest = Math.max(farthest, b.orbit.a);
  const zoomOutNeeded = Math.max(farthest * 1.35, (distOf.get(views[views.length - 1].id) ?? 0) * 3);
  console.log(`   最远轨道=${farthest.toFixed(1)}  最远处需相机距离≈${(farthest / TAN_HALF).toFixed(0)}  自动拉远上限=${zoomOutNeeded.toFixed(0)}`);

  // 默认取景档（camera.frameTo 对应的那一档）：进来第一眼应该都看得见
  const defFrame = system.camera?.frameTo ?? 'auto';
  const defR = frameRadius(system, defFrame);
  const defVisibleH = 2 * (defR / TAN_HALF) * (system.camera?.fitMargin ?? 1.25) * TAN_HALF;

  for (const b of system.bodies) {
    const pct = bestPct.get(b.id);
    const shown = extentOf(b);
    // 默认视角内应当可见（<0.15% ≈ 1px 即视为确实看不见）；视角外的远距卫星只作说明
    const inDefault = b.orbit?.a == null || b.orbit?.a <= defR * 1.05;
    const defPct = ((shown * 2) / defVisibleH) * 100;
    // fixedSize 天体（银河系恒星锚点）刻意是大场景里的小点，其"小"是预期的，不算问题
    if (inDefault && defPct < 0.15 && !b.fixedSize) {
      warn(`${b.id} 落在默认视角内却只有屏高 ${defPct.toFixed(2)}%（≈${(defPct * 9).toFixed(1)}px @900px）：请调小默认 view 的取景范围或调大 minBodyUnits`);
    }
    info(`${b.id.padEnd(11)} 半径=${shown.toFixed(2).padStart(6)} 轨道=${(b.orbit?.a == null ? '中心' : b.orbit.a.toFixed(1)).padStart(8)} 默认档占屏=${defPct.toFixed(2)}%${inDefault ? '' : '（在默认视角外，需切档/滚轮拉远）'}${b.orbit?.inc > 90 ? '  逆行' : ''}`);
  }

  // ---- 轨道陷入中心天体（含环）？----
  if (centre) {
    const cExtent = extentOf(centre);
    for (const b of system.bodies) {
      if (b.orbit?.a == null) continue;
      if (b.orbit.a < cExtent * 0.98) {
        warn(`${b.id} 轨道 ${b.orbit.a.toFixed(2)} 埋进中心天体 ${centre.id}（含环外沿 ${cExtent.toFixed(2)}）`);
      }
    }
  }

  // ---- 大天体之间穿插 ----
  // 只关心"大家伙"： satellites 为了可见被放大了几十倍，小幅靠近是必然结果，
  // 只有那个量级的大天体互相压在一起才是真 bug（历史上木星球体包住土星轨道那种）。
  //
  // ⚠ 高偏心率轨道（彗星、冥王星这类）必须跳过：半长轴根本不代表它们"待在哪"。
  // 坦普尔-塔特尔 a=10.3 AU，却跑到 19.7 AU 外又插回 0.98 AU，横跨天王星轨道是物理事实，
  // 拿半长轴比间距只会制造假警报。这类轨道改为单看近日点有没有陷进太阳（见下）。
  const ECCENTRIC = 0.2;
  const bigThreshold = centre ? centre.size * 0.5 : 0;
  for (let i = 0; i < system.bodies.length; i++) {
    const A = system.bodies[i];
    for (let j = i + 1; j < system.bodies.length; j++) {
      const B = system.bodies[j];
      if (A.orbit?.a == null || B.orbit?.a == null) continue;
      if ((A.orbit.e ?? 0) >= ECCENTRIC || (B.orbit.e ?? 0) >= ECCENTRIC) continue;
      const gap = Math.abs(A.orbit.a - B.orbit.a);
      const biggest = Math.max(extentOf(A), extentOf(B));
      if (biggest < bigThreshold) continue;
      if (gap < biggest) {
        warn(`${A.id}(轨道 ${A.orbit.a.toFixed(1)}) 与 ${B.id}(轨道 ${B.orbit.a.toFixed(1)}) 穿插：间距 ${gap.toFixed(1)} < 较大者外沿 ${biggest.toFixed(1)}`);
      }
    }
  }

  if (system.scale?.sunUnits) {
    const inner = system.bodies.filter((b) => b.orbit?.a != null).sort((x, y) => x.orbit.a - y.orbit.a)[0];
    if (inner && inner.orbit.a - inner.size < system.scale.sunUnits * 1.1) {
      warn(`最内侧 ${inner.id}(${inner.orbit.a.toFixed(1)}) 距太阳表面(${system.scale.sunUnits})过近`);
    }
  }

  // ---- 彗星专项 ----
  // 彗星的"位置"由近日点决定（远日点可以跑到几十 AU 外），所以只校验近日点没陷进太阳；
  // 同时确认渲染偏心率只被调小、没被调大（调小是为避开被夸大的太阳，调大就是数据错了）。
  for (const b of system.bodies) {
    if (!b.comet) continue;
    const eReal = b.orbit?.eReal ?? 0;
    const eDraw = b.orbit?.e ?? 0;
    const aAU = b.orbit?.aAU ?? 0;
    const peri = (b.orbit?.a ?? 0) * (1 - eDraw);
    if (eDraw > eReal + 1e-6) {
      warn(`${b.id} 渲染偏心率 ${eDraw.toFixed(4)} 大于真实值 ${eReal.toFixed(4)}：只允许调小以避开被夸大的太阳球体`);
    }
    if (system.scale?.sunUnits && peri < system.scale.sunUnits) {
      warn(`${b.id} 近日点 ${peri.toFixed(1)} 仍陷在太阳球体(${system.scale.sunUnits})内`);
    }
    info(
      `${b.id} 活动区间：近日点 ${(aAU * (1 - eReal)).toFixed(2)} AU / 远日点 ${(aAU * (1 + eReal)).toFixed(1)} AU` +
      `  渲染 e ${eReal.toFixed(4)}→${eDraw.toFixed(4)}  近日点 ${peri.toFixed(1)} 单位`
    );
  }
}

rmSync(TMP, { recursive: true, force: true });
console.log(problems ? `\n共 ${problems} 处需要关注` : '\n全部通过');
process.exit(problems ? 1 : 0);
