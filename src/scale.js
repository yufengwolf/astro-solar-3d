import { AU_KM } from './data/bodies-real.js';

/**
 * 尺度换算（纯函数，不依赖 three，便于脚本直接复算验证）。
 *
 * scale.radiusRef      —— 参考天体 id
 * scale.radiusRefUnits —— 该天体的真实半径映射为多少场景单位
 * scale.radiusPower    —— 半径压缩指数（1 = 真实相对大小，<1 压大放小）。
 *                         必须压缩：卫星真实半径可能只有中心天体的 1/300，
 *                         按真实比例渲染就是不足 1 像素的点（"看不见天体"的根因）。
 * scale.bodyExaggeration —— 半径统一放大倍数（默认 1）
 * scale.minBodyUnits    —— 半径下限（场景单位），兜住极端小的天体
 * scale.distanceMode   —— 'linear' 真实比例（可乘 distanceFactor）
 *                         'power'  按 a^p 幂律压缩（仅太阳系总览用）
 * scale.distanceFactor —— linear 模式下的距离倍数，1 = 完全真实比例。
 *                         它是**整体倍数**，不改变各轨道之间的相对比例，
 *                         所以"轨道疏密"仍然 100% 真实，只改变"天体大小 vs 轨道距离"的比值。
 * scale.distancePower  —— power 模式指数，越小内行星越外扩
 * scale.maxDistance    —— power 模式下最远天体映射到的场景单位
 * scale.sunUnits       —— 太阳单独指定半径
 */
export function applyScale(system) {
  const scale = system.scale ?? {};
  const refId = scale.radiusRef ?? system.bodies[0].id;
  const refDef = system.bodies.find((b) => b.id === refId);
  if (!refDef) throw new Error(`scale.radiusRef 指向了不存在的天体: ${refId}`);

  const refUnits = scale.radiusRefUnits ?? 6.4;
  // km -> 场景单位：轨道距离用这把尺子
  const kRadius = refUnits / refDef.realRadiusKm;
  // 半径单独换算：以参考天体为基准做幂律压缩，参考天体本身恒等于 refUnits
  const radiusPower = scale.radiusPower ?? 1;
  const exaggeration = scale.bodyExaggeration ?? 1;
  const minUnits = scale.minBodyUnits ?? 0;

  const orbitsAU = system.bodies
    .map((b) => b.orbit?.aAU)
    .filter((v) => typeof v === 'number');
  const maxAU = orbitsAU.length ? Math.max(...orbitsAU) : 1;
  const power = scale.distancePower ?? 0.4;
  const maxDistance = scale.maxDistance ?? 340;

  for (const def of system.bodies) {
    def.size = Math.max(
      refUnits * Math.pow(def.realRadiusKm / refDef.realRadiusKm, radiusPower) * exaggeration,
      minUnits
    );

    if (def.orbit) {
      const aKm = def.orbit.aAU != null ? def.orbit.aAU * AU_KM : def.orbit.aKm;
      if (scale.distanceMode === 'power') {
        const aAU = aKm / AU_KM;
        def.orbit.a = (Math.pow(aAU, power) / Math.pow(maxAU, power)) * maxDistance;
      } else {
        def.orbit.a = aKm * kRadius * (scale.distanceFactor ?? 1);
      }
    }
  }
  return kRadius;
}

/**
 * 自动取景半径：'auto'(默认) 取最远轨道；也可指定某颗天体只框到它的轨道。
 * 中心天体（含环）本身也保证在画面内。
 *
 * @param {object} system
 * @param {string} [overrideFrameTo] 覆盖 system.camera.frameTo（多视角切换时用）
 */
export function frameRadius(system, overrideFrameTo) {
  const frameId = overrideFrameTo ?? system.camera?.frameTo ?? 'auto';
  let radius = 0;

  if (frameId === 'auto') {
    for (const b of system.bodies) if (b.orbit?.a) radius = Math.max(radius, b.orbit.a);
  } else {
    const target = system.bodies.find((x) => x.id === frameId);
    if (!target) throw new Error(`camera.frameTo 指向了不存在的天体: ${frameId}`);
    radius = target.orbit?.a ?? 0;
  }

  const centre = system.bodies.find((b) => !b.orbit);
  if (centre) {
    const ringOuter = centre.ring?.outerRadius ?? centre.size * (centre.ring?.outerScale ?? 1.5);
    radius = Math.max(radius, Math.max(centre.size, ringOuter) * 2.2);
  }
  return radius > 0 ? radius : 100;
}
