// 回归测试：金鼠——命中分数×3、蓄狂热更多；普通地鼠不受影响。
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

clock = 0; emit('start', 0); await flush();
const k = kb.activeKeyMidis[0];
function hit(gold) {
  game.combo = 0; game.score = 0; game.fever = false; game.feverGauge = 0; game.lastBeatAt = 0; game.beatMs = 0;
  game.moles.length = 0; game.moles.push({ midi: k, born: clock, ttl: 99999, ticked: false, gold }); // born=clock → perfect
  clock = 1000; emit('press', k, 0.8);
  return { score: game.score, fever: game.feverGauge };
}

// 普通地鼠：perfect15 + combo1*2 = 17
const normal = hit(false);
check(normal.score === 17, '普通地鼠 = 15+2 = 17  实得=' + normal.score);

// 金鼠：×5 = 85
clock = 1000; const g = hit(true);
check(g.score === 85, '金鼠分数×5 = (15+2)*5 = 85  实得=' + g.score);
check(g.fever > normal.fever, '金鼠蓄狂热更多（' + g.fever.toFixed(3) + ' > ' + normal.fever.toFixed(3) + '）');

if (pass) { console.log('✅ 金鼠 全部通过'); }
else { console.error('❌ 金鼠 有用例失败'); process.exit(1); }
