import { makeConfig } from './vite.base.js';

// 单独构建天王星系统：只重建 dist/uranus.html 及其所需资源，不影响其他系统
export default makeConfig('uranus');
