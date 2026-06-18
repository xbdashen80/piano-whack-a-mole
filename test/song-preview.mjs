// 歌曲模式·预演示范：开启后无需玩家输入，按 bpm 自动推进+发声，整首放完循环；关闭后停住。
// 用直接调用 tick(推进时钟)驱动，断言：自动推进 → 走到末音 → 循环回头 → 关闭后冻结。
import './_tone-stub.mjs';
const noop = () => {};
const gradStub = { addColorStop: noop };
const ctxProxy = new Proxy({}, {
  get(_t, p) { if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => gradStub; if (p === 'measureText') return () => ({ width: 0 }); return () => {}; },
  set: () => true,
});
const elements = new Map();
function makeEl() {
  return { style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, textContent: '', innerHTML: '', disabled: false, offsetWidth: 0, onclick: null, appendChild: noop, addEventListener: noop, getContext: () => ctxProxy };
}
function getEl(id) { if (!elements.has(id)) elements.set(id, makeEl()); return elements.get(id); }
globalThis.document = { getElementById: getEl, createElement: makeEl, addEventListener: noop };
globalThis.window = globalThis; globalThis.addEventListener = noop;
globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
globalThis.localStorage = { getItem: () => null, setItem: noop };
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
let clock = 0; globalThis.performance = { now: () => clock };
globalThis.requestAnimationFrame = () => 0;

const { game } = await import('../src/state.js');
const { emit } = await import('../src/events.js');
await import('../src/main.js');
const { tick } = await import('../src/game.js');

const flush = () => new Promise(r => setTimeout(r, 0));
let pass = true;
const check = (cond, msg) => { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) pass = false; };
// 推进 n 帧，每帧 +stepMs；返回过程中观察到的 maxPtr 与是否发生过"回退"(=循环)
function run(n, stepMs) {
  let maxPtr = game.song ? game.song.ptr : 0, reset = false, prev = maxPtr;
  for (let i = 0; i < n; i++) { clock += stepMs; tick(clock); const p = game.song.ptr; if (p < prev) reset = true; if (p > maxPtr) maxPtr = p; prev = p; }
  return { maxPtr, reset };
}

emit('startSong', 'laputa', 0); await flush(); await flush();
const N = game.song.notes.length;
check(game.mode === 'song' && game.song.ptr === 0, '进入歌曲模式、指针=0');

emit('previewToggle'); await flush();
check(game.song.preview === true, '开启预演：preview=true');

// 按实际曲长/演奏速度算帧数（dt 上限 50ms/帧）；首音可能是弱起，跑到越过第 3 个音再断言推进
const beatMs = 60000 / (game.song.performBpm || 60);
const lastBeat = Math.max(...game.song.notes.map(n => n.startBeat));
run(Math.ceil((game.song.notes[2].startBeat + 1) * beatMs / 50) + 5, 50);
check(game.song.ptr > 0, '预演中无任何输入，指针自动推进（' + game.song.ptr + '）');

const frames = Math.ceil((lastBeat + 4) * beatMs / 50) + 40;
const r = run(frames, 50);
check(r.maxPtr === N - 1, '预演走到过最后一个音（maxPtr=' + r.maxPtr + ' / 末位=' + (N - 1) + '）');
check(r.reset === true, '整首放完后自动从头循环（观察到指针回退）');

const ptrLoop = game.song.ptr;
emit('previewToggle'); await flush();
check(game.song.preview === false && game.song.ptr === 0, '关闭预演：preview=false 且指针归零');
const before = game.song.ptr; run(40, 50);
check(game.song.ptr === before, '关闭后不再自动推进（指针冻结在 ' + before + '）');

if (pass) { console.log('✅ 歌曲模式预演 全部通过'); }
else { console.error('❌ 歌曲模式预演 有用例失败'); process.exit(1); }
