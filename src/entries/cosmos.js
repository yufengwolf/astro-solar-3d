import { makeCosmosSystem } from '../systems/cosmos.js';
import { start } from '../main.js';
import { resolveCurrentId, byId, label, isEnglish } from '../universe.js';

// 同一个页面按 ?node=<id> 渲染任意上层层级；注册表加一行就能多一个世界
const id = resolveCurrentId();
document.title = `${label(byId(id))} · ${isEnglish() ? 'Cosmic Atlas' : '宇宙遨游'}`;
start(makeCosmosSystem(id));
