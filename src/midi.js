// ================= 输入：Web MIDI + 键盘兜底 → 统一 'press' 事件 =================
import { emit } from './events.js';
import { setStatus, markMidiConnected } from './ui.js';
import { WHITE } from './levels.js';

function onMIDI(msg) {
  try { const [c, n, v] = msg.data; if ((c & 0xf0) === 0x90 && v > 0) emit('press', n, v / 127); } catch (e) {}
}

export async function initMIDI() {
  if (!navigator.requestMIDIAccess) { setStatus('请用 Chrome/Edge', false); return; }
  try {
    const acc = await navigator.requestMIDIAccess();
    function refresh() {
      const ins = [...acc.inputs.values()];
      if (ins.length) { ins.forEach(i => i.onmidimessage = onMIDI); setStatus('🎹 已连接', true); markMidiConnected(); }
      else setStatus('未检测到钢琴', false);
    }
    acc.onstatechange = refresh; refresh();
  } catch (e) { setStatus('需允许 MIDI', false); }
}

// 没插琴时,用 A S D F G H J K L 模拟琴键
export function initKeyboard() {
  const km = 'asdfghjkl'; const down = {};
  window.addEventListener('keydown', e => {
    const i = km.indexOf(e.key.toLowerCase());
    if (i >= 0 && !down[e.key]) { down[e.key] = true; emit('press', WHITE[i], 0.8); }
  });
  window.addEventListener('keyup', e => { down[e.key] = false; });
}
