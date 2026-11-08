import { makeConfig } from './vite.base.js';

// 单独构建通用宇宙层级页：只重建 dist/cosmos.html 及其所需资源
export default makeConfig('cosmos');
