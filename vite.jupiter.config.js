import { makeConfig } from './vite.base.js';

// 单独构建木星系统：只重建 dist/jupiter.html 及其所需资源，不影响其他系统
export default makeConfig('jupiter');
