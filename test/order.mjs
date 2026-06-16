// 回归测试：必须按地鼠出现的先后顺序敲——只有最早出现的(moles[0])可命中，越级=失误。
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
const a = kb.activeKeyMidis[0], b = kb.activeKeyMidis[1];

// 两只地鼠：a 先出现，b 后出现
function setup() {
  game.fever = false; game.feverGauge = 0; game.lastBeatAt = 0; game.beatMs = 0; game.score = 0;
  game.moles.length = 0;
  game.moles.push({ midi: a, born: 0, ttl: 99999, ticked: false });
  game.moles.push({ midi: b, born: 10, ttl: 99999, ticked: false });
}

// 1) 越级：先按后出现的 b → 不命中、连击清零、两只都还在
setup(); game.combo = 5;
clock = 100; emit('press', b, 0.8);
check(game.moles.length === 2, '越级按后出现的键：不命中，两只地鼠都还在');
check(game.combo === 0, '越级 = 失误，连击清零');

// 2) 按最早出现的 a → 命中、a 消除、轮到 b
clock = 200; emit('press', a, 0.8);
check(game.moles.length === 1 && game.moles[0].midi === b, '按最早出现的→命中，轮到下一只');
check(game.combo === 1, '正确命中连击+1');

// 3) 现在 b 成为最早 → 按 b 命中清完
clock = 300; emit('press', b, 0.8);
check(game.moles.length === 0 && game.combo === 2, '依次清完，连击继续累加');

if (pass) { console.log('✅ 顺序判定 全部通过'); }
else { console.error('❌ 顺序判定 有用例失败'); process.exit(1); }
