// ================= 通用 Canvas 绘制 =================
// 背景拖影、琴键、目标圈、提示手、粒子/水波。小熊由 bear.js 负责。
import { ctx, view, game, kb, flashMap, particles, ripples, keyFor, colFor } from './state.js';
import { midiName, FINGER_COLORS } from './levels.js';
import { drawBear } from './bear.js';

// 命中特效：爆粒子 + 扩散水波
export function fx(cx, cy, pal, big) {
  const n = big ? 40 : 24;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI - Math.PI, sp = (big ? 11 : 6) * (0.4 + Math.random());
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, r: 2 + Math.random() * 4, life: 1, color: pal[Math.random() < 0.5 ? 0 : 1] });
  }
  ripples.push({ x: cx, y: cy, r: 6, max: big ? 140 : 80, life: 1, color: pal[0] });
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
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
  kb.keys.forEach(k => { ctx.beginPath(); ctx.moveTo(k.x, 0); ctx.lineTo(k.x, kb.keyTop); ctx.stroke(); });
  if (game.running || game.breaking) drawBear(now);
  if (game.running) {
    game.moles.forEach(m => {
      const k = keyFor(m.midi); if (!k) return; const pal = colFor(m.midi);
      // 半径随节拍脉冲涨缩：强拍时目标圈"涨"一下，给玩家预判踩点的视觉锚（P2）
      const left = 1 - (now - m.born) / m.ttl; const cy = kb.keyTop - 95; const R = Math.min(k.w * 0.4, 52) * (1 + game.beatPulse * 0.12);
      ctx.beginPath(); ctx.arc(k.cx, cy, R, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
      ctx.strokeStyle = left < 0.3 ? '#FF8585' : pal[0]; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.arc(k.cx, cy, R * 0.62, 0, 7); ctx.fillStyle = pal[0]; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(midiName(m.midi), k.cx, cy - 6);
      ctx.fillStyle = FINGER_COLORS[k.finger]; ctx.beginPath(); ctx.arc(k.cx, cy + 16, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1a22'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(k.finger, k.cx, cy + 16); ctx.textBaseline = 'alphabetic';
    });
  }
  kb.keys.forEach(k => {
    const lit = flashMap[k.midi] > now; const hasMole = game.running && game.moles.some(m => m.midi === k.midi);
    ctx.fillStyle = lit ? '#9DE5B5' : (hasMole ? '#FFE9B0' : '#f4f4f8');
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
}
