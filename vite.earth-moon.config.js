import { makeConfig } from './vite.base.js';

// 单独构建地月系统：只重建 dist/earth-moon.html 及其所需资源，不影响其他系统
export default makeConfig('earthMoon');
