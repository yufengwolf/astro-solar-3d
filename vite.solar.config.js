import { makeConfig } from './vite.base.js';

// 单独构建太阳系总览：只重建 dist/index.html 及其所需资源，不影响子系统
export default makeConfig('solar');
