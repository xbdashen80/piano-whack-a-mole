// 歌曲模式渲染冒烟：进入歌曲模式后调用 drawSong 多帧（覆盖动态乐谱 + 已弹/当前/将来三种音块状态），
// 断言绘制全程不抛错。守护 render 路径——避免乐谱等绘制改动引入运行时报错（节奏/真音色仍只能在浏览器验证）。
import './_tone-stub.mjs';
const noop = () => {};
// canvas 2D 桩：方法多为 no-op；渐变创建返回带 addColorStop 的对象、measureText 返回宽度，
// 让 drawSong（含渐变/文本测量）能在 Node 里完整跑完一帧而不抛错。
const gradStub = { addColorStop: noop };
const ctxProxy = new Proxy({}, {
  get(_t, p) {
    if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => gradStub;
    if (p === 'measureText') return () => ({ width: 0 });
    return () => {};
  },
  set: () => true,
});
const elements = new Map();
function makeEl() {
  return {
    style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    textContent: '', innerHTML: '', disabled: false, offsetWidth: 0,
    onclick: null, appendChild: noop, addEventListener: noop, getContext: () => ctxProxy,
  };
}
function getEl(id) { if (!elements.has(id)) elements.set(id, makeEl()); return elements.get(id); }
globalThis.document = { getElementById: getEl, createElement: makeEl, addEventListener: noop };
globalThis.window = globalThis;
globalThis.addEventListener = noop;
globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
globalThis.localStorage = { getItem: () => null, setItem: noop };
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
let clock = 0;
globalThis.performance = { now: () => clock };
globalThis.requestAnimationFrame = () => 0;

const { game } = await import('../src/state.js');
const { emit } = await import('../src/events.js');
await import('../src/main.js');
const { drawSong } = await import('../src/render.js');

const flush = () => new Promise(r => setTimeout(r, 0));
let pass = true;
const check = (cond, msg) => { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) pass = false; };

emit('startSong', 'laputa', 0); await flush(); await flush();
check(game.mode === 'song' && !!game.song, '已进入歌曲模式');

try {
  drawSong(0); drawSong(123);                         // 开局：全是"将来"音块
  game.song.notes.slice(0, 3).forEach(n => { clock += 400; emit('press', n.midi, 0.8); }); // 弹对前 3 音 → 出现"已弹/当前"
  drawSong(456); drawSong(789);
  check(game.song.ptr === 3, '弹对 3 个音后指针=3（已弹/当前/将来三态都会被绘制）');
  check(true, 'drawSong 多帧绘制全程未抛错');
} catch (e) {
  check(false, 'drawSong 抛错：' + e.message);
}

if (pass) { console.log('✅ 歌曲模式渲染 全部通过'); }
else { console.error('❌ 歌曲模式渲染 有用例失败'); process.exit(1); }
