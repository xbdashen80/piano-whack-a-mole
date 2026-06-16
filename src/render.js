// ================= 通用 Canvas 绘制 =================
// 背景拖影、琴键、目标圈、提示手、粒子/水波。小熊由 bear.js 负责。
import { ctx, view, game, kb, flashMap, particles, ripples, popups, keyFor, colFor } from './state.js';
import { midiName, FINGER_COLORS } from './levels.js';
import { drawBear } from './bear.js';

const GOLD_PAL = ['#FFD166', '#FFF1B8']; // 金鼠调色板

// 命中特效：爆粒子 + 扩散水波
export function fx(cx, cy, pal, big) {
  // 连击越高，爆得越多越散 → 画面越"热"
  const boost = Math.min(game.combo, 30);
  const n = (big ? 40 : 24) + boost;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI - Math.PI, sp = (big ? 11 : 6) * (0.4 + Math.random()) * (1 + boost * 0.02);
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, r: 2 + Math.random() * 4, life: 1, color: pal[Math.random() < 0.5 ? 0 : 1] });
  }
  ripples.push({ x: cx, y: cy, r: 6, max: (big ? 140 : 80) + boost * 3, life: 1, color: pal[0] });
}

// 连击热度配色：越高越烫(暖→橙→红→品红)
function comboRGB(c) {
  if (c >= 30) return '255,80,160';
  if (c >= 20) return '255,70,70';
  if (c >= 10) return '255,150,40';
  return '255,210,120';
}

// 屏幕空间叠加层：狂热 + 连击光晕 + 中央大连击数字 + 分数弹字 + 冲击白闪（均不随震屏抖动）
function drawOverlays(now) {
  // 狂热槽（非狂热时显示，蓄满即进狂热）
  if (game.running && !game.fever && game.feverGauge > 0.001) {
    const gw = Math.min(360, view.W * 0.5), gx = (view.W - gw) / 2, gy = 64, gh = 10, f = game.feverGauge;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = f > 0.8 ? '#FFD166' : '#FF9D5C'; ctx.fillRect(gx, gy, gw * f, gh);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🔥 狂热槽', view.W / 2, gy - 4); ctx.globalAlpha = 1;
  }
  // 狂热中：全场金色脉冲滤镜 + 中央跳动横幅
  if (game.running && game.fever) {
    ctx.fillStyle = `rgba(255,190,50,${0.10 + 0.06 * Math.abs(Math.sin(now / 120))})`; ctx.fillRect(0, 0, view.W, view.H);
    const s = 1 + 0.08 * Math.sin(now / 80);
    ctx.save(); ctx.translate(view.W / 2, 92); ctx.scale(s, s);
    ctx.fillStyle = '#FFD166'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔥 FEVER 🔥', 0, 0); ctx.restore(); ctx.textBaseline = 'alphabetic';
  }
  const rgb = comboRGB(game.combo);
  if (game.running && !game.fever && game.combo >= 3) {
    const it = Math.min(game.combo / 30, 1);
    const g = ctx.createRadialGradient(view.W / 2, view.H / 2, Math.min(view.W, view.H) * 0.3, view.W / 2, view.H / 2, Math.max(view.W, view.H) * 0.72);
    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},${0.28 * it})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, view.W, view.H);
  }
  if (game.running && game.combo >= 5) {
    const scale = 1 + game.comboFlash * 0.5;
    ctx.save(); ctx.translate(view.W / 2, kb.keyTop - 210); ctx.scale(scale, scale);
    ctx.globalAlpha = 0.92; ctx.fillStyle = `rgb(${rgb})`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 64px sans-serif'; ctx.fillText(game.combo, 0, 0);
    ctx.font = 'bold 20px sans-serif'; ctx.fillText('连击', 0, 44);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]; p.y += p.vy; p.vy *= 0.96; p.life -= 0.02;
    ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
    ctx.font = `bold ${Math.round(22 * (p.scale || 1))}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.text, p.x, p.y);
    if (p.life <= 0) popups.splice(i, 1);
  }
  ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
  if (game.impactFlash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${game.impactFlash * 0.22})`; ctx.fillRect(0, 0, view.W, view.H); }
}

function drawHand(x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(0, 30, 34, 26, 0, 0, 7); ctx.fill();
  const fingers = [{ a: -60, len: 46, n: 5 }, { a: -30, len: 54, n: 4 }, { a: 0, len: 60, n: 3 }, { a: 30, len: 54, n: 2 }, { a: 62, len: 40, n: 1 }];
  fingers.forEach(f => {
    const rad = f.a * Math.PI / 180; const ex = Math.sin(rad) * f.len, ey = 10 - Math.cos(rad) * f.len;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(Math.sin(rad) * 14, 10 - Math.cos(rad) * 14); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = FINGER_COLORS[f.n]; ctx.beginPath(); ctx.arc(ex, ey, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1a22'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(f.n, ex, ey);
  });
  ctx.restore(); ctx.textBaseline = 'alphabetic';
}

export function draw(now) {
  ctx.fillStyle = 'rgba(10,10,20,0.3)'; ctx.fillRect(0, 0, view.W, view.H);
  // 震屏：把整个游戏层随机位移一点（背景拖影已铺满全屏，位移露出的边缘仍是暗底）
  const sx = game.shake ? (Math.random() * 2 - 1) * game.shake : 0;
  const sy = game.shake ? (Math.random() * 2 - 1) * game.shake : 0;
  ctx.save(); ctx.translate(sx, sy);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
  kb.keys.forEach(k => { ctx.beginPath(); ctx.moveTo(k.x, 0); ctx.lineTo(k.x, kb.keyTop); ctx.stroke(); });
  if (game.running || game.breaking) drawBear(now);
  if (game.running) {
    game.moles.forEach((m, mi) => {
      const k = keyFor(m.midi); if (!k) return; const pal = m.gold ? GOLD_PAL : colFor(m.midi);
      // 必须按出现顺序敲：moles[0] 是最早出现=当前目标(高亮)，其余变暗表示"还没轮到"
      const isNext = mi === 0; const a = isNext ? 1 : 0.34;
      // 半径随节拍脉冲涨缩：强拍时目标圈"涨"一下，给玩家预判踩点的视觉锚（P2）
      const left = 1 - (now - m.born) / m.ttl; const cy = kb.keyTop - 95; const R = Math.min(k.w * 0.4, 52) * (1 + game.beatPulse * 0.12);
      if (m.gold) { // 金鼠：一圈脉冲金色光晕，"贵气"更打眼
        ctx.globalAlpha = (0.35 + 0.3 * Math.abs(Math.sin(now / 150))) * a;
        ctx.beginPath(); ctx.arc(k.cx, cy, R + 16, 0, 7); ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 8; ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (isNext) { // 当前目标加一道脉冲白环，明确"先敲这个"
        ctx.globalAlpha = 0.45 + 0.3 * Math.abs(Math.sin(now / 180));
        ctx.beginPath(); ctx.arc(k.cx, cy, R + 9, 0, 7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(k.cx, cy, R, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
      ctx.strokeStyle = left < 0.3 ? '#FF8585' : pal[0]; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.arc(k.cx, cy, R * 0.62, 0, 7); ctx.fillStyle = pal[0]; ctx.globalAlpha = 0.85 * a; ctx.fill();
      ctx.globalAlpha = a;
      ctx.fillStyle = m.gold ? '#5a4a14' : '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(midiName(m.midi), k.cx, cy - 6);
      ctx.fillStyle = FINGER_COLORS[k.finger]; ctx.beginPath(); ctx.arc(k.cx, cy + 16, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1a22'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(k.finger, k.cx, cy + 16);
      if (m.gold) { ctx.fillStyle = '#FFD166'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('★', k.cx, cy - R - 6); }
      ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
    });
  }
  kb.keys.forEach(k => {
    const lit = flashMap[k.midi] > now;
    const isTarget = game.running && game.moles.length > 0 && game.moles[0].midi === k.midi; // 仅当前目标键亮黄
    ctx.fillStyle = lit ? '#9DE5B5' : (isTarget ? '#FFE9B0' : '#f4f4f8');
    ctx.fillRect(k.x + 1, kb.keyTop, k.w - 2, kb.keyH); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(k.x + 1, kb.keyTop, k.w - 2, kb.keyH);
    ctx.fillStyle = FINGER_COLORS[k.finger]; ctx.beginPath(); ctx.arc(k.cx, kb.keyTop + kb.keyH - 44, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1a22'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(k.finger, k.cx, kb.keyTop + kb.keyH - 44); ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(40,40,60,0.6)'; ctx.font = '15px sans-serif'; ctx.fillText(midiName(k.midi), k.cx, kb.keyTop + kb.keyH - 16);
  });
  if (game.running) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('右手', view.W - 70, kb.keyTop - 150); drawHand(view.W - 70, kb.keyTop - 130, 0.85);
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i]; r.r += (r.max - r.r) * 0.13; r.life -= 0.03;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.strokeStyle = r.color; ctx.globalAlpha = Math.max(0, r.life) * 0.6; ctx.lineWidth = 2; ctx.stroke(); if (r.life <= 0) ripples.splice(i, 1);
  }
  ctx.globalAlpha = 1;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.vy += 0.2; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.life -= 0.014;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.r), 0, 7); ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life); ctx.fill();
    if (p.life <= 0 || p.y > view.H) particles.splice(i, 1);
  }
  ctx.globalAlpha = 1;
  ctx.restore(); // 结束震屏位移
  drawOverlays(now);
}
