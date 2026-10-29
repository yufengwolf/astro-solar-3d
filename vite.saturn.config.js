import { makeConfig } from './vite.base.js';

// 单独构建土星系统：只重建 dist/saturn.html 及其所需资源，不影响其他系统
export default makeConfig('saturn');
