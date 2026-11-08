import '../i18n.js';
import { mountUniverseNav, mountLadder } from '../nav.js';

// 首页同样挂宇宙导航条，并铺出「宇宙 → … → 太阳系」的可点层级路线
const boot = () => { mountUniverseNav(); mountLadder(); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
