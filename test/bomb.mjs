// 回归测试：炸弹鼠——敲到重罚(连击清零/掉狂热/不得分)；炸弹不进顺序队列(可越过它敲目标)；
// 炸弹自己到时消失无惩罚。
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
const { tick } = await import('../src/game.js');

const flush = () => new Promise(r => setTimeout(r, 0));
let pass = true;
const check = (cond, msg) => { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) pass = false; };

clock = 0; emit('start', 0); await flush();
const a = kb.activeKeyMidis[0], b = kb.activeKeyMidis[1];

// 1) 敲到炸弹 → game over（不再是扣分继续）
game.running = true; game.combo = 5; game.score = 100; game.feverGauge = 0.5; game.fever = false; game.lastBeatAt = 0; game.beatMs = 0;
game.moles.length = 0; game.moles.push({ midi: a, born: clock, ttl: 99999, ticked: false, bomb: true });
clock = 1000; emit('press', a, 0.8);
check(game.running === false, '敲炸弹 → game over（running=false）');
check(game.moles.length === 0, '敲炸弹：炸弹被移除');

// 2) 炸弹在最前也不挡：可直接敲后面的非炸弹目标
game.running = true; game.combo = 0; game.score = 0; game.feverGauge = 0;
game.moles.length = 0;
game.moles.push({ midi: a, born: 0, ttl: 99999, ticked: false, bomb: true });  // 最早=炸弹
game.moles.push({ midi: b, born: 10, ttl: 99999, ticked: false });             // 当前目标=普通
clock = 1000; emit('press', b, 0.8);
check(game.running === true && game.combo === 1, '炸弹在前不挡：可直接敲后面的非炸弹目标→命中（不 game over）');
check(game.moles.length === 1 && game.moles[0].bomb === true, '命中的是普通鼠，炸弹仍在');

// 3) 炸弹到时自己消失，不 game over、无惩罚（连击保持）
game.running = true; game.combo = 2; game.hitStop = 0; // 清掉上面遗留的顿帧，让本帧正常跑完过期回收
game.moles.length = 0; game.moles.push({ midi: a, born: 0, ttl: 500, ticked: false, bomb: true });
game.lastBeatAt = 1e9; game.lastMoleTime = 1e9; game.nextSpawn = 1e12; // 抑制兜底生成/看门狗
clock = 1000; tick(1000); // now-born=1000>500 → 炸弹过期
check(game.moles.length === 0, '炸弹到时自己消失');
check(game.running === true && game.combo === 2, '炸弹自然消失：不 game over、连击保持');

if (pass) { console.log('✅ 炸弹鼠 全部通过'); }
else { console.error('❌ 炸弹鼠 有用例失败'); process.exit(1); }
