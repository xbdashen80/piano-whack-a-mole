// ================= 诊断仪表 =================
// 目的：把"静默吞错 + 黑屏卡死"变成"控制台里有据可查的根因"。
// 所有原本 catch(e){} 的地方改用 logErr 记录；并提供全局错误兜底与运行时看门狗。

const seen = new Map(); // 同类错误去重计数，避免每帧刷屏

export function logErr(tag, e) {
  const key = tag + ':' + (e && e.message ? e.message : String(e));
  const n = (seen.get(key) || 0) + 1;
  seen.set(key, n);
  // 前 3 次完整打印，之后每 200 次提示一下还在持续，避免淹没控制台
  if (n <= 3 || n % 200 === 0) {
    console.error(`[钢琴打地鼠] ${tag} 第 ${n} 次出错：`, e);
  }
}

export function installGlobalHandlers() {
  window.addEventListener('error', ev => console.error('[钢琴打地鼠] 未捕获错误：', ev.error || ev.message));
  window.addEventListener('unhandledrejection', ev => console.error('[钢琴打地鼠] 未处理的 Promise 拒绝：', ev.reason));
}

// 运行时看门狗：游戏进行中若生成长时间停摆，打印一次现场快照。
// 用 now 与 nextSpawn 比较（而非墙钟），所以正常暂停/失焦不会误报。
let warned = false;
export function spawnWatchdog(now, game, L) {
  const stalled = game.running && !game.paused
    && game.moles.length < L.maxActive
    && now > game.nextSpawn + L.spawn[1] * 2 + 2000;
  if (stalled && !warned) {
    warned = true;
    console.warn('[钢琴打地鼠] ⚠️ 生成停摆！现场快照：', {
      关: game.curLevel + 1, now: Math.round(now), nextSpawn: Math.round(game.nextSpawn),
      落后ms: Math.round(now - game.nextSpawn), moles: game.moles.length, maxActive: L.maxActive,
      running: game.running, paused: game.paused, breaking: game.breaking,
      lastMoleTime: Math.round(game.lastMoleTime), score: game.score,
    });
  } else if (!stalled && warned) {
    warned = false; // 恢复后允许再次告警
  }
}
