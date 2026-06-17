// 歌曲模式：弹错音高时只给提示，不前进、不中断、不僵死（继承 P0 教训：副作用不阻断状态机）。
import './_tone-stub.mjs';
const noop = () => {};
const ctxProxy = new Proxy({}, { get: () => () => {}, set: () => true });
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
const { tick } = await import('../src/game.js');
await import('../src/main.js');

const flush = () => new Promise(r => setTimeout(r, 0));
let pass = true;
const check = (cond, msg) => { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) pass = false; };

emit('startSong', 'laputa', 0); await flush(); await flush();
const notes = game.song.notes;
const target = notes[0].midi;            // 当前该弹的音
const wrong = target === 60 ? 62 : 60;   // 一个不等于目标的音

// 1) 先攒几个连击，再弹错
clock = 100; emit('press', target, 0.8);          // 对：ptr→1, combo 1
clock = 200; emit('press', notes[1].midi, 0.8);   // 对：ptr→2, combo 2
check(game.song.ptr === 2 && game.combo === 2, '前两个音弹对：指针到 2、连击 2');

clock = 300; emit('press', wrong, 0.8);
check(game.song.ptr === 2, '弹错音：指针不前进（仍停在当前音）');
check(game.combo === 0, '弹错音：连击清零');
check(game.running === true, '弹错音：不中断、游戏仍在进行');

// 2) 主循环仍能正常跑（drawSong 不抛出导致僵死）
let threw = false;
try { clock = 350; tick(clock); } catch (e) { threw = true; }
check(!threw && game.running === true, '弹错后主循环 tick 正常、状态机未僵死');

// 3) 错音后接着弹对，能继续推进 → 证明状态机活着
clock = 400; emit('press', notes[2].midi, 0.8);
check(game.song.ptr === 3, '错音之后弹对：指针继续推进');

if (pass) { console.log('✅ 歌曲模式 错音不僵死 全部通过'); }
else { console.error('❌ 歌曲模式 错音不僵死 有用例失败'); process.exit(1); }
