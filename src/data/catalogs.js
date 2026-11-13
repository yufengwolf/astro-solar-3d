// src/data/catalogs.js
// 天体目录注册表：每个原始星表（HYG / OpenNGC / Gaia…）登记一项，声明
//   kind    : 'starfield' 背景星点云 | 'deepsky' 星云/星团/星系等可定位对象
//   enabled : 是否加载（场景构建时按此开关决定，不再散落 if(flag)）
//   data    : starfield 类提供 { pos, col, count }（Float32 数组，场景坐标 kpc）
// 坐标换算全部来自 src/coord/galactic.js 唯一真源；新增目录只需在此登记 +
// 在 scripts/ 里加一个 build 脚本，运行时即可自动加载。
//
// 当前：HYG 已接入；OpenNGC（深空天体）与 Gaia（全银盘恒星）预留位，待接入。

import { HYG_POS, HYG_COL, HYG_COUNT } from './hyg-stars.js';

export const CATALOGS = {
  hyg: {
    kind: 'starfield',
    enabled: true,
    label: 'HYG Database v3.7',
    note: '119,627 条恒星筛选至 109,400 颗（距银心 ≤15 kpc），真实坐标填满银盘本地恒星区',
    data: { pos: HYG_POS, col: HYG_COL, count: HYG_COUNT },
  },
  // 预留：深空天体（星云 / 星团 / 星系），待接入 OpenNGC
  openngc: {
    kind: 'deepsky',
    enabled: false,
    label: 'OpenNGC (planned)',
    note: '~13,957 个 NGC/IC 深空天体，补「外层系统」',
  },
  // 预留：全银盘恒星（十亿级），先占位
  gaia: {
    kind: 'starfield',
    enabled: false,
    label: 'Gaia (planned)',
    note: '全银盘真实恒星，体量大，需 LOD / 分块加载',
  },
};
