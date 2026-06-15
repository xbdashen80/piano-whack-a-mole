// 回归测试：免鼠标推进——连敲两下同一个琴键可触发覆盖层主操作（开始/下一关/重来）。
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

const { game, kb } = await import('../src/state.js');
const { emit } = await import('../src/events.js');
await import('../src/main.js');

const flush = () => new Promise(r => setTimeout(r, 0));
const tap = midi => emit('press', midi, 0.8);
let pass = true;
const check = (cond, msg) => { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) pass = false; };

const k = kb.activeKeyMidis[0];

// 1) 开始界面：连敲两下同一键 → 开始（running 变真）
clock = 0; tap(k); clock = 300; tap(k); await flush();
check(game.running === true, '开始界面：双击同一琴键可开始游戏');

// 2) 游戏中：双击不应触发推进（不报错、保持运行）
clock = 1000; tap(k); clock = 1100; tap(k); await flush();
check(game.running === true, '游戏中：双击不会误触发推进');

// 3) 间隔过长（>600ms）不算双击
//   先制造一个覆盖层：直接结束本局到 gameOver 较麻烦，这里用过关。
const { LEVELS } = await import('../src/levels.js');
game.score = LEVELS[game.curLevel].goal - 1;
game.moles.push({ midi: k, born: 0, ttl: 99999, ticked: false });
tap(k); await flush(); // 过关 → 覆盖层出现，running=false
check(game.running === false, '过关后进入覆盖层（running=false）');

const lvlBefore = game.curLevel;
clock = 5000; tap(k); clock = 5700; tap(k); await flush(); // 间隔 700ms，不算双击
check(game.running === false && game.curLevel === lvlBefore, '间隔>600ms 不触发推进');

// 4) 覆盖层：连敲两下同一键 → 进入下一关
clock = 8000; tap(k); clock = 8200; tap(k); await flush();
check(game.running === true && game.curLevel === lvlBefore + 1, '覆盖层：双击同一琴键进入下一关');

if (pass) { console.log('✅ 免鼠标推进 全部通过'); }
else { console.error('❌ 免鼠标推进 有用例失败'); process.exit(1); }
