// 歌曲模式：喂入《天空之城》关卡 1 + 一串"正确 press"，断言指针按音符顺序推进、最后触发通关结算。
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
const { prog } = await import('../src/state.js');
const { emit } = await import('../src/events.js');
await import('../src/main.js');

const flush = () => new Promise(r => setTimeout(r, 0));
let pass = true;
const check = (cond, msg) => { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) pass = false; };

emit('startSong', 'laputa', 0); await flush(); await flush();

check(game.mode === 'song' && !!game.song, '进入歌曲模式：mode=song、song 已加载');
const notes = game.song.notes.slice();
check(notes.length > 0 && game.song.ptr === 0, '关卡 1 载入 ' + notes.length + ' 个音、指针从 0 开始');

// 依次按正确音高，断言指针每次 +1
let ok = true;
for (let i = 0; i < notes.length; i++) {
  if (game.song && game.song.ptr !== i) ok = false; // 通关后 song.ptr 仍停在末尾
  clock += 500; emit('press', notes[i].midi, 0.8);
}
check(ok, '每按对一个音，指针按顺序推进一格');
check(game.combo === notes.length, '全程正确：连击 = 音符数 ' + notes.length);
check(game.score > 0, '正确命中累计得分 > 0（实得 ' + game.score + '）');

// 弹完最后一个音 → 通关结算
check(game.running === false, '弹完最后一个音：触发通关、running=false');
check((getEl('overlay').innerHTML || '').includes('弹完'), '通关结算页已写入 overlay');
check(prog.songProgress && prog.songProgress.laputa === 1, '存档记录：laputa 关卡 1 已完成');

if (pass) { console.log('✅ 歌曲模式 顺序推进 全部通过'); }
else { console.error('❌ 歌曲模式 顺序推进 有用例失败'); process.exit(1); }
