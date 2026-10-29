import bg1 from '/images/1.jpg';
import bg2 from '/images/2.jpg';
import bg3 from '/images/3.jpg';
import bg4 from '/images/4.jpg';

/**
 * 星空立方体贴图（6 面顺序：+X, -X, +Y, -Y, +Z, -Z）
 * 各系统共用，Rollup 会打成共享 chunk，跨页面只下载一次。
 */
export const starfield = [bg3, bg1, bg2, bg2, bg4, bg2];
