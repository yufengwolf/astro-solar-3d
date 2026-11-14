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
import { OPENNGC_POS, OPENNGC_COL, OPENNGC_COUNT, OPENNGC_META } from './openngc.js';

export const CATALOGS = {
  hyg: {
    kind: 'starfield',
    enabled: true,
    label: 'HYG Database v3.7',
    note: '119,627 条恒星筛选至 109,400 颗（距银心 ≤15 kpc），真实坐标填满银盘本地恒星区',
    data: { pos: HYG_POS, col: HYG_COL, count: HYG_COUNT },
  },
  // 深空天体（星云 / 星团 / 星系）：OpenNGC（~14,000 个 NGC/IC/其他）。
  // 方向用真实银道坐标，半径用壳层摆放（星系按红移/视向速度推距离对数映射到 3–16 kpc 壳层，
  // 无距离按类型分壳层）。渲染见 main.js 的目录循环 deepsky 分支，点击可弹信息卡。
  openngc: {
    kind: 'deepsky',
    enabled: true,
    label: 'OpenNGC (14,027 objects)',
    note: '~14,027 个 NGC/IC/其他深空天体，真实方向 + 壳层摆放，按类型着色',
    data: {
      pos: OPENNGC_POS,
      col: OPENNGC_COL,
      count: OPENNGC_COUNT,
      meta: OPENNGC_META,
    },
  },
  // Gaia 已在 src/data/deep/ 单独接入：GCNS（太阳 100 pc 内 331,312 颗恒星
  // 全量，含三角视差距离）。它不走这里的 starfield 目录通道，而是由
  // system.galaxy.deepClouds 按需动态加载，并按比例尺档位淡入，避免与
  // HYG / OpenNGC 一起被塞进每个页面的首屏包。Gaia DR3 全表 18 亿行
  // （约 1 TB）不属于前端可承载范围，这里保留占位说明。
  gaia: {
    kind: 'starfield',
    enabled: false,
    label: 'Gaia DR3 (via deep catalogs)',
    note: '已接 GCNS 100 pc 全量（src/data/deep/gcns.js）；DR3 全表 18 亿行不适合前端加载',
  },
};
