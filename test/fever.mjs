// 回归测试：P2+ 狂热 Fever 模式——槽满进狂热、狂热中分数×2、到时结束、失误掉槽。
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
const k = kb.activeKeyMidis[0];
const putMole = () => { game.moles.length = 0; game.moles.push({ midi: k, born: clock, ttl: 99999, ticked: false }); };

// 1) 槽蓄满 → 进入狂热
clock = 1000; game.combo = 0; game.score = 0; game.feverGauge = 0.99; game.fever = false;
game.lastBeatAt = 0; game.beatMs = 0; putMole();
emit('press', k, 0.8);
check(game.fever === true, '狂热槽满 → 进入狂热');
check(game.feverUntil === 9000, '狂热持续 8 秒(feverUntil=9000)  实得=' + game.feverUntil);

// 2) 狂热中：分数 ×2（perfect15 + combo1*2，再×2 = 34；无踩点）
game.combo = 0; game.score = 0; putMole();
clock = 1000; emit('press', k, 0.8);
check(game.score === 34, '狂热中分数×2 = (15+2)*2 = 34  实得=' + game.score);

// 3) 到时结束（tick 推进到 feverUntil 之后）
clock = 9001; tick(9001);
check(game.fever === false && game.feverGauge === 0, '8 秒后狂热结束、槽清零');

// 4) 失误掉槽 ×0.6（敲空 = miss）
game.fever = false; game.feverGauge = 0.5; game.moles.length = 0;
clock = 1000; emit('press', k, 0.8);
check(Math.abs(game.feverGauge - 0.3) < 1e-9, '失误掉槽 ×0.6 = 0.3  实得=' + game.feverGauge);

// 5) 空闲时槽不随时间回落（修复"慢速关蓄不过掉、永远进不了狂热"）
game.fever = false; game.feverGauge = 0.5; game.moles.length = 0;
game.lastBeatAt = 20000; game.lastMoleTime = 20000; game.nextSpawn = 1e12;
clock = 20000; tick(20000);
clock = 23000; game.lastBeatAt = 23000; game.lastMoleTime = 23000; tick(23000);
check(game.feverGauge === 0.5, '空闲数秒后狂热槽不回落 = 0.5  实得=' + game.feverGauge);

if (pass) { console.log('✅ 狂热 Fever 全部通过'); }
else { console.error('❌ 狂热 Fever 有用例失败'); process.exit(1); }
