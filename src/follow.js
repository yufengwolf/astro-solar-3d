/**
 * 跟随镜头的纯数学（不依赖 THREE，Node 自检脚本可直接 import）。
 *
 * 选中天体后不再冻结全场：相机每帧落到「天体当前世界坐标 + 相对偏移」，
 * 于是时间照常推进、其它天体照常公转，目标却始终居中。偏移还要随天体的
 * 轨道方位角一起「共转」——否则地球公转半圈后相机仍停在原来的世界方位，
 * 会绕到背光侧，看到一片黑面。共转让中心光源始终留在相机背后同一侧，
 * 同时星空与其它天体相对流动，这才是「跟着地球绕太阳转」的镜头。
 */

const TAU = Math.PI * 2;

/** 单帧允许的最大共转角度（约 20°）。超过视为瞬移 / 切档，跳过本帧共转。 */
export const MAX_CO_ROTATE_STEP = 0.35;

/** 轨道平面（XZ）的方位角；系统中心统一取原点。 */
export function orbitAngle(p) {
  return Math.atan2(p.z, p.x);
}

/** 角度差归一化到 (-π, π]，避免跨 ±π 边界时整圈猛转。 */
export function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

/**
 * 绕 +Y 轴旋转向量。three.js 的 rotateY(θ) 会让 atan2(z, x) 减少 θ，
 * 因此想让偏移跟随天体方位角 +d 一起转，需要传 -d。
 */
export function rotateY(v, theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

/**
 * 天体方位角从 prevAngle 变为 curAngle 时，把相机偏移做同样的共转。
 * maxStep 可注入：运行时用默认上限防瞬移，自检可放宽到 90° 验证完整数学。
 */
export function coRotate(offset, prevAngle, curAngle, maxStep = MAX_CO_ROTATE_STEP) {
  const d = angleDelta(curAngle, prevAngle);
  if (!Number.isFinite(d) || Math.abs(d) > maxStep) {
    return { x: offset.x, y: offset.y, z: offset.z };
  }
  return rotateY(offset, -d);
}
