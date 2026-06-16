// 回归测试：P2 节奏同步——踩中鼓点给额外加分；偏拍不加分但仍正常命中；无拍源不加分；
// 'beat' 事件刷新节拍锚点。判定其余逻辑(perfect/命中)不被踩点判定改变。
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

const { game, kb } = await import('../src/state.js');
const { emit } = await import('../src/events.js');
await import('../src/main.js');

const flush = () => new Promise(r => setTimeout(r, 0));
let pass = true;
const check = (cond, msg) => { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) pass = false; };

// 开局
clock = 0; emit('start', 0); await flush();
check(game.running === true, '游戏已开始');

const k = kb.activeKeyMidis[0];
// 在已知节拍锚点下打一记 perfect 命中，返回得分。c=按键时刻，beatAt/ms=节拍锚点。
function hit({ c, beatAt, beatMs }) {
  game.combo = 0; game.score = 0; game.lastBeatAt = beatAt; game.beatMs = beatMs;
  game.moles.length = 0; game.moles.push({ midi: k, born: c, ttl: 99999, ticked: false }); // born=c → ratio0 → perfect
  clock = c; emit('press', k, 0.8);
  return game.score;
}

// 1) 踩中鼓点(ph=0 < 110ms)：perfect15 + combo1*2 + 踩点8 = 25
const onBeat = hit({ c: 1000, beatAt: 1000, beatMs: 500 });
check(onBeat === 25, '踩中鼓点 = 15+2+8 = 25  实得=' + onBeat);

// 2) 偏拍(ph=250 > 110ms)：无踩点加分 = 17
const offBeat = hit({ c: 1250, beatAt: 1000, beatMs: 500 });
check(offBeat === 17, '偏拍无踩点加分 = 15+2 = 17  实得=' + offBeat);
check(onBeat - offBeat === 8, '踩点恰好多 8 分');

// 3) 偏拍仍判为命中：连击+1、地鼠被消除，不被踩点判定挡掉
check(game.combo === 1 && game.moles.length === 0, '偏拍仍正常命中（连击+1、地鼠消除）');

// 4) 无拍源(beatMs=0)时不给踩点奖励
const noBeat = hit({ c: 1250, beatAt: 0, beatMs: 0 });
check(noBeat === 17, '无拍源时无踩点加分 = 17  实得=' + noBeat);

// 5) 'beat' 事件刷新节拍锚点
clock = 9000; emit('beat', 480, true);
check(game.beatMs === 480 && game.lastBeatAt === 9000, "'beat' 事件刷新 lastBeatAt/beatMs");

if (pass) { console.log('✅ 节奏同步 全部通过'); }
else { console.error('❌ 节奏同步 有用例失败'); process.exit(1); }
