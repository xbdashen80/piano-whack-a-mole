// P0 复现器：用受控时钟驱动主循环，自动连打 + 反复过关切关 + 注入失焦时间跳变，
// 断言「running && !paused 时地鼠不会长时间消失」。symptom 来自 PROJECT.md：地鼠不再出现、按键无响应。
//
// 用法: node test/freeze-sim.mjs [frames]
// 失败时打印触发瞬间的完整状态，便于定位根因。

// ---------- 可复现随机 ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = Number(process.env.SEED || 12345);
const rnd = mulberry32(SEED);
Math.random = rnd;

// ---------- 受控时钟 ----------
let clock = 0; // ms

// ---------- 浏览器全局桩 ----------
const noop = () => {};
const ctxProxy = new Proxy({}, { get: () => () => {}, set: () => true });
function fakeEl() {
  return {
    style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    textContent: '', innerHTML: '', disabled: false, offsetWidth: 0,
    onclick: null, appendChild: noop, addEventListener: noop, getContext: () => ctxProxy,
  };
}
globalThis.document = { getElementById: () => fakeEl(), createElement: () => fakeEl(), addEventListener: noop };
globalThis.window = globalThis;
globalThis.addEventListener = noop;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.localStorage = { getItem: () => null, setItem: noop };
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
globalThis.performance = { now: () => clock };
globalThis.requestAnimationFrame = () => 0; // 吞掉自调度，改为手动驱动 tick

// ---------- 载入游戏 ----------
const { tick } = await import('../src/game.js');
const { emit } = await import('../src/events.js');
const { game, kb } = await import('../src/state.js');
const { LEVELS } = await import('../src/levels.js');
await import('../src/main.js'); // 完成装配 + initGame 注册监听

const flush = () => new Promise(r => setTimeout(r, 0));

function start(i) { emit('start', i); return flush(); }

function snapshot(extra) {
  return JSON.stringify({
    clock: Math.round(clock), curLevel: game.curLevel, running: game.running, paused: game.paused,
    breaking: game.breaking, score: game.score, goal: LEVELS[game.curLevel].goal,
    moles: game.moles.length, nextSpawn: Math.round(game.nextSpawn),
    lastMoleTime: Math.round(game.lastMoleTime),
    sinceSpawn: Math.round(clock - game.lastMoleTime), activeKeys: kb.activeKeyMidis.length, ...extra,
  }, null, 2);
}

// ---------- 主模拟 ----------
const TOTAL = Number(process.argv[2] || 60000);
const DT = 16.7;
let transitions = 0, gameovers = 0, totalSpawns = 0, prevLMT = -1;
let pauseResumeAt = -1;
let activeSinceSpawn = 0; // 仅累计 running&&!paused 的时间，单帧封顶（暂停/失焦不计入）

// 帧历史环形缓冲：停摆时回放前若干帧，看清前因
const HIST = 60;
const history = [];
let evThisFrame = [];
function record(f) {
  history.push({ f, clock: Math.round(clock), ev: evThisFrame.join(',') || '-', run: game.running, pause: game.paused, brk: game.breaking, moles: game.moles.length, lmt: Math.round(game.lastMoleTime), next: Math.round(game.nextSpawn), lvl: game.curLevel + 1, score: game.score });
  if (history.length > HIST) history.shift();
  evThisFrame = [];
}
function ev(name) { evThisFrame.push(name); }

await start(0);

for (let f = 0; f < TOTAL; f++) {
  // 偶发：模拟标签页失焦后回来（大时间跳变）
  const prevClock = clock;
  if (rnd() < 0.0008) { clock += 20000 + rnd() * 20000; ev('BLUR_JUMP'); }
  else clock += DT;
  const realDelta = clock - prevClock;

  tick(clock);

  // 统计真实生成次数（spawnMole 会更新 lastMoleTime）
  if (game.lastMoleTime !== prevLMT) { totalSpawns++; prevLMT = game.lastMoleTime; activeSinceSpawn = 0; }

  // 自动连打：把当前所有活动地鼠按掉（偶尔漏一个）
  if (game.running && !game.paused) {
    for (const m of [...game.moles]) {
      if (rnd() < 0.92) { emit('press', m.midi, 0.8); ev('press'); }
    }
  }

  // 偶发暂停/恢复（pause 会重置 lastTickTime / nextSpawn，是嫌疑点之一）
  if (game.running && pauseResumeAt < 0 && rnd() < 0.0015) {
    emit('pauseToggle'); ev('PAUSE'); pauseResumeAt = f + 30 + Math.floor(rnd() * 60);
  }
  if (pauseResumeAt >= 0 && f >= pauseResumeAt) { if (game.paused) { emit('pauseToggle'); ev('RESUME'); } pauseResumeAt = -1; }

  record(f);

  // 活动态生成存活性断言：看 lastMoleTime 是否还在推进（好玩家会秒清 moles，
  // 所以不能用 moles 是否为空判断；要看“生成”这件事有没有停摆）。
  // 只累计 running&&!paused 的时间，单帧封顶 100ms（暂停/失焦跳变不计入，
  // 否则会把正常暂停误判成卡死）。正常最长间隔 = 看门狗阈值 spawn[1]*1.5。
  if (game.running && !game.paused) {
    activeSinceSpawn += Math.min(realDelta, 100);
    const L = LEVELS[game.curLevel];
    if (activeSinceSpawn > L.spawn[1] * 1.5 + 1500) {
      console.error('❌ 复现卡死：running 中生成停摆（地鼠不再出现）');
      console.error(snapshot({ frame: f, seed: SEED }));
      console.error('\n--- 停摆前 ' + history.length + ' 帧回放 ---');
      for (const h of history) console.error(`f${h.f} t=${h.clock} [${h.ev}] run=${h.run?1:0} pause=${h.pause?1:0} brk=${h.brk?1:0} moles=${h.moles} lmt=${h.lmt} next=${h.next} lvl=${h.lvl} score=${h.score}`);
      process.exit(1);
    }
  }

  // 过关 / 失败后自动推进，制造大量切关
  if (!game.running && !game.breaking) {
    if (game.score >= LEVELS[game.curLevel].goal && game.curLevel + 1 < LEVELS.length) {
      transitions++; await start(game.curLevel + 1);
    } else if (game.score >= LEVELS[game.curLevel].goal) {
      transitions++; await start(0); // 通关到底，循环回第 1 关继续压
    } else {
      gameovers++; await start(game.curLevel); // 失败重来本关
    }
  }
}

console.log('✅ 未复现卡死');
console.log(`seed=${SEED} frames=${TOTAL} 切关=${transitions} 失败重来=${gameovers} 总生成地鼠=${totalSpawns} 当前关=${game.curLevel + 1}`);
