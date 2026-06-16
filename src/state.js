// ================= 共享状态中枢 =================
// 集中持有：画布引用、视口尺寸、存档、可变游戏状态、键盘几何。
// 其它模块都从这里读写状态，以此打破彼此的循环依赖。
import { LEVELS, WHITE, palettes, fingerFor } from './levels.js';

export const canvas = document.getElementById('canvas');
export const ctx = canvas.getContext('2d');

// 视口尺寸（resize 时更新）
export const view = { W: 0, H: 0 };

// ---------- 存档 ----------
const SAVE = 'piano_bear_v1';
function load() { try { return JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e) { return {}; } }
export const prog = load();
prog.best = prog.best || 0;
prog.unlocked = prog.unlocked || 1;
export function persist() { try { localStorage.setItem(SAVE, JSON.stringify(prog)); } catch (e) {} }

// ---------- 可变游戏状态 ----------
export const game = {
  curLevel: 0,
  running: false,
  paused: false,
  breaking: false,
  score: 0,
  combo: 0,
  moles: [],
  nextSpawn: 0,
  lastTickTime: 0,
  lastMoleTime: 0,
  musicTier: 0,
  waterPhase: 0,
  beatPulse: 0,
  lastBeatAt: 0,   // 最近一拍触发时刻(performance.now)，供踩点判定算"离鼓点多远"
  beatMs: 0,       // 当前一拍毫秒长(60/bpm*1000)；0=尚无拍/拍源停摆
  // ---- 打击感(game juice)：均为每帧衰减的瞬时量 ----
  shake: 0,        // 震屏强度(px)，draw 里随机位移、tick 里衰减
  comboFlash: 0,   // 连击数字打击脉冲(命中=1)，驱动中央大连击数字的缩放
  impactFlash: 0,  // 全屏白闪(连击里程碑时爆一下)
};

// 小熊: pos 0(高,安全)→1(沉入水). vel速度. hop跳跃动画. flash高亮.
export const bear = { pos: 0.2, vel: 0, hop: 0, flash: 0 };

export const particles = [];
export const ripples = [];
export const popups = [];   // 分数弹字 {x,y,text,color,life,vy,scale}
export const flashMap = {};

// ---------- 键盘几何 ----------
export const kb = { keys: [], keyTop: 0, keyH: 0, activeKeyMidis: [] };

export function layoutKeys() {
  kb.keys = [];
  const n = LEVELS[game.curLevel].keys;
  kb.activeKeyMidis = WHITE.slice(0, n);
  kb.keyH = Math.min(230, view.H * 0.34);
  kb.keyTop = view.H - kb.keyH;
  const ww = view.W / n;
  kb.activeKeyMidis.forEach((m, i) => kb.keys.push({ midi: m, x: i * ww, w: ww, cx: i * ww + ww / 2, finger: fingerFor(i) }));
}

export function keyFor(m) { return kb.keys.find(k => k.midi === m); }

export function colFor(m) {
  const i = kb.activeKeyMidis.indexOf(m);
  return palettes[(i < 0 ? 0 : i) % palettes.length];
}

export function resize() {
  view.W = canvas.width = innerWidth;
  view.H = canvas.height = innerHeight;
  layoutKeys();
}
