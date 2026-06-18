// ================= 通用 Canvas 绘制 =================
// 背景拖影、琴键、目标圈、提示手、粒子/水波。小熊由 bear.js 负责。
import { ctx, view, game, kb, flashMap, particles, ripples, popups, keyFor, colFor } from './state.js';
import { midiName, FINGER_COLORS } from './levels.js';
import { drawBear } from './bear.js';

const GOLD_PAL = ['#FFD166', '#FFF1B8']; // 金鼠调色板
// 时值→拍数（与 SONG_MODE 数据一致）：歌曲乐谱里音块的宽度按它算
const DUR_BEATS = { eighth: 0.5, quarter: 1, 'dotted-quarter': 1.5, half: 2, 'dotted-half': 3, whole: 4 };
// 圆角矩形路径（不依赖新版 canvas roundRect）
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

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

// 炸弹大爆炸：一大团火花/碎片 + 多重冲击波（比普通命中猛得多）
export function fxBoom(cx, cy) {
  const cols = ['#FF3B3B', '#FF8C42', '#FFD166', '#FFFFFF', '#5a5a5a', '#2b2b33'];
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 18;
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, r: 3 + Math.random() * 8, life: 1, color: cols[(Math.random() * cols.length) | 0] });
  }
  ripples.push({ x: cx, y: cy, r: 16, max: 380, life: 1, color: '#FF4D4D' });
  ripples.push({ x: cx, y: cy, r: 10, max: 280, life: 1, color: '#FFD166' });
  ripples.push({ x: cx, y: cy, r: 6, max: 180, life: 1, color: '#FFFFFF' });
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
  if (game.bombFlash > 0.01) { ctx.fillStyle = `rgba(255,30,30,${Math.min(0.78, game.bombFlash * 0.78)})`; ctx.fillRect(0, 0, view.W, view.H); } // 敲到炸弹：强烈红闪
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
    // 当前目标 = 最早出现的"非炸弹"地鼠（炸弹不进顺序队列，是独立躲避物）
    const tIdx = game.moles.findIndex(m => !m.bomb); const targetMidi = tIdx >= 0 ? game.moles[tIdx].midi : null;
    game.moles.forEach((m, mi) => {
      const k = keyFor(m.midi); if (!k) return;
      const cy = kb.keyTop - 95; const R = Math.min(k.w * 0.4, 52) * (1 + game.beatPulse * 0.12);
      const left = 1 - (now - m.born) / m.ttl; // 倒计时（半径随节拍脉冲涨缩，P2 视觉锚）
      if (m.bomb) { // 炸弹鼠：深色弹体 + 红色危险环 + 💣，全程醒目（别敲）
        const dp = 0.6 + 0.4 * Math.abs(Math.sin(now / 130));
        ctx.globalAlpha = dp; ctx.beginPath(); ctx.arc(k.cx, cy, R + 7, 0, 7); ctx.strokeStyle = '#FF4D4D'; ctx.lineWidth = 5; ctx.stroke();
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(k.cx, cy, R * 0.7, 0, 7); ctx.fillStyle = '#2b2b33'; ctx.fill();
        ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💣', k.cx, cy - 2);
        ctx.fillStyle = FINGER_COLORS[k.finger]; ctx.beginPath(); ctx.arc(k.cx, cy + 18, 10, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a1a22'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(k.finger, k.cx, cy + 18);
        ctx.textBaseline = 'alphabetic'; return;
      }
      const pal = m.gold ? GOLD_PAL : colFor(m.midi);
      const isNext = m.midi === targetMidi; const a = isNext ? 1 : 0.34; // 当前目标高亮，其余变暗
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
    const onKey = game.running ? game.moles.find(m => m.midi === k.midi) : null;
    const isBomb = onKey && onKey.bomb;                      // 炸弹键标红警示"别按"
    const isTarget = !isBomb && game.running && game.moles.some(m => !m.bomb) && game.moles.find(m => !m.bomb).midi === k.midi;
    ctx.fillStyle = lit ? '#9DE5B5' : (isBomb ? '#FFB3B3' : (isTarget ? '#FFE9B0' : '#f4f4f8'));
    ctx.fillRect(k.x + 1, kb.keyTop, k.w - 2, kb.keyH); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(k.x + 1, kb.keyTop, k.w - 2, kb.keyH);
    ctx.fillStyle = FINGER_COLORS[k.finger]; ctx.beginPath(); ctx.arc(k.cx, kb.keyTop + kb.keyH - 44, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1a22'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(k.finger, k.cx, kb.keyTop + kb.keyH - 44); ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(40,40,60,0.6)'; ctx.font = '15px sans-serif'; ctx.fillText(midiName(k.midi), k.cx, kb.keyTop + kb.keyH - 16);
  });
  if (game.running) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('右手', view.W - 115, kb.keyTop - 225); drawHand(view.W - 115, kb.keyTop - 110, 1.7);
  }
  drawFloating();
  ctx.restore(); // 结束震屏位移
  drawOverlays(now);
}

// 命中粒子 + 扩散水波的逐帧推进/绘制（与模式无关，打地鼠/歌曲模式共用）
function drawFloating() {
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

// 歌曲模式：当前/下一个该弹的音的提示圈（音名 + 手指号）。当前=高亮脉冲白环，下一个=弱提示。
function drawSongTarget(note, now, isCurrent) {
  const k = keyFor(note.midi); if (!k) return;
  const cy = kb.keyTop - 95; const R = Math.min(k.w * 0.4, 52);
  const pal = colFor(note.midi); const a = isCurrent ? 1 : 0.32;
  if (isCurrent) { // 当前目标加一道脉冲白环，明确"先弹这个"
    ctx.globalAlpha = 0.45 + 0.3 * Math.abs(Math.sin(now / 180));
    ctx.beginPath(); ctx.arc(k.cx, cy, R + 9, 0, 7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = a;
  ctx.beginPath(); ctx.arc(k.cx, cy, R * 0.62, 0, 7); ctx.fillStyle = pal[0]; ctx.globalAlpha = 0.85 * a; ctx.fill();
  ctx.globalAlpha = a;
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(midiName(note.midi), k.cx, cy - 6);
  ctx.fillStyle = FINGER_COLORS[note.finger] || '#fff'; ctx.beginPath(); ctx.arc(k.cx, cy + 16, 11, 0, 7); ctx.fill();
  ctx.fillStyle = '#1a1a22'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(note.finger, k.cx, cy + 16);
  ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
}

// 歌曲乐谱/五线谱共用的横向时间轴：当前音停在 playX，按 pxPerBeat 把拍位换成 x，整体从右往左滚。
function songAxis() {
  const s = game.song; const playX = view.W * 0.26, pxPerBeat = 48;
  const curBeat = (s.notes[s.ptr] || s.notes[s.notes.length - 1]).startBeat;
  return { playX, pxPerBeat, curBeat, xOf: b => playX + (b - curBeat) * pxPerBeat };
}
// 音高 → 音级序号（C D E F G A B 各算一级），用于五线谱里音符落在哪条线/间。
// 黑键(升号)归到下方白键的音级：C#→C, D#→D, F#→F, G#→G, A#→A（暂不画升号，至少落在正确线区）。
const PC_DIATONIC = { 0: 0, 1: 0, 2: 1, 3: 1, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 6 };
const diatonic = m => (Math.floor(m / 12) - 1) * 7 + (PC_DIATONIC[((m % 12) + 12) % 12] ?? 0);

// 歌曲模式·动态五线谱（高音谱表）：音符头按真实音高落在线/间上、随拍位从右往左滚，当前音绿色高亮+脉冲，
// 超出谱表的高/低音自动补加线。让想认谱的人能照着五线谱跟弹；与下方钢琴卷帘共用同一条"现在"参考线。
function drawStaff(now) {
  const s = game.song; const notes = s.notes; if (!notes.length) return;
  const { playX, curBeat, xOf } = songAxis();
  const gap = 11, midY = 126, DIA_B4 = diatonic(71);     // B4=中线
  const yDia = d => midY - (d - DIA_B4) * (gap / 2);      // 音级 → y（每级半行）
  const left = 44, right = view.W - 8;
  const topY = yDia(38), botY = yDia(30);                 // F5 顶线 / E4 底线
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.3;
  for (let d = 30; d <= 38; d += 2) { const y = yDia(d); ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('五线谱', 4, midY);
  for (let bar = Math.floor(curBeat / 4) * 4; xOf(bar) < right; bar += 4) { const x = xOf(bar); if (x < left) continue; ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, topY); ctx.lineTo(x, botY); ctx.stroke(); }
  // "现在"竖线 + 标签（最上方，两条乐谱共用这条参考线）
  ctx.strokeStyle = 'rgba(157,229,181,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(playX, topY - 24); ctx.lineTo(playX, botY + 8); ctx.stroke();
  ctx.fillStyle = 'rgba(157,229,181,0.95)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▶ 现在', playX, topY - 30);
  notes.forEach((n, i) => {
    const nx = xOf(n.startBeat) + 10; if (nx < left - 10 || nx > right + 10) return;
    const d = diatonic(n.midi), ny = yDia(d), played = i < s.ptr, current = i === s.ptr;
    const col = current ? '#5DCAA5' : (played ? '#888' : '#fff');
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.3;                 // 加线
    for (let L = 40; L <= d; L += 2) { const y = yDia(L); ctx.beginPath(); ctx.moveTo(nx - 10, y); ctx.lineTo(nx + 10, y); ctx.stroke(); }
    for (let L = 28; L >= d; L -= 2) { const y = yDia(L); ctx.beginPath(); ctx.moveTo(nx - 10, y); ctx.lineTo(nx + 10, y); ctx.stroke(); }
    ctx.globalAlpha = played ? 0.3 : 1;
    ctx.strokeStyle = col; ctx.lineWidth = 2; const up = d < DIA_B4;                 // 符干
    ctx.beginPath(); if (up) { ctx.moveTo(nx + 6, ny); ctx.lineTo(nx + 6, ny - 24); } else { ctx.moveTo(nx - 6, ny); ctx.lineTo(nx - 6, ny + 24); } ctx.stroke();
    ctx.save(); ctx.translate(nx, ny); ctx.rotate(-0.35); ctx.fillStyle = col;       // 符头(斜椭圆)
    ctx.beginPath(); ctx.ellipse(0, 0, 6.5, 4.6, 0, 0, 7); ctx.fill(); ctx.restore();
    if (current) { ctx.globalAlpha = 0.4 + 0.4 * Math.abs(Math.sin(now / 180)); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(nx, ny, 11, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
  });
  ctx.textBaseline = 'alphabetic';
}

// 歌曲模式·动态乐谱（钢琴卷帘，五线谱下方一条）：音块按音高排列(高音在上、低音在下)、按拍位从右往左滚，
// 当前该弹的音停在"现在"竖线上脉冲高亮，已弹过的淡出、还没到的弱显示，连线画出旋律走向。
// 比五线谱更直白：直接标音名 + 按手指配色，零基础也能"看见"接下来弹什么、往哪走，照着模仿。
function drawScoreRibbon(now) {
  const s = game.song; const notes = s.notes; if (!notes.length) return;
  const top = 168, bottom = Math.max(top + 86, kb.keyTop - 150); // 五线谱下方的纵向区间
  const { playX, curBeat, xOf } = songAxis();
  const pad = 22;
  const midis = notes.map(n => n.midi); const lo = Math.min(...midis), hi = Math.max(...midis); const span = Math.max(1, hi - lo);
  const yOf = m => bottom - pad - (m - lo) / span * (bottom - top - pad * 2);

  for (let bar = Math.floor(curBeat / 4) * 4; xOf(bar) < view.W; bar += 4) {
    const x = xOf(bar); if (x < 18) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(157,229,181,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(playX, top - 4); ctx.lineTo(playX, bottom + 4); ctx.stroke();
  // 旋律走向连线（看出上行/下行）
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2; ctx.beginPath(); let started = false;
  notes.forEach(n => { const x = xOf(n.startBeat) + 12, y = yOf(n.midi); if (x < -40 || x > view.W + 40) return; if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); });
  ctx.stroke();
  // 音块：音名居中，按手指配色；已弹过淡出、当前脉冲白框、将来弱显示
  notes.forEach((n, i) => {
    const x = xOf(n.startBeat), w = Math.max(26, (DUR_BEATS[n.duration] || 1) * 48 - 8);
    if (x + w < 8 || x > view.W - 4) return;
    const y = yOf(n.midi) - 12, h = 24, played = i < s.ptr, current = i === s.ptr;
    ctx.globalAlpha = played ? 0.22 : (current ? 1 : 0.82);
    rr(x, y, w, h, 7); ctx.fillStyle = FINGER_COLORS[n.finger] || '#9DE5B5'; ctx.fill();
    if (current) { ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(now / 180)); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; rr(x - 2, y - 2, w + 4, h + 4, 9); ctx.stroke(); }
    ctx.globalAlpha = played ? 0.35 : 1; ctx.fillStyle = '#1a1a22'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(midiName(n.midi), x + w / 2, y + h / 2);
  });
  ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
}

// 歌曲模式主绘制：铺白键(本关音域) + 高亮当前/下一个该弹的键，复用粒子/连击作"弹对就爽"的反馈。
export function drawSong(now) {
  ctx.fillStyle = 'rgba(10,10,20,0.3)'; ctx.fillRect(0, 0, view.W, view.H);
  const sx = game.shake ? (Math.random() * 2 - 1) * game.shake : 0;
  const sy = game.shake ? (Math.random() * 2 - 1) * game.shake : 0;
  ctx.save(); ctx.translate(sx, sy);
  const s = game.song; const cur = s ? s.notes[s.ptr] : null; const nxt = s ? s.notes[s.ptr + 1] : null;
  if (s) { drawStaff(now); drawScoreRibbon(now); } // 上方：动态五线谱 + 钢琴卷帘乐谱
  // 提示圈（先画"下一个"弱提示，再画"当前"压在上层）
  if (nxt) drawSongTarget(nxt, now, false);
  if (cur) drawSongTarget(cur, now, true);
  // 琴键：当前该弹的键染亮，其余素白；只标音名（手指因音而异，由提示圈给出）
  kb.keys.forEach(k => {
    const lit = flashMap[k.midi] > now; const isTarget = cur && cur.midi === k.midi;
    ctx.fillStyle = lit ? '#9DE5B5' : (isTarget ? '#FFE9B0' : '#f4f4f8');
    ctx.fillRect(k.x + 1, kb.keyTop, k.w - 2, kb.keyH);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(k.x + 1, kb.keyTop, k.w - 2, kb.keyH);
    ctx.fillStyle = 'rgba(40,40,60,0.6)'; ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(midiName(k.midi), k.cx, kb.keyTop + kb.keyH - 16);
  });
  if (game.running) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('右手', view.W - 115, kb.keyTop - 225); drawHand(view.W - 115, kb.keyTop - 110, 1.7);
  }
  drawFloating();
  ctx.restore();
  drawOverlays(now);
}
