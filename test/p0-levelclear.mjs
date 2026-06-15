// P0 回归测试：复现"过关瞬间音效抛错"的真实场景，断言通关流程不被中断。
//
// 原 bug：levelClear() 里 sfxLevel() 先于弹窗执行，Tone 抛
// "Start time must be strictly greater..." → 被 press 的 catch 吞掉 →
// running 已 false 但弹窗没显示、地鼠不再生成、按键无响应 → 僵死。
//
// 这里把音效合成器置于"会抛错"的状态（audio.ready=true 但合成器未初始化），
// 触发一次过关，断言：弹窗照常显示、running=false、流程完整。

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
globalThis.performance = { now: () => 0 };
globalThis.requestAnimationFrame = () => 0;
// 极简 Tone：非合成器调用不报错；合成器本身未初始化 → 触发即抛错（正是 bug 场景）
globalThis.Tone = {
  now: () => 0,
  Frequency: () => ({ toFrequency: () => 440 }),
  Transport: { bpm: { value: 0, rampTo: noop }, start: noop },
  getDestination: noop, Draw: { schedule: noop },
};

const { game, kb } = await import('../src/state.js');
const { LEVELS } = await import('../src/levels.js');
const { emit } = await import('../src/events.js');
const { audio } = await import('../src/audio.js');
await import('../src/main.js');

const flush = () => new Promise(r => setTimeout(r, 0));

// 强制走"音效会抛错"的路径：ready 为真但合成器未 initAudio（保持 undefined）
audio.ready = true; audio.sfxOn = true; audio.bgmOn = false;

// 开第 1 关
emit('start', 0); await flush();
if (!game.running) { console.error('❌ 开局失败：running 未置真'); process.exit(1); }

// 把分数顶到差一击过关，放一个地鼠，按对它触发过关
const goal = LEVELS[0].goal;
game.score = goal - 1;
const midi = kb.activeKeyMidis[0];
game.moles.push({ midi, born: 0, ttl: 99999, ticked: false });

const overlay = getEl('overlay');
overlay.innerHTML = ''; // 清空，便于检测弹窗是否被写入

emit('press', midi, 0.8); // → press → checkPass → levelClear（其中 sfxLevel 会抛错但应被吞在音频层）

// 断言：过关流程完整
const ok =
  game.running === false &&
  game.score >= goal &&
  overlay.innerHTML.includes('通关');

if (ok) {
  console.log('✅ P0 回归通过：音效抛错时过关弹窗仍正常显示，流程未中断');
  console.log(`   running=${game.running} score=${game.score}/${goal} 弹窗已写入=${overlay.innerHTML.includes('通关')}`);
} else {
  console.error('❌ P0 回归失败：过关流程被中断');
  console.error(`   running=${game.running} score=${game.score}/${goal} overlay.innerHTML=${JSON.stringify(overlay.innerHTML.slice(0, 60))}`);
  process.exit(1);
}
