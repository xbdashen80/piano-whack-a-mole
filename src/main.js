// ================= 装配入口 =================
import { resize, layoutKeys, game } from './state.js';
import { refreshHUD, buildLevelGrid, renderKbPreview, bindButtons } from './ui.js';
import { initGame, tick } from './game.js';
import { initMIDI, initKeyboard } from './midi.js';

window.addEventListener('resize', resize);

initGame();        // 注册游戏事件监听
bindButtons();     // 绑定 HUD 按钮
initMIDI();        // 连接钢琴
initKeyboard();    // 键盘兜底输入

game.curLevel = 0;
layoutKeys(); buildLevelGrid(); renderKbPreview(); refreshHUD();
resize();
requestAnimationFrame(tick);
