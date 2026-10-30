/**
 * 彗尾自检（跑的是生产代码，不是副本）：
 *   1. 用 src/comet.js 的 updateComet 检查尾巴方向、活动衰减、末端弯曲是否符合物理预期。
 *   2. 用**真实的 src/systems/solar.js 配置**（图片 import 替换成占位符后 import），
 *      复算"初始画面"里每颗彗星的尾长，确认它们既分散又确有可见的活跃者。
 *
 * 用法：npm run check:comet
 */
import * as THREE from 'three';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCometParts, updateComet } from '../src/comet.js';
import { solveKepler, orbitPoint } from '../src/bodies.js';
import { applyScale } from '../src/scale.js';

const DEG = Math.PI / 180;
const sunPos = new THREE.Vector3(0, 0, 0);

function makeComet(def) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), new THREE.MeshBasicMaterial());
  mesh.scale.setScalar(def.size);
  const group = new THREE.Group();
  const plane = new THREE.Group();
  plane.rotation.x = (def.orbit.inc ?? 0) * DEG;
  group.add(plane);
  plane.add(mesh);
  const scene = new THREE.Scene();
  scene.add(group);
  const parts = createCometParts(def, mesh);
  scene.add(parts.coma);
  scene.add(parts.coma2);
  scene.add(parts.ion);
  scene.add(parts.dust);
  return { def, mesh, plane, comet: parts, _E: 0 };
}

// 哈雷：渲染 e 已被近日点下限收到 0.9064，真实 e 0.9671 保存在 eReal
const halley = makeComet({
  id: 'halley', name: '哈雷', size: 2.5,
  orbit: { a: 363.4, e: 0.9064, eReal: 0.9671, aAU: 17.83414, inc: 162.2627 },
  comet: { onsetAU: 6, ionTailUnits: 150, comaScale: 7 },
});

function axisOf(obj) {
  return new THREE.Vector3(0, 0, 1).applyQuaternion(obj.quaternion);
}

function report(node, label, E) {
  node._E = E;
  // 先把本体摆到该偏近点角对应的位置（与 main.js 一致）
  const { a, e } = node.def.orbit;
  const b = a * Math.sqrt(1 - e * e);
  node.mesh.position.set(a * (Math.cos(E) - e), 0, b * Math.sin(E));
  node.mesh.updateMatrixWorld(true);
  updateComet(node, sunPos, 1);

  const eReal = node.def.orbit.eReal;
  const rAU = node.def.orbit.aAU * (1 - eReal * Math.cos(E));
  const pos = new THREE.Vector3();
  node.mesh.getWorldPosition(pos);
  const away = pos.clone().sub(sunPos).normalize();
  const ionDir = axisOf(node.comet.ion);
  const dustDir = axisOf(node.comet.dust);
  const angIon = ionDir.angleTo(away) / DEG;
  const angDust = dustDir.angleTo(away) / DEG;

  const curve = node.comet.dust.userData.curve ?? { x: 0, y: 0 };
  const curveMag = Math.hypot(curve.x, curve.y);
  console.log(
    `${label.padEnd(10)} r=${rAU.toFixed(2).padStart(6)} AU  ` +
    `离子尾长=${node.comet.ion.visible ? node.comet.ion.userData.length.toFixed(1) : '隐藏'}  ` +
    `尘埃尾长=${node.comet.dust.visible ? node.comet.dust.userData.length.toFixed(1) : '隐藏'}  ` +
    `离子尾偏离背日方向=${angIon.toFixed(2)}°  尘埃尾根偏转=${angDust.toFixed(1)}°  ` +
    `末端再弯=${(Math.atan(curveMag) / DEG).toFixed(1)}°  ` +
    `彗发半径=${node.comet.coma.scale.x.toFixed(1)}  彗核=${node.def.size.toFixed(2)}`
  );
  return { angIon, angDust, curveMag };
}

console.log('=== 哈雷彗星：从近日点(E=0)到远日点(E=π) ===');
const peri = report(halley, '近日点', 0);
report(halley, 'E=1.0', 1.0);
report(halley, 'E=2.0', 2.0);
report(halley, '远日点', Math.PI);

console.log('\n=== 断言 ===');
let bad = 0;
const check = (ok, msg) => { console.log((ok ? '  [OK] ' : '  [FAIL] ') + msg); if (!ok) bad++; };

check(peri.angIon < 0.01, `离子尾严格背离太阳（偏差 ${peri.angIon.toFixed(3)}°，应为 0）`);
check(peri.angDust > 5 && peri.angDust < 40, `尘埃尾向运动反方向偏转（${peri.angDust.toFixed(1)}°，应在 5–40°）`);
// 末端应比根部更弯：这是 t² 形变的作用，取代了早期"整条尾巴硬转一个角度"的圆锥写法
const tipAngle = peri.angDust + Math.atan(peri.curveMag) / DEG;
check(tipAngle > peri.angDust + 3 && tipAngle < 45,
  `尘埃尾末端比根部更弯（根 ${peri.angDust.toFixed(1)}° → 末端 ${tipAngle.toFixed(1)}°）`);

// 远日点应显著变弱
halley._E = Math.PI;
halley.mesh.position.set(halley.def.orbit.a * (Math.cos(Math.PI) - halley.def.orbit.e), 0, 0);
halley.mesh.updateMatrixWorld(true);
updateComet(halley, sunPos, 1);
const lenApo = halley.comet.ion.userData.length;
halley._E = 0;
halley.mesh.position.set(halley.def.orbit.a * (1 - halley.def.orbit.e), 0, 0);
halley.mesh.updateMatrixWorld(true);
updateComet(halley, sunPos, 1);
const lenPeri = halley.comet.ion.userData.length;
check(lenPeri > lenApo * 10, `近日点尾巴(${lenPeri.toFixed(1)}) 远长于远日点(${lenApo.toFixed(1)})，符合 1/r² 衰减`);
check(Math.abs(lenPeri - 150) < 0.5, `近日点离子尾长为配置值 150（实际 ${lenPeri.toFixed(1)}）`);

// 尾巴应指向背离太阳：把太阳挪到别处，方向必须跟着变
const moved = new THREE.Vector3(500, 0, 0);
updateComet(halley, moved, 1);
const away2 = new THREE.Vector3();
halley.mesh.getWorldPosition(away2);
away2.sub(moved).normalize();
const ang2 = axisOf(halley.comet.ion).angleTo(away2) / DEG;
check(ang2 < 0.01, `太阳移位后尾巴仍严格背离太阳（偏差 ${ang2.toFixed(3)}°）`);

// ---------------------------------------------------------------------------
// 尾巴到底该指向哪？——常见直觉是"拖在运动后方"，但真实彗尾是**背离太阳**：
//   · 远离太阳时：运动朝外、尾巴也朝外 → 尾巴确实拖在"后侧方"（夹角 < 90°）
//   · 接近太阳时：运动朝内、尾巴朝外 → 尾巴指向"前侧方"（夹角 > 90°）
//   · 近日点 / 远日点：速度与半径垂直 → 正侧面（夹角 = 90°）
// 这里用生产代码实测哈雷一个周期内的夹角，确认实现符合这条规律。
// ---------------------------------------------------------------------------
function velocityDir(node, E) {
  const { a, e } = node.def.orbit;
  const p1 = orbitPoint(a, e, E);
  const p2 = orbitPoint(a, e, E + 0.002);
  const v1 = new THREE.Vector3(p1.x, 0, p1.z);
  const v2 = new THREE.Vector3(p2.x, 0, p2.z);
  node.plane.updateWorldMatrix(true, false);
  node.plane.localToWorld(v1);
  node.plane.localToWorld(v2);
  return v2.sub(v1).normalize();
}

console.log('\n=== 哈雷：彗尾方向 vs 运动方向（尾巴背离太阳，不是拖在后面）===');
const angles = [];
for (const E of [0, 0.6, 1.2, 1.8, 2.4, 3.14, 3.8, 4.4, 5.0, 5.6]) {
  halley._E = E;
  const { a, e } = halley.def.orbit;
  const b = a * Math.sqrt(1 - e * e);
  halley.mesh.position.set(a * (Math.cos(E) - e), 0, b * Math.sin(E));
  halley.mesh.updateMatrixWorld(true);
  updateComet(halley, sunPos, 1);

  const pos = new THREE.Vector3();
  halley.mesh.getWorldPosition(pos);
  const radial = pos.clone().normalize(); // 背离太阳方向
  const vel = velocityDir(halley, E);
  const ang = axisOf(halley.comet.ion).angleTo(vel) / DEG;
  const outward = vel.dot(radial); // >0 表示正在远离太阳
  const rAU = halley.def.orbit.aAU * (1 - (halley.def.orbit.eReal ?? e) * Math.cos(E));
  angles.push({ E, ang, outward });
  console.log(
    `  E=${E.toFixed(2)}  r=${rAU.toFixed(2).padStart(6)} AU  ` +
    `${outward > 0 ? '远离太阳' : '接近太阳'}  尾-运动夹角=${ang.toFixed(1).padStart(5)}°  ` +
    `→ 尾巴在${ang > 100 ? '前侧方（迎着运动）' : ang < 80 ? '后方（拖在后面）' : '正侧面'}`
  );
}
const away = angles.filter((x) => x.outward > 0);
const toward = angles.filter((x) => x.outward < 0);
check(Math.abs(angles[0].ang - 90) < 8, `近日点尾巴与运动方向垂直（${angles[0].ang.toFixed(1)}°，即正侧面）`);
check(away.some((x) => x.ang < 70), `远离太阳时尾巴拖在后方（最小夹角 ${Math.min(...away.map((x) => x.ang)).toFixed(1)}°）`);
check(toward.some((x) => x.ang > 110), `接近太阳时尾巴指向前侧方（最大夹角 ${Math.max(...toward.map((x) => x.ang)).toFixed(1)}°）`);

// ---------------------------------------------------------------------------
// 初始画面：用真实配置 solar.js 复算每颗彗星的尾长。
// M0 是 JPL 历元平近点角推进到 1986-02-09（哈雷过近日点）的真实值，
// 这里确认它们既没全挤在近日点糊成一团，也没有全部休眠看不见。
// ---------------------------------------------------------------------------
const SRC = resolve('src');
const TMP = resolve(SRC, '.check-comet-tmp');
const toNodeModule = (code) =>
  code
    .replace(/^import\s+\w+\s+from\s+'\/?images\/[^']+';\s*$/gm, (m) =>
      `const ${m.match(/import\s+(\w+)/)[1]} = '${m.match(/images\/[^']+/)[0]}';`)
    .replace(/^import\s+\{\s*starfield\s*\}\s+from\s+'\.\/shared\.js';\s*$/gm,
      "const starfield = ['1','2','3','4','5','6'];");

// 与 check-scale.mjs 一致：solar.js 顶层就 new ShaderMaterial + TextureLoader().load()，
// 需要一个最小 DOM 桩才能在 node 下 import
globalThis.document = {
  createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }),
  createElement: () => ({ addEventListener() {}, removeEventListener() {}, style: {}, getContext: () => null }),
};

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
writeFileSync(resolve(TMP, 'mk.js'), readFileSync(resolve(SRC, 'systems', 'mk.js'), 'utf8'));
writeFileSync(resolve(TMP, 'solar.js'), toNodeModule(readFileSync(resolve(SRC, 'systems', 'solar.js'), 'utf8')));
const { default: solar } = await import(pathToFileURL(resolve(TMP, 'solar.js')).href);
applyScale(solar);

console.log('\n=== 初始画面（1986-02-09，哈雷过近日点）：各彗星实况 ===');
const rows = [];
for (const def of solar.bodies) {
  if (!def.comet) continue;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), new THREE.MeshBasicMaterial());
  mesh.scale.setScalar(def.size);
  const plane = new THREE.Group();
  plane.rotation.x = (def.orbit.inc ?? 0) * DEG;
  const group = new THREE.Group();
  group.add(plane);
  plane.add(mesh);
  const scene = new THREE.Scene();
  scene.add(group);
  const parts = createCometParts(def, mesh);
  scene.add(parts.ion);
  scene.add(parts.dust);

  const node = { def, mesh, plane, comet: parts, _E: 0 };
  const E = solveKepler(def.orbit.M0 ?? 0, def.orbit.e ?? 0);
  node._E = E;
  const p = orbitPoint(def.orbit.a, def.orbit.e ?? 0, E);
  mesh.position.set(p.x, 0, p.z);
  mesh.updateMatrixWorld(true);
  updateComet(node, sunPos, 1);

  const eReal = def.orbit.eReal ?? def.orbit.e ?? 0;
  const rAU = (def.orbit.aAU ?? 1) * (1 - eReal * Math.cos(E));
  const len = parts.ion.userData.length;
  rows.push({ name: def.name, rAU, len, visible: parts.ion.visible });
  console.log(
    `  ${def.name.padEnd(26)} r=${rAU.toFixed(2).padStart(6)} AU  ` +
    `离子尾=${len.toFixed(1).padStart(6)}  尘埃尾=${parts.dust.userData.length.toFixed(1).padStart(6)}  ` +
    `${parts.ion.visible ? '可见' : '休眠'}`
  );
}
rmSync(TMP, { recursive: true, force: true });

const shown = rows.filter((r) => r.visible && r.len > 10);
check(shown.length >= 2, `初始画面至少 2 颗彗星尾长可辨（实际 ${shown.length} 颗：${shown.map((r) => r.len.toFixed(0)).join('/')}）`);
check(rows.some((r) => r.len >= 100), `初始画面有 1 颗处于近日点的大彗尾（最长 ${Math.max(...rows.map((r) => r.len)).toFixed(0)}，应为哈雷 150）`);
// 不应全部挤在同一处：尾长应有明显差异
const spread = Math.max(...rows.map((r) => r.len)) / Math.max(0.01, Math.min(...rows.map((r) => r.len)));
check(spread > 3, `各彗星活跃度分散，不会糊成一团（最长/最短 = ${spread.toFixed(1)}×）`);

console.log(bad ? `\n${bad} 项未通过` : '\n全部通过');
process.exit(bad ? 1 : 0);
