// ================= DOM/HUD：进度条、Toast、结算页、选关、开始界面、按钮 =================
import { game, prog, layoutKeys } from './state.js';
import { LEVELS, MUSIC_NAMES, WHITE, fingerFor, midiName, FINGER_COLORS } from './levels.js';
import { setBgm, setSfx } from './audio.js';
import { emit } from './events.js';

const $ = id => document.getElementById(id);

// 当前覆盖层的"主操作"（开始/下一关/再来）。供空格键、连敲琴键等免鼠标方式触发。
let primaryAction = null;
export function triggerPrimary() { if (primaryAction) primaryAction(); }

export function refreshHUD() {
  $('score').textContent = game.score; $('combo').textContent = game.combo;
  $('best').textContent = prog.best;
  $('lvlName').textContent = (game.curLevel + 1) + ' · ' + LEVELS[game.curLevel].t + ' · ' + MUSIC_NAMES[LEVELS[game.curLevel].music || 0];
  const goal = LEVELS[game.curLevel].goal; $('goalRemain').textContent = Math.max(0, goal - game.score);
  $('goalBar').style.width = Math.min(100, game.score / goal * 100) + '%';
}

export function showToast(t, c) {
  const el = $('toast'); el.textContent = t; el.style.color = c; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

export function setStatus(t, ok) { $('status').textContent = t; $('status').className = ok ? 'ok' : ''; }

// MIDI 连上后更新开始界面提示文字
export function markMidiConnected() {
  const os = $('ovStatus'); if (os) { os.textContent = '钢琴已连接 ✓ 选关卡，点开始'; os.style.color = '#5DCAA5'; }
}

export function renderKbPreview() {
  const wrap = $('kbPreview'); if (!wrap) return; wrap.innerHTML = '';
  const n = LEVELS[game.curLevel].keys;
  WHITE.slice(0, n).forEach((m, i) => {
    const f = fingerFor(i); const key = document.createElement('div');
    key.style.cssText = 'width:34px;height:74px;background:#f4f4f8;border-radius:0 0 5px 5px;border:1px solid rgba(0,0,0,0.2);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;padding-bottom:5px;';
    key.innerHTML = `<span style="width:18px;height:18px;border-radius:50%;background:${FINGER_COLORS[f]};color:#1a1a22;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;">${f}</span><span style="color:rgba(40,40,60,0.7);font-size:12px;">${midiName(m)}</span>`;
    wrap.appendChild(key);
  });
}

export function buildLevelGrid(container) {
  const wrap = container || $('lvlGrid'); if (!wrap) return; wrap.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const locked = i >= prog.unlocked; const b = document.createElement('button');
    b.textContent = (locked ? '🔒' : (i + 1)) + ' ' + L.t; b.style.opacity = locked ? '0.4' : '1';
    if (i === game.curLevel && !locked) b.style.borderColor = '#5DCAA5'; b.disabled = locked;
    b.onclick = () => {
      game.curLevel = i; layoutKeys(); refreshHUD(); buildLevelGrid(wrap); renderKbPreview();
      $('bigPlay').textContent = '开始第 ' + (i + 1) + ' 关';
    };
    wrap.appendChild(b);
  });
}

// ---------- 进入/退出游戏时的 HUD 切换 ----------
export function hideOverlay() { primaryAction = null; $('overlay').classList.add('hidden'); }
export function enterPlayUI() { $('pauseBtn').classList.remove('hidden'); $('goalWrap').classList.remove('hidden'); }
export function exitPlayUI() { $('pauseBtn').classList.add('hidden'); $('goalWrap').classList.add('hidden'); }
export function setPaused(p) { $('pauseBtn').textContent = p ? '继续' : '暂停'; }

// ---------- 结算页 ----------
export function showLevelClear(unlockedNew) {
  const hasNext = game.curLevel + 1 < LEVELS.length; const ov = $('overlay'); ov.classList.remove('hidden');
  ov.innerHTML = `<h1 style="color:#5DCAA5">🎉 第 ${game.curLevel + 1} 关通关！</h1>
    <div id="resultStats"><div><b style="color:#fff">${game.score}</b>本关得分</div><div><b style="color:#5DCAA5">${prog.best}</b>最高分</div></div>
    ${unlockedNew && hasNext ? '<p class="unlockMsg">🔓 解锁第 ' + (game.curLevel + 2) + ' 关：' + LEVELS[game.curLevel + 1].t + '</p>' : ''}
    <p>${hasNext ? '小熊这关稳稳的没下水！继续下一关。' : '全部 ' + LEVELS.length + ' 关通关，小熊给你鼓掌！'}</p>
    <div id="lcBtns" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;"></div>
    <p style="font-size:13px;color:rgba(255,255,255,0.5);">按 <b style="color:#9DB4FF">空格</b> 或 <b style="color:#9DB4FF">连敲两下同一个琴键</b> 即可${hasNext ? '进入下一关' : '再玩一次'}</p>`;
  const wrap = $('lcBtns');
  if (hasNext) {
    const b = document.createElement('button'); b.textContent = '▶ 下一关：' + LEVELS[game.curLevel + 1].t;
    b.style.cssText = 'background:rgba(80,120,255,0.92);border:none;font-size:17px;padding:13px 30px;font-weight:600;border-radius:10px;';
    b.onclick = () => emit('start', game.curLevel + 1); wrap.appendChild(b);
  }
  const r = document.createElement('button'); r.textContent = '↻ 再刷本关'; r.style.cssText = 'font-size:17px;padding:13px 30px;';
  r.onclick = () => emit('start'); wrap.appendChild(r);
  // 主操作=下一关（无下一关则再刷本关）
  primaryAction = hasNext ? () => emit('start', game.curLevel + 1) : () => emit('start');
}

export function showGameOver() {
  const ov = $('overlay'); ov.classList.remove('hidden'); const progPct = Math.round(game.score / LEVELS[game.curLevel].goal * 100);
  ov.innerHTML = `<h1 style="color:#9DD6FF">💦 小熊掉水里了！</h1>
    <div id="resultStats"><div><b style="color:#fff">${game.score}</b>本次得分</div><div><b style="color:#9DB4FF">${progPct}%</b>本关进度</div></div>
    <p>小熊一直在往下沉，要弹得勤、按得准才托得住它。圈刚冒出来就按，弹得最高、分也最多。</p>
    <button id="bigPlay2" style="background:rgba(80,120,255,0.92);border:none;font-size:18px;padding:14px 44px;font-weight:600;border-radius:10px;">↻ 再救一次小熊</button>
    <p style="font-size:13px;color:rgba(255,255,255,0.5);">按 <b style="color:#9DB4FF">空格</b> 或 <b style="color:#9DB4FF">连敲两下同一个琴键</b> 即可重来</p>`;
  $('bigPlay2').onclick = () => emit('start');
  primaryAction = () => emit('start');
}

// ---------- 按钮绑定 ----------
export function bindButtons() {
  $('bigPlay').onclick = () => emit('start');
  primaryAction = () => emit('start'); // 开始界面默认主操作=开始当前选中关
  $('pauseBtn').onclick = () => emit('pauseToggle');
  $('bgmBtn').onclick = () => { const on = !$('bgmBtn').classList.contains('on'); $('bgmBtn').classList.toggle('on', on); setBgm(on); };
  $('sfxBtn').onclick = () => { const on = !$('sfxBtn').classList.contains('on'); $('sfxBtn').classList.toggle('on', on); setSfx(on); };
}
