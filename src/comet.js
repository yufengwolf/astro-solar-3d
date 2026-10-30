import * as THREE from 'three';
import { orbitPoint } from './bodies.js';

/**
 * 彗星视觉：核 + 彗发 + 两条尾巴。
 *
 * 为什么单独成模块：彗星不是"一颗球"，它的可见部分几乎全是被太阳吹出来的。
 * 三条物理约束决定了这里的写法：
 *
 *   1. 尾巴方向 = 背离太阳（太阳风 / 辐射压），所以必须每帧按世界坐标重定向，
 *      不能挂在随轨道面旋转的 plane 节点下。
 *   2. 活动强度随日心距衰减（约 1/r²）。彗星只在接近太阳时才"长出"彗发与尾巴，
 *      在远日点就是一颗又黑又小、看不出特征的核——这正是它难以被发现的原因。
 *   3. 两类尾巴：离子尾（太阳风拖拽，笔直、偏蓝、更长）；尘埃尾（辐射压推动，
 *      因尘埃粒子轨道滞后而向运动反方向弯曲、偏黄、更宽更短）。
 *
 * 长度以"场景单位"给出而非 AU：总览用的是幂律压缩距离（a^0.45），
 * 非线性映射下无法把 AU 线性换算成长度，因此尾巴长度是**视觉量**，已在文档中标注。
 * 但"何时亮、何时暗"用的是真实日心距（r = a(1 - e·cos E)），这部分是真实的。
 */

const DEFAULTS = {
  comaScale: 6, // 彗发半径 = 核半径 × 该值（满活动时）
  comaOpacity: 0.30,
  comaColor: 0xa8dcff,
  ionTailUnits: 100, // 离子尾满活动时的长度（场景单位）
  dustTailRatio: 0.62, // 尘埃尾长度 = 离子尾 × 该比例
  ionWidthRatio: 0.13, // 尾锥底半径 / 长度（离子尾细长）
  dustWidthRatio: 0.28, // 尘埃尾明显更宽
  ionOpacity: 0.55,
  dustOpacity: 0.42,
  ionColor: 0x7fc8ff,
  dustColor: 0xffe6bd,
  onsetAU: 3.0, // 进入该日心距内活动强度达到 1，向外按 1/r² 衰减
  dustLag: 0.35, // 尘埃尾向"运动反方向"偏转的强度
};

/** 顶点在原点、沿 +Z 延伸的锥体：便于用 lookAt 指向背离太阳的方向 */
function tailGeometry() {
  const g = new THREE.ConeGeometry(1, 1, 28, 1, true);
  g.translate(0, -0.5, 0); // 锥尖移到原点（ConeGeometry 默认尖朝 +Y、中心在原点）
  g.rotateX(-Math.PI / 2); // 让锥体沿 +Z 伸展，配合 Object3D.lookAt 的 +Z 朝向
  return g;
}

function tailMesh(color, opacity) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending, // 发光叠加，不与背景争深度
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(tailGeometry(), mat);
}

/**
 * 给彗星本体挂上彗发，并造出两条尾巴（尾巴挂 scene 根，由调用方加入场景）。
 * @param {object} def 天体定义（需含 def.comet 配置）
 * @param {THREE.Mesh} mesh 本体（核）
 * @returns {{cfg:object, coma:THREE.Mesh, ion:THREE.Mesh, dust:THREE.Mesh}}
 */
export function createCometParts(def, mesh) {
  const cfg = { ...DEFAULTS, ...(def.comet ?? {}) };

  // 彗发挂在核下面，会继承核的 scale(=def.size)，
  // 因此这里的 scale 是"相对核半径的倍数"，随视觉放大滑块自动同步增长。
  const coma = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({
      color: cfg.comaColor,
      transparent: true,
      opacity: cfg.comaOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  coma.scale.setScalar(cfg.comaScale);
  coma.userData.bodyId = def.id;
  mesh.add(coma);

  const ion = tailMesh(cfg.ionColor, cfg.ionOpacity);
  const dust = tailMesh(cfg.dustColor, cfg.dustOpacity);
  ion.userData.bodyId = def.id;
  dust.userData.bodyId = def.id;
  ion.visible = false;
  dust.visible = false;

  return { cfg, coma, ion, dust };
}

// 复用的临时向量，避免每帧 new
const _pos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _dust = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _target = new THREE.Vector3();

function placeTail(tail, pos, dir, len, widthRatio, opacity) {
  if (!(len > 0.05) || !(opacity > 0.004)) {
    tail.visible = false;
    return;
  }
  tail.visible = true;
  tail.position.copy(pos);
  const w = len * widthRatio;
  tail.scale.set(w, w, len);
  tail.material.opacity = Math.min(0.9, opacity);
  // lookAt 依赖 matrixWorld 中的当前位置，先刷新再定向
  tail.updateMatrixWorld(true);
  _target.copy(pos).add(dir);
  tail.lookAt(_target);
}

/**
 * 每帧更新一条彗星的彗发与尾巴。
 *
 * @param {object} node createBody 返回的节点（需已挂载 node.comet）
 * @param {THREE.Vector3} sunPos 太阳的世界坐标
 * @param {number} tailGain 用户可调的彗尾强度倍数
 */
export function updateComet(node, sunPos, tailGain = 1) {
  const c = node.comet;
  const d = node.def;
  if (!c || !node.mesh || !d.orbit) return;
  const cfg = c.cfg;

  // ---- 活动强度：用真实日心距（真实偏心率 eReal，不受近日点渲染下限影响）----
  const eReal = d.orbit.eReal ?? d.orbit.e ?? 0;
  const aAU = d.orbit.aAU ?? (d.orbit.aKm ? d.orbit.aKm / 149597870.7 : 1);
  const rAU = Math.max(1e-4, aAU * (1 - eReal * Math.cos(node._E ?? 0)));
  const onset = cfg.onsetAU ?? 3;
  const act = Math.min(1, (onset * onset) / (rAU * rAU)); // 1/r² 衰减

  // ---- 彗发：远日点几乎消失，近日点膨胀 ----
  c.coma.scale.setScalar(cfg.comaScale * (0.28 + 0.72 * act));
  c.coma.material.opacity = Math.min(0.7, cfg.comaOpacity * (0.25 + 0.75 * act) * tailGain);

  // ---- 位置与背离太阳方向 ----
  node.mesh.getWorldPosition(_pos);
  _dir.copy(_pos).sub(sunPos);
  if (_dir.lengthSq() < 1e-8) _dir.set(0, 0, 1);
  _dir.normalize();

  // ---- 轨道运动方向：对位置做一次微小前插，得到速度方向（尘埃尾要向后偏）----
  const a = d.orbit.a;
  const e = d.orbit.e ?? 0;
  const E = node._E ?? 0;
  const q1 = orbitPoint(a, e, E);
  const q2 = orbitPoint(a, e, E + 0.002);
  _p1.set(q1.x, 0, q1.z);
  _p2.set(q2.x, 0, q2.z);
  node.plane.updateWorldMatrix(true, false);
  node.plane.localToWorld(_p1);
  node.plane.localToWorld(_p2);
  _p2.sub(_p1);
  if (_p2.lengthSq() < 1e-8) _p2.set(0, 0, 1);
  _p2.normalize();

  const lenIon = cfg.ionTailUnits * act * tailGain;
  const lenDust = cfg.ionTailUnits * cfg.dustTailRatio * act * tailGain;
  const opIon = cfg.ionOpacity * (0.35 + 0.65 * act) * tailGain;
  const opDust = cfg.dustOpacity * (0.35 + 0.65 * act) * tailGain;

  placeTail(c.ion, _pos, _dir, lenIon, cfg.ionWidthRatio, opIon);

  // 尘埃尾滞后于运动方向：在"背离太阳"与"运动反方向"之间偏一个角度
  _dust.copy(_dir).addScaledVector(_p2, -cfg.dustLag);
  if (_dust.lengthSq() < 1e-8) _dust.copy(_dir);
  _dust.normalize();
  placeTail(c.dust, _pos, _dust, lenDust, cfg.dustWidthRatio, opDust);
}
