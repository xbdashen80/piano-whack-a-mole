// ================= 主循环 + 状态机 + 判定 + 计分 + 过关/失败 =================
import { game, bear, particles, ripples, flashMap, prog, persist, layoutKeys, keyFor, colFor, kb } from './state.js';
import { LEVELS } from './levels.js';
import { initAudio, setMusicTier, startBgm, sfxHit, sfxCombo, sfxMiss, sfxLevel, sfxTick, duckBgm } from './audio.js';
import { fx, draw } from './render.js';
import { applySink, decayAnim } from './bear.js';
import { on } from './events.js';
import { logErr, spawnWatchdog } from './diagnostics.js';
import * as ui from './ui.js';

const flash = m => { flashMap[m] = performance.now() + 150; };
const GOLD = ['#FFD166', '#FFE9A8']; // 踩中鼓点的金色特效调色板

// 当前时刻离最近一拍有多近(ms)；用于踩点奖励。无拍源(beatMs=0)时返回极大值=永不踩中。
function offBeatMs(now) {
  if (!game.beatMs) return 1e9;
  const ph = ((now - game.lastBeatAt) % game.beatMs + game.beatMs) % game.beatMs;
  return Math.min(ph, game.beatMs - ph);
}

function spawnMole() {
  try {
    const L = LEVELS[game.curLevel]; if (game.moles.length >= L.maxActive) return;
    const busy = game.moles.map(m => m.midi); const avail = kb.activeKeyMidis.filter(m => !busy.includes(m));
    if (!avail.length) return; const midi = avail[Math.floor(Math.random() * avail.length)];
    game.moles.push({ midi, born: performance.now(), ttl: L.ttl, ticked: false }); game.lastMoleTime = performance.now();
  } catch (e) { logErr('spawnMole', e); }
}

function press(midi, vel) {
  try {
    if (!game.running) return; flash(midi);
    const now = performance.now();
    const idx = game.moles.findIndex(m => m.midi === midi); const k = keyFor(midi);
    if (idx >= 0) {
      const m = game.moles[idx]; game.moles.splice(idx, 1);
      const ratio = (now - m.born) / m.ttl; const perfect = ratio < 0.5;
      // 踩点奖励：恰好敲在鼓点附近(±110ms)额外加分 + 金色大特效；判定其余不变(偏拍照常命中)
      const onBeat = offBeatMs(now) < 110;
      game.combo++; game.score += (perfect ? 15 : 10) + game.combo * 2 + (onBeat ? 8 : 0);
      sfxHit(midi, perfect, game.combo); if (k) fx(k.cx, kb.keyTop, onBeat ? GOLD : colFor(midi), perfect || onBeat);
      const L = LEVELS[game.curLevel];
      bear.pos = Math.max(0.04, bear.pos - L.bounce * 0.6);
      bear.vel = -(L.bounce * 0.5 * (perfect ? 1.3 : 1));
      bear.hop = 1; bear.flash = 1;
      if (game.combo > 0 && game.combo % 10 === 0) { ui.showToast('🔥 ' + game.combo + ' 连击！', '#FF6B9D'); sfxCombo(); bear.pos = Math.max(0.04, bear.pos - 0.1); }
      checkPass();
    } else {
      game.combo = 0; hurtBear(); if (k) fx(k.cx, kb.keyTop, ['#888', '#aaa'], false); sfxMiss();
    }
    ui.refreshHUD();
  } catch (e) { logErr('press', e); }
}

function hurtBear() { bear.pos = Math.min(0.97, bear.pos + 0.06); bear.vel += 0.02; }

function missTimeout() { game.combo = 0; hurtBear(); sfxMiss(); ui.refreshHUD(); }

function checkPass() { if (game.score >= LEVELS[game.curLevel].goal) levelClear(); }

// 每拍触发(来自鼓机的 'beat' 事件，已对齐到可听见的鼓点)：刷新节拍锚点 + 卡鼓点生成地鼠。
function onBeat(beatMs, strong) {
  game.lastBeatAt = performance.now(); game.beatMs = beatMs;
  if (!game.running || game.paused) return;
  const L = LEVELS[game.curLevel];
  if (game.lastBeatAt >= game.nextSpawn && game.moles.length < L.maxActive) {
    spawnMole();
    game.nextSpawn = game.lastBeatAt + L.spawn[0] + Math.random() * (L.spawn[1] - L.spawn[0]);
  }
}

function tick(now) {
  try {
    const dt = game.lastTickTime ? Math.min(0.05, (now - game.lastTickTime) / 1000) : 0.016; game.lastTickTime = now;
    game.waterPhase += dt * 1.5;
    if (game.beatPulse > 0) game.beatPulse *= 0.88;
    if (game.running && !game.paused) applySink(dt);
    decayAnim();
    if (game.running && !game.paused) {
      const L = LEVELS[game.curLevel];
      // 正常情况下生成由鼓点(onBeat)驱动以卡拍；仅当拍源停摆(关 BGM/音频失败)>500ms 时，
      // 退回墙钟追赶式生成，保证无论有没有音乐都能玩、不卡死。
      if (now - game.lastBeatAt > 500) {
        let guard = 0;
        while (now >= game.nextSpawn && game.moles.length < L.maxActive && guard < 5) {
          spawnMole();
          game.nextSpawn = now + L.spawn[0] + Math.random() * (L.spawn[1] - L.spawn[0]);
          guard++;
        }
        if (now >= game.nextSpawn && game.moles.length >= L.maxActive) game.nextSpawn = now + 300;
      }
      // 看门狗:若太久没有任何地鼠(>spawn上限的1.5倍),强制冒一个,杜绝卡死
      if (game.moles.length === 0 && now - game.lastMoleTime > L.spawn[1] * 1.5) { spawnMole(); game.nextSpawn = now + L.spawn[0]; }
      for (let i = game.moles.length - 1; i >= 0; i--) {
        const m = game.moles[i]; const left = 1 - (now - m.born) / m.ttl;
        if (!m.ticked && left < 0.3) { m.ticked = true; sfxTick(); }
        if (now - m.born > m.ttl) { game.moles.splice(i, 1); missTimeout(); }
      }
      spawnWatchdog(now, game, L); // 生成停摆时打印现场快照
    }
    draw(now);
  } catch (e) { logErr('tick', e); }
  requestAnimationFrame(tick);
}

async function startGame(i) {
  if (typeof i === 'number') game.curLevel = i;
  try { await initAudio(); setMusicTier(LEVELS[game.curLevel].music || 0); startBgm(); } catch (e) { logErr('initAudio', e); }
  game.score = 0; game.combo = 0; game.moles = [];
  Object.assign(bear, { pos: 0.2, vel: 0, hop: 0, flash: 0 });
  game.breaking = false; game.lastTickTime = 0;
  particles.length = 0; ripples.length = 0; game.lastMoleTime = performance.now();
  game.nextSpawn = performance.now() + 1200; game.running = true; game.paused = false;
  layoutKeys(); ui.refreshHUD(); ui.hideOverlay(); ui.enterPlayUI();
}

function levelClear() {
  // 关键状态/存档/弹窗优先，音效放最后——副作用绝不能阻断过关流程（P0 教训）。
  game.running = false; ui.exitPlayUI();
  let unlockedNew = false;
  if (game.curLevel + 1 < LEVELS.length && game.curLevel + 1 >= prog.unlocked) { prog.unlocked = game.curLevel + 2; persist(); unlockedNew = true; }
  if (game.score > prog.best) { prog.best = game.score; persist(); }
  ui.showLevelClear(unlockedNew);
  sfxLevel();
}

function gameOver() {
  game.running = false; ui.exitPlayUI();
  duckBgm(); if (game.score > prog.best) { prog.best = game.score; persist(); }
  ui.showGameOver();
}

function pauseToggle() {
  game.paused = !game.paused; ui.setPaused(game.paused);
  if (!game.paused) { game.nextSpawn = performance.now() + 600; game.lastTickTime = 0; }
}

// 覆盖层显示时（游戏未进行），连敲两下同一个琴键 = 触发主操作（开始/下一关/重来），
// 让玩家手不用离开电钢琴。双击避免刚过关那一下顺手误触。
let lastAdvKey = null, lastAdvTime = 0;
function pressForAdvance(midi) {
  if (game.running || game.breaking) { lastAdvKey = null; return; }
  const now = performance.now();
  if (midi === lastAdvKey && now - lastAdvTime < 600) { lastAdvKey = null; ui.triggerPrimary(); }
  else { lastAdvKey = midi; lastAdvTime = now; }
}

// 注册事件监听（输入/UI/物理 通过事件总线回流到这里）
export function initGame() {
  on('press', (midi, vel) => press(midi, vel));
  on('press', midi => pressForAdvance(midi));
  on('beat', (ms, strong) => onBeat(ms, strong));
  on('start', i => startGame(i));
  on('pauseToggle', pauseToggle);
  on('gameOver', gameOver);
}

export { tick };
