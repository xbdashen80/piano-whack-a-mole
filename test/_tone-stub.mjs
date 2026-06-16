// 轻量 Tone.js 桩：让 initAudio 能在 Node 里完整构图（全部 no-op），
// 使依赖 startGame 的测试输出干净。不模拟真实声音——音质只能在浏览器验证。
// 注意：p0-levelclear 故意不用本桩（它要让音效抛错以验证安全网）。
function node() {
  return new Proxy({}, {
    get(_t, p) {
      if (p === 'value') return 0;
      if (p === 'state') return 'stopped';
      if (['volume', 'gain', 'frequency', 'bpm', 'detune'].includes(p)) return { value: 0, rampTo() {}, setValueAtTime() {} };
      return () => node(); // connect / triggerAttackRelease / toDestination / start / set ... 均链式 no-op
    },
  });
}
const ctor = function () { return node(); };

globalThis.Tone = {
  start: async () => {},
  now: () => 0,
  getDestination: () => node(),
  Draw: { schedule: () => {} },
  Transport: { bpm: { value: 0, rampTo() {}, setValueAtTime() {} }, start() {}, stop() {} },
  Frequency: () => ({ toFrequency: () => 440, transpose: () => ({ toNote: () => 'C2' }) }),
  Limiter: ctor, Compressor: ctor, EQ3: ctor, Gain: ctor, Reverb: ctor, Filter: ctor, Distortion: ctor,
  MembraneSynth: ctor, NoiseSynth: ctor, Synth: ctor, MonoSynth: ctor, PolySynth: ctor, Loop: ctor,
};
