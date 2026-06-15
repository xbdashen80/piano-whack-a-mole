// 用桩替身把浏览器全局对象补齐，然后实际导入整张模块图，
// 验证所有 import/export 名字匹配、无模块解析错误、无循环依赖 TDZ。
const noop = () => {};

const ctxProxy = new Proxy({}, {
  get: (_t, prop) => (prop in {} ? undefined : () => {}),
  set: () => true,
});

function fakeEl() {
  const el = {
    style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    textContent: '', innerHTML: '', disabled: false, offsetWidth: 0,
    onclick: null, appendChild: noop, addEventListener: noop,
    getContext: () => ctxProxy,
  };
  return el;
}

globalThis.document = { getElementById: () => fakeEl(), createElement: () => fakeEl(), addEventListener: noop };
globalThis.window = globalThis;
globalThis.addEventListener = noop;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.localStorage = { getItem: () => null, setItem: noop };
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true }); // 无 requestMIDIAccess
globalThis.performance = { now: () => 0 };
globalThis.requestAnimationFrame = () => 0; // 吞掉，避免在 Node 里真的起循环

await import('../src/main.js');

// 额外校验：事件总线接好了，press 不抛错
const { emit } = await import('../src/events.js');
emit('press', 60, 0.8);

console.log('SMOKE IMPORT OK');
