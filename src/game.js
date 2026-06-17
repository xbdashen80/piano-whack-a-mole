// ================= 主循环 + 状态机 + 判定 + 计分 + 过关/失败 =================
import { game, bear, particles, ripples, popups, flashMap, prog, persist, layoutKeys, layoutSongKeys, keyFor, colFor, kb, view } from './state.js';
import { LEVELS, SONGS } from './levels.js';
import { initAudio, setMusicTier, startBgm, stopBgm, sfxHit, sfxCombo, sfxMiss, sfxLevel, sfxTick, sfxFever, sfxGold, sfxBomb, sfxGameOver, sfxGuide, duckBgm } from './audio.js';
import { fx, fxBoom, draw, drawSong } from './render.js';
import { applySink, decayAnim } from './bear.js';
import { on } from './events.js';
import { logErr, spawnWatchdog } from './diagnostics.js';
import * as ui from './ui.js';

const flash = m => { flashMap[m] = performance.now() + 150; };
const GOLD = ['#FFD166', '#FFE9A8']; // 踩中鼓点的金色特效调色板
let advancing = false; // 过关进下一关时为真：让狂热槽跨关累积，不被 startGame 清零
const BOMB_FROM_LEVEL = 24; // 0 基：进阶·穿指轨(第25关)起才出炸弹——五指位主体全程无炸弹，纯练习

// 当前时刻离最近一拍有多近(ms)；用于踩点奖励。无拍源(beatMs=0)时返回极大值=永不踩中。
function offBeatMs(now) {
  if (!game.beatMs) return 1e9;
  const ph = ((now - game.lastBeatAt) % game.beatMs + game.beatMs) % game.beatMs;
  return Math.min(ph, game.beatMs - ph);
}

// 同屏地鼠上限 / 下次生成间隔——狂热时更密(上限+1、间隔×0.7)
function curMaxActive() { return LEVELS[game.curLevel].maxActive + (game.fever ? 1 : 0); }
function nextSpawnGap() { const L = LEVELS[game.curLevel]; return (L.spawn[0] + Math.random() * (L.spawn[1] - L.spawn[0])) * (game.fever ? 0.7 : 1); }

function spawnMole() {
  try {
    if (game.moles.length >= curMaxActive()) return;
    const busy = game.moles.map(m => m.midi); const avail = kb.activeKeyMidis.filter(m => !busy.includes(m));
    if (!avail.length) return; const midi = avail[Math.floor(Math.random() * avail.length)];
    // 炸弹致命：仅后段(关卡≥下限)、且场上已有可敲的非炸弹地鼠时才放 10%——前期纯练习无炸弹，
    // 且保证炸弹出现时玩家总有安全目标(不会无键可按)。金鼠 25%（独立掷骰）。
    const bomb = game.curLevel >= BOMB_FROM_LEVEL && Math.random() < 0.10 && game.moles.some(m => !m.bomb);
    const gold = !bomb && Math.random() < 0.25;
    const ttl = LEVELS[game.curLevel].ttl * (bomb ? 0.7 : 1); // 炸弹 ttl 短些，少占位、减少死等
    game.moles.push({ midi, born: performance.now(), ttl, ticked: false, gold, bomb }); game.lastMoleTime = performance.now();
  } catch (e) { logErr('spawnMole', e); }
}

// 狂热槽：命中蓄(perfect/踩点更多)，满则进入狂热；失误掉一截。
function addFever(amount) {
  if (game.fever) return;
  game.feverGauge = Math.min(1, game.feverGauge + amount);
  if (game.feverGauge >= 1) startFever();
}
function startFever() {
  game.fever = true; game.feverUntil = performance.now() + 8000; game.feverGauge = 1;
  game.impactFlash = 1; game.shake = 16;
  ui.showToast('🔥🔥 FEVER! 分数翻倍！', '#FFD166'); sfxFever();
}
function endFever() { game.fever = false; game.feverGauge = 0; }

function press(midi, vel) {
  try {
    if (!game.running) return;
    if (game.mode === 'song') { songPress(midi); return; } // 歌曲模式走音高顺序判定
    flash(midi);
    const now = performance.now();
    const k = keyFor(midi);
    const pressed = game.moles.find(mm => mm.midi === midi);
    // 炸弹鼠：千万别敲——敲到即 game over（震撼爆炸 + 结束音效）；放着让它自己消失则无事
    if (pressed && pressed.bomb) {
      game.moles.splice(game.moles.indexOf(pressed), 1);
      sfxBomb();
      // 震撼爆炸：顿帧定格猛抖 + 大团碎片 + 多重冲击波 + 强红闪 + 一记白爆
      if (k) fxBoom(k.cx, kb.keyTop);
      game.hitStop = 90; game.shake = 46; game.bombFlash = 1; game.impactFlash = Math.max(game.impactFlash, 0.9);
      popups.push({ x: k ? k.cx : view.W / 2, y: kb.keyTop - 120, text: '💥 炸弹!', color: '#FF5252', life: 1.3, vy: -1.6, scale: 2.3 });
      gameOver(); return;
    }
    // 必须按出现顺序敲：当前目标 = 最早出现的"非炸弹"地鼠；按错或越级 = 失误
    const ti = game.moles.findIndex(mm => !mm.bomb); const m = ti >= 0 ? game.moles[ti] : null;
    if (m && m.midi === midi) {
      game.moles.splice(ti, 1);
      const ratio = (now - m.born) / m.ttl; const perfect = ratio < 0.5;
      // 踩点奖励：恰好敲在鼓点附近(±110ms)额外加分 + 金色大特效；判定其余不变(偏拍照常命中)
      const onBeat = offBeatMs(now) < 110;
      game.combo++;
      const goldHit = m.gold; // 金鼠：分数×5
      const gain = ((perfect ? 15 : 10) + game.combo * 2 + (onBeat ? 8 : 0)) * (game.fever ? 2 : 1) * (goldHit ? 5 : 1); game.score += gain;
      sfxHit(midi, perfect, game.combo); if (goldHit) { sfxGold(); game.impactFlash = Math.max(game.impactFlash, 0.7); } // 金鼠爆一下闪光，更有"中大奖"感
      if (k) fx(k.cx, kb.keyTop, (goldHit || onBeat || game.fever) ? GOLD : colFor(midi), goldHit || perfect || onBeat || game.fever);
      addFever(0.07 + (perfect ? 0.02 : 0) + (onBeat ? 0.03 : 0) + Math.min(game.combo, 25) * 0.003 + (goldHit ? 0.2 : 0)); // 蓄狂热槽：连击越高填越快，金鼠额外猛涨
      // 打击感：震屏(踩点/perfect/金鼠/高连击更狠) + 分数弹字 + 连击脉冲
      const big = perfect || onBeat || goldHit;
      game.shake = Math.min(13, game.shake + (big ? 7 : 4) + Math.min(game.combo, 20) * 0.25);
      game.comboFlash = 1;
      popups.push({ x: k ? k.cx : view.W / 2, y: kb.keyTop - 110, text: '+' + gain, color: (goldHit || onBeat || game.fever) ? '#FFD166' : (perfect ? '#9DE5B5' : '#FFFFFF'), life: 1, vy: -1.7, scale: big || game.fever ? 1.35 : 1 });
      const L = LEVELS[game.curLevel];
      bear.pos = Math.max(0.04, bear.pos - L.bounce * 0.6);
      bear.vel = -(L.bounce * 0.5 * (perfect ? 1.3 : 1));
      bear.hop = 1; bear.flash = 1;
      if (game.combo > 0 && game.combo % 10 === 0) { ui.showToast('🔥 ' + game.combo + ' 连击！', '#FF6B9D'); sfxCombo(); bear.pos = Math.max(0.04, bear.pos - 0.1); game.shake = 16; game.impactFlash = 1; }
      checkPass();
    } else {
      // 越级：按的键对应一个还没轮到的(非炸弹)地鼠 → 提示"按顺序"；否则就是普通按空
      const outOfOrder = !!pressed; // 走到这里 pressed 必为非炸弹、且非当前目标
      game.combo = 0; hurtBear(); if (k) fx(k.cx, kb.keyTop, ['#888', '#aaa'], false); sfxMiss();
      game.shake = Math.min(10, game.shake + 5); game.feverGauge *= 0.6;
      popups.push({ x: k ? k.cx : view.W / 2, y: kb.keyTop - 100, text: outOfOrder ? '按顺序!' : 'Miss', color: outOfOrder ? '#FFC371' : '#FF8585', life: 1, vy: -1.2, scale: 1 });
    }
    ui.refreshHUD();
  } catch (e) { logErr('press', e); }
}

function hurtBear() { bear.pos = Math.min(0.97, bear.pos + 0.06); bear.vel += 0.02; }

function missTimeout() { game.combo = 0; hurtBear(); sfxMiss(); game.shake = Math.min(9, game.shake + 4); game.feverGauge *= 0.6; ui.refreshHUD(); }

function checkPass() { if (game.score >= LEVELS[game.curLevel].goal) levelClear(); }

// 每拍触发(来自鼓机的 'beat' 事件，已对齐到可听见的鼓点)：刷新节拍锚点 + 卡鼓点生成地鼠。
function onBeat(beatMs, strong) {
  game.lastBeatAt = performance.now(); game.beatMs = beatMs;
  if (!game.running || game.paused || game.mode === 'song') return;
  if (game.lastBeatAt >= game.nextSpawn && game.moles.length < curMaxActive()) {
    spawnMole();
    game.nextSpawn = game.lastBeatAt + nextSpawnGap();
  }
}

// ================= 歌曲模式：按音高顺序弹一首真歌 =================
// 共用 'press' 输入与主循环；判定只看音高顺序（关卡 1 不判节奏、不判指法——输入层无指法信息，
// finger 仅作教学提示）。弹错只给提示、不中断、不失败（零基础友好，副作用绝不阻断状态机）。
function songPress(midi) {
  const s = game.song; if (!s || game.paused) return;
  const target = s.notes[s.ptr]; if (!target) return;
  flash(midi);
  const k = keyFor(midi);
  if (midi === target.midi) {
    s.ptr++; game.combo++;
    sfxHit(midi, true, 0); // 用真实音高发声，让玩家"听见自己弹的旋律"
    if (k) fx(k.cx, kb.keyTop, colFor(midi), true);
    const gain = 10 + game.combo * 2; game.score += gain;
    game.comboFlash = 1; game.shake = Math.min(8, game.shake + 3);
    popups.push({ x: k ? k.cx : view.W / 2, y: kb.keyTop - 110, text: '♪ +' + gain, color: '#9DE5B5', life: 1, vy: -1.6, scale: 1.1 });
    bear.flash = 1;
    if (game.combo > 0 && game.combo % 10 === 0) { ui.showToast('🎵 连对 ' + game.combo + ' 个音！', '#5DCAA5'); sfxCombo(); }
    ui.refreshHUD();
    if (s.ptr >= s.notes.length) songClear();
  } else {
    // 弹错：清连击 + 轻提示，明确"该弹哪个音"，但不前进、不中断
    game.combo = 0;
    if (k) fx(k.cx, kb.keyTop, ['#888', '#aaa'], false); sfxMiss();
    sfxGuide(target.midi); // 弹错就把"该弹的音"播给你听——不懂乐理也能照着找
    game.shake = Math.min(7, game.shake + 4);
    popups.push({ x: k ? k.cx : view.W / 2, y: kb.keyTop - 100, text: '试试 ' + target.pitch, color: '#FFC371', life: 1.1, vy: -1.2, scale: 1 });
    ui.refreshHUD();
  }
}

function tickSong(now, dt) {
  // 打击感瞬时量衰减（与打地鼠同款，song 无沉熊/生成逻辑）
  if (game.shake > 0.1) game.shake *= 0.85; else game.shake = 0;
  if (game.comboFlash > 0.01) game.comboFlash *= 0.86; else game.comboFlash = 0;
  if (game.impactFlash > 0.01) game.impactFlash *= 0.82; else game.impactFlash = 0;
  drawSong(now);
}

async function startSong(songKey, levelIdx = 0) {
  const song = SONGS[songKey]; if (!song) return;
  const lvl = song.levels[levelIdx]; if (!lvl) return;
  try { await initAudio(); stopBgm(); } catch (e) { logErr('initAudio', e); } // 关卡 1 无伴奏：静掉鼓机
  game.mode = 'song';
  game.song = { key: songKey, levelIdx, title: song.title, name: lvl.name, notes: lvl.rightHand.slice(), ptr: 0 };
  game.score = 0; game.combo = 0; game.moles = [];
  game.fever = false; game.feverGauge = 0;
  game.shake = 0; game.comboFlash = 0; game.impactFlash = 0; game.bombFlash = 0; game.hitStop = 0;
  Object.assign(bear, { pos: 0.2, vel: 0, hop: 0, flash: 0 });
  particles.length = 0; ripples.length = 0; popups.length = 0; game.lastTickTime = 0;
  layoutSongKeys(game.song.notes);
  game.running = true; game.paused = false;
  ui.setMode('song'); ui.refreshHUD(); ui.hideOverlay(); ui.enterPlayUI();
  ui.showToast('🎵 跟着白色高亮圈弹，弹对自动跳到下一个音', '#5DCAA5');
  const first = game.song.notes[0]; if (first) sfxGuide(first.midi); // 进场先把第一个音播给你听
}

function songClear() {
  // 状态/存档/弹窗优先，音效最后（P0 教训：副作用绝不阻断过关流程）
  game.running = false; const s = game.song;
  if (game.score > prog.best) { prog.best = game.score; persist(); }
  prog.songProgress = prog.songProgress || {};
  prog.songProgress[s.key] = Math.max(prog.songProgress[s.key] || 0, s.levelIdx + 1); persist();
  ui.exitPlayUI(); ui.showSongClear();
  sfxLevel();
}

function tick(now) {
  try {
    const dt = game.lastTickTime ? Math.min(0.05, (now - game.lastTickTime) / 1000) : 0.016; game.lastTickTime = now;
    if (game.mode === 'song') { tickSong(now, dt); requestAnimationFrame(tick); return; }
    // 命中顿帧：定格游戏逻辑(不沉、不生成)，但仍重绘——震屏每帧随机偏移=原地猛抖，闪光保持，冲击力拉满
    if (game.hitStop > 0) { game.hitStop -= dt * 1000; draw(now); requestAnimationFrame(tick); return; }
    game.waterPhase += dt * 1.5;
    if (game.beatPulse > 0) game.beatPulse *= 0.88;
    // 打击感瞬时量衰减
    if (game.shake > 0.1) game.shake *= 0.85; else game.shake = 0;
    if (game.comboFlash > 0.01) game.comboFlash *= 0.86; else game.comboFlash = 0;
    if (game.impactFlash > 0.01) game.impactFlash *= 0.82; else game.impactFlash = 0;
    if (game.bombFlash > 0.01) game.bombFlash *= 0.88; else game.bombFlash = 0;
    if (game.running && !game.paused) applySink(dt);
    decayAnim();
    if (game.running && !game.paused) {
      const L = LEVELS[game.curLevel];
      // 狂热到点结束。槽不随时间回落（只在失误时掉），否则慢速关里蓄不过掉、永远进不了狂热。
      if (game.fever && now > game.feverUntil) endFever();
      // 正常情况下生成由鼓点(onBeat)驱动以卡拍；仅当拍源停摆(关 BGM/音频失败)>500ms 时，
      // 退回墙钟追赶式生成，保证无论有没有音乐都能玩、不卡死。
      if (now - game.lastBeatAt > 500) {
        let guard = 0;
        while (now >= game.nextSpawn && game.moles.length < curMaxActive() && guard < 5) {
          spawnMole();
          game.nextSpawn = now + nextSpawnGap();
          guard++;
        }
        if (now >= game.nextSpawn && game.moles.length >= curMaxActive()) game.nextSpawn = now + 300;
      }
      // 看门狗:若太久没有任何地鼠(>spawn上限的1.5倍),强制冒一个,杜绝卡死
      if (game.moles.length === 0 && now - game.lastMoleTime > L.spawn[1] * 1.5) { spawnMole(); game.nextSpawn = now + L.spawn[0]; }
      for (let i = game.moles.length - 1; i >= 0; i--) {
        const m = game.moles[i]; const left = 1 - (now - m.born) / m.ttl;
        if (!m.bomb && !m.ticked && left < 0.3) { m.ticked = true; sfxTick(); }
        if (now - m.born > m.ttl) { game.moles.splice(i, 1); if (!m.bomb) missTimeout(); } // 炸弹自己消失=正确躲避，无惩罚
      }
      spawnWatchdog(now, game, L); // 生成停摆时打印现场快照
    }
    draw(now);
  } catch (e) { logErr('tick', e); }
  requestAnimationFrame(tick);
}

async function startGame(i) {
  if (typeof i === 'number') game.curLevel = i;
  game.mode = 'whack'; game.song = null; ui.setMode('whack'); // 从歌曲模式切回打地鼠时复位
  try { await initAudio(); setMusicTier(LEVELS[game.curLevel].music || 0); startBgm(); } catch (e) { logErr('initAudio', e); }
  game.score = 0; game.combo = 0; game.moles = [];
  game.fever = false; if (!advancing) game.feverGauge = 0; advancing = false; // 过关保留狂热槽，新开/重来才清零
  Object.assign(bear, { pos: 0.2, vel: 0, hop: 0, flash: 0 });
  game.breaking = false; game.lastTickTime = 0;
  particles.length = 0; ripples.length = 0; game.lastMoleTime = performance.now();
  game.nextSpawn = performance.now() + 1200; game.running = true; game.paused = false;
  layoutKeys(); ui.refreshHUD(); ui.hideOverlay(); ui.enterPlayUI();
}

function levelClear() {
  // 关键状态/存档/弹窗优先，音效放最后——副作用绝不能阻断过关流程（P0 教训）。
  game.running = false; advancing = true; ui.exitPlayUI(); // 标记"过关"，下次 startGame 保留狂热槽
  let unlockedNew = false;
  if (game.curLevel + 1 < LEVELS.length && game.curLevel + 1 >= prog.unlocked) { prog.unlocked = game.curLevel + 2; persist(); unlockedNew = true; }
  if (game.score > prog.best) { prog.best = game.score; persist(); }
  ui.showLevelClear(unlockedNew);
  sfxLevel();
}

function gameOver() {
  game.running = false; ui.exitPlayUI();
  duckBgm(); if (game.score > prog.best) { prog.best = game.score; persist(); }
  ui.showGameOver(); sfxGameOver();
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
  on('startSong', (key, idx) => startSong(key, idx));
  on('pauseToggle', pauseToggle);
  on('gameOver', gameOver);
}

export { tick };
