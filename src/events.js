// 极简事件总线：用于打破模块间的反向依赖
// 例：midi → 'press' → game；ui → 'start'/'pauseToggle' → game；bear → 'gameOver' → game
const handlers = new Map();

export function on(event, fn) {
  if (!handlers.has(event)) handlers.set(event, []);
  handlers.get(event).push(fn);
}

export function emit(event, ...args) {
  const list = handlers.get(event);
  if (list) list.forEach(fn => fn(...args));
}
