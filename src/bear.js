// ================= 小熊 + 滑板 + 水面：绘制与物理 =================
import { ctx, view, bear, game, particles } from './state.js';
import { kb } from './state.js';
import { LEVELS } from './levels.js';
import { sfxSplash } from './audio.js';
import { emit } from './events.js';

// 圆角矩形（小熊/滑板绘制用，render 也复用它）
export function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function bearLayout() {
  const bx = 86; const topY = 110; const waterY = kb.keyTop - 30;
  const by = topY + bear.pos * (waterY - topY) - bear.hop * 26; // hop 把熊往上抬
  return { bx, topY, waterY, by };
}

// ---------- 物理 ----------
// 下沉 + 触底/触水判定（仅在 running && !paused 时调用）
export function applySink(dt) {
  const L = LEVELS[game.curLevel];
  bear.vel += L.sink * dt * 0.8; bear.vel *= 0.90; bear.vel = Math.min(bear.vel, 0.012);
  bear.pos += bear.vel;
  if (bear.pos < 0.04) { bear.pos = 0.04; bear.vel = 0; }
  if (bear.pos >= 1) { bear.pos = 1; game.running = false; bearFall(); }
}

// hop / flash 衰减（每帧都跑）
export function decayAnim() {
  if (bear.hop > 0) bear.hop *= 0.85;
  if (bear.flash > 0) bear.flash *= 0.9;
}

export function bearFall() {
  if (game.breaking) return; game.breaking = true; sfxSplash();
  const layout = bearLayout();
  for (let i = 0; i < 30; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, sp = 4 + Math.random() * 8;
    particles.push({ x: layout.bx, y: layout.waterY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3 + Math.random() * 5, life: 1, color: '#9DD6FF' });
  }
  setTimeout(() => { game.breaking = false; emit('gameOver'); }, 700);
}

// ---------- 绘制 ----------
function drawWater(waterY) {
  // 水面:一条带波浪的横向水体,占左侧一条
  const left = 18, right = 160, top = waterY;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(left, top);
  for (let x = left; x <= right; x += 8) { const y = top + Math.sin(x * 0.12 + game.waterPhase * 2) * 3; ctx.lineTo(x, y); }
  ctx.lineTo(right, view.H); ctx.lineTo(left, view.H); ctx.closePath();
  ctx.fillStyle = 'rgba(70,160,230,0.35)'; ctx.fill();
  ctx.strokeStyle = 'rgba(150,210,255,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(left, top);
  for (let x = left; x <= right; x += 8) { const y = top + Math.sin(x * 0.12 + game.waterPhase * 2) * 3; ctx.lineTo(x, y); }
  ctx.stroke(); ctx.restore();
}

export function drawBear(now) {
  const { bx, waterY, by } = bearLayout();
  const danger = bear.pos; // 0安全 1沉
  drawWater(waterY);
  // 滑板(随 hop 轻微倾斜)
  const tilt = Math.sin(now / 120) * 0.04 - bear.hop * 0.1;
  ctx.save(); ctx.translate(bx, by + 34); ctx.rotate(tilt);
  ctx.fillStyle = '#8B5A2B';
  rr(-34, -7, 68, 14, 7); ctx.fill();
  ctx.fillStyle = '#5C3A1A';
  ctx.beginPath(); ctx.arc(-22, 9, 5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(22, 9, 5, 0, 7); ctx.fill();
  ctx.restore();
  // 身体
  const beat = 1 + game.beatPulse * 0.06 + bear.hop * 0.12;
  ctx.save(); ctx.translate(bx, by); ctx.scale(beat, beat);
  // 耳朵
  ctx.fillStyle = '#C8893E';
  ctx.beginPath(); ctx.arc(-15, -26, 8, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(15, -26, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#E8B774';
  ctx.beginPath(); ctx.arc(-15, -26, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(15, -26, 4, 0, 7); ctx.fill();
  // 身体
  ctx.fillStyle = '#D89A4E';
  rr(-18, -6, 36, 34, 14); ctx.fill();
  // 肚皮
  ctx.fillStyle = '#F2D9A8';
  ctx.beginPath(); ctx.ellipse(0, 12, 11, 13, 0, 0, 7); ctx.fill();
  // 手:害怕时举起来
  ctx.fillStyle = '#C8893E';
  const armUp = danger * 18;
  ctx.beginPath(); ctx.arc(-19, 4 - armUp, 6, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(19, 4 - armUp, 6, 0, 7); ctx.fill();
  // 头
  ctx.fillStyle = '#E0A85A';
  ctx.beginPath(); ctx.arc(0, -20, 18, 0, 7); ctx.fill();
  // 口鼻
  ctx.fillStyle = '#F2D9A8'; ctx.beginPath(); ctx.ellipse(0, -14, 9, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#5C3A1A'; ctx.beginPath(); ctx.arc(0, -16, 2.5, 0, 7); ctx.fill();
  // 眼睛 + 表情(随危险变化)
  drawBearFace(danger);
  ctx.restore();
  // 危险文字
  ctx.fillStyle = danger > 0.65 ? '#FF8585' : 'rgba(255,255,255,0.6)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(danger > 0.75 ? '快掉水里了!' : (danger > 0.5 ? '撑住!' : '小熊'), bx, waterY + 18);
}

function drawBearFace(danger) {
  ctx.fillStyle = '#3A2410';
  if (danger < 0.4) {
    // 开心:弯弯眼 + 微笑
    ctx.lineWidth = 2; ctx.strokeStyle = '#3A2410';
    ctx.beginPath(); ctx.arc(-7, -22, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(7, -22, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -12, 4, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    // 腮红
    ctx.fillStyle = 'rgba(255,150,150,0.5)'; ctx.beginPath(); ctx.arc(-11, -13, 3, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(11, -13, 3, 0, 7); ctx.fill();
  } else if (danger < 0.7) {
    // 紧张:圆眼 + 直嘴
    ctx.beginPath(); ctx.arc(-7, -22, 3, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(7, -22, 3, 0, 7); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#3A2410';
    ctx.beginPath(); ctx.moveTo(-4, -11); ctx.lineTo(4, -11); ctx.stroke();
    // 汗滴
    ctx.fillStyle = 'rgba(120,200,255,0.9)'; ctx.beginPath(); ctx.arc(15, -24, 3, 0, 7); ctx.fill();
  } else {
    // 惊恐:大圆眼 + 张嘴 O + 抖
    const j = Math.sin(performance.now() / 40) * 1.5;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-7 + j, -23, 4.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(7 + j, -23, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#3A2410'; ctx.beginPath(); ctx.arc(-7 + j, -22, 2.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(7 + j, -22, 2.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#7A2A2A'; ctx.beginPath(); ctx.ellipse(0, -10, 3.5, 4.5, 0, 0, 7); ctx.fill();
    // 大汗
    ctx.fillStyle = 'rgba(120,200,255,0.95)'; ctx.beginPath(); ctx.arc(16, -24, 3.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(-16, -20, 3, 0, 7); ctx.fill();
  }
}
