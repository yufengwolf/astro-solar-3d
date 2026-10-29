import { REAL } from '../data/bodies-real.js';

/**
 * 用真实物理参数生成一个天体定义。
 * opts 可覆盖任何字段；opts.orbit 会与真实轨道参数合并（用于设 showLine / opacity / color）。
 *
 * ⚠ opts.noOrbit —— 必须显式声明，否则会踩坑：
 * REAL 里地球/火星/木星…都带「绕日轨道 aAU」。在子系统里它们是中心天体，
 * 若不声明 noOrbit，就会带着 1 AU 量级的半长轴绕原点公转，整个系统飞出画面。
 */
export function mk(id, name, opts = {}) {
  const r = REAL[id];
  if (!r) throw new Error(`未知天体: ${id}`);

  const base = {
    id,
    name,
    realRadiusKm: r.radiusKm,
    rotationHours: r.rotationHours,
    tilt: r.axialTilt,
  };

  if (r.orbit && !opts.noOrbit) {
    base.orbit = { ...r.orbit, node: 0, showLine: true, ...(opts.orbit || {}) };
  }

  const { orbit, noOrbit, ...rest } = opts;
  return { ...base, ...rest };
}
