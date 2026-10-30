/**
 * 临时验证：用生产代码 src/comet.js 检查彗尾的方向与活动衰减是否符合物理预期。
 */
import * as THREE from 'three';
import { createCometParts, updateComet } from '../src/comet.js';

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

  console.log(
    `${label.padEnd(10)} r=${rAU.toFixed(2).padStart(6)} AU  ` +
    `离子尾长=${node.comet.ion.visible ? node.comet.ion.scale.z.toFixed(1) : '隐藏'}  ` +
    `尘埃尾长=${node.comet.dust.visible ? node.comet.dust.scale.z.toFixed(1) : '隐藏'}  ` +
    `离子尾偏离背日方向=${angIon.toFixed(2)}°  尘埃尾偏转=${angDust.toFixed(1)}°  ` +
    `彗发半径=${(node.def.size * node.comet.coma.scale.x).toFixed(1)}`
  );
  return { angIon, angDust };
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

// 远日点应显著变弱
halley._E = Math.PI;
halley.mesh.position.set(halley.def.orbit.a * (Math.cos(Math.PI) - halley.def.orbit.e), 0, 0);
halley.mesh.updateMatrixWorld(true);
updateComet(halley, sunPos, 1);
const lenApo = halley.comet.ion.scale.z;
halley._E = 0;
halley.mesh.position.set(halley.def.orbit.a * (1 - halley.def.orbit.e), 0, 0);
halley.mesh.updateMatrixWorld(true);
updateComet(halley, sunPos, 1);
const lenPeri = halley.comet.ion.scale.z;
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

console.log(bad ? `\n${bad} 项未通过` : '\n全部通过');
process.exit(bad ? 1 : 0);
