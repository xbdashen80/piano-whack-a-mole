// ================= Tone.js 封装 =================
// 背景鼓机/贝斯/旋律 + 命中等音效。Tone 由 index.html 的 CDN 脚本以全局形式提供。
import { MUSIC } from './levels.js';
import { game } from './state.js';
import { logErr } from './diagnostics.js';

export const audio = { ready: false, bgmOn: true, sfxOn: true };

// 音效排程游标：单音合成器要求每次触发的开始时间严格递增，否则 Tone 抛
// "Start time must be strictly greater than previous start time"，而该异常曾在
// 过关瞬间冒泡进 levelClear，导致弹窗不显示、游戏僵死（P0 根因）。
let sfxClock = 0;
function sfxBase() { const t = Math.max(Tone.now(), sfxClock + 0.002); return t; }
function bump(t) { if (t > sfxClock) sfxClock = t; }
// 任何音频异常都不得冒泡进游戏逻辑：音效是副作用，绝不能阻断状态机。
function safe(fn) { try { fn(); } catch (e) { logErr('audio', e); } }

let hitSynth, hitSynth2, arpSynth, loseSynth, reverb, sfxBus, bgmBus, kick, snare, hat, bass, lead, drumLoop;

export async function initAudio() {
  if (audio.ready) return;
  await Tone.start();
  Tone.Transport.bpm.value = 96;
  reverb = new Tone.Reverb({ decay: 1.6, wet: 0.22 }).toDestination();
  sfxBus = new Tone.Gain(0.9).connect(reverb); sfxBus.connect(Tone.getDestination());
  hitSynth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 } }).connect(sfxBus); hitSynth.volume.value = -6;
  hitSynth2 = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.06 } }).connect(sfxBus); hitSynth2.volume.value = -12;
  arpSynth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.1, sustain: 0.05, release: 0.1 } }).connect(sfxBus); arpSynth.volume.value = -7;
  loseSynth = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.1 } }).connect(sfxBus); loseSynth.volume.value = -8;
  bgmBus = new Tone.Gain(0.7).toDestination();
  kick = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 6, envelope: { attack: 0.001, decay: 0.32, sustain: 0 } }).connect(bgmBus); kick.volume.value = -3;
  snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } }).connect(bgmBus); snare.volume.value = -12;
  hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 } }).connect(bgmBus); hat.volume.value = -20;
  bass = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.2 } }).connect(bgmBus); bass.volume.value = -10;
  lead = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 } }).connect(bgmBus); lead.volume.value = -13;
  let step = 0;
  drumLoop = new Tone.Loop((time) => {
    const s = step % 16; const M = MUSIC[game.musicTier];
    if (M.kick[s]) { kick.triggerAttackRelease('C1', '8n', time); Tone.Draw.schedule(() => { game.beatPulse = 1; }, time); }
    if (M.snare[s]) snare.triggerAttackRelease('16n', time);
    if (M.hat[s]) hat.triggerAttackRelease('32n', time, M.tier >= 3 ? 0.8 : 0.5);
    if (M.bass && M.bass[s]) bass.triggerAttackRelease(M.bass[s], '8n', time);
    if (M.lead && M.lead[s]) lead.triggerAttackRelease(M.lead[s], '16n', time);
    step++;
  }, '16n');
  audio.ready = true;
}

export function setMusicTier(t) {
  game.musicTier = Math.max(0, Math.min(MUSIC.length - 1, t));
  if (audio.ready) Tone.Transport.bpm.rampTo(MUSIC[game.musicTier].bpm, 0.6);
}

export function startBgm() {
  if (!audio.ready) return;
  Tone.Transport.bpm.value = MUSIC[game.musicTier].bpm; Tone.Transport.start();
  if (audio.bgmOn && drumLoop.state !== 'started') drumLoop.start(0);
  bgmBus.gain.rampTo(audio.bgmOn ? 0.7 : 0, 0.4);
}

export function setBgm(on) {
  audio.bgmOn = on;
  if (audio.ready && bgmBus) bgmBus.gain.rampTo(on ? 0.7 : 0, 0.3);
}

export function setSfx(on) { audio.sfxOn = on; }

// 失败时把背景乐压低
export function duckBgm() { if (bgmBus) bgmBus.gain.rampTo(0.15, 0.5); }

export function sfxHit(midi, perfect, comboN) {
  if (!audio.sfxOn || !audio.ready) return;
  safe(() => {
    const base = Tone.Frequency(midi, 'midi').toFrequency(); const pitch = base * (1 + Math.min(comboN, 12) * 0.06);
    const t = sfxBase(); hitSynth.triggerAttackRelease(pitch, '16n', t, perfect ? 1 : 0.8); hitSynth2.triggerAttackRelease(pitch * 2, '32n', t, 0.6); bump(t);
  });
}
export function sfxCombo() {
  if (!audio.sfxOn || !audio.ready) return;
  safe(() => {
    const notes = ['C5', 'E5', 'G5', 'C6']; const t = sfxBase();
    notes.forEach((n, i) => arpSynth.triggerAttackRelease(n, '16n', t + i * 0.05)); bump(t + notes.length * 0.05);
  });
}
export function sfxLevel() {
  if (!audio.sfxOn || !audio.ready) return;
  safe(() => {
    const notes = ['C5', 'D5', 'E5', 'G5', 'C6', 'E6']; const t = sfxBase();
    notes.forEach((n, i) => arpSynth.triggerAttackRelease(n, '16n', t + i * 0.08, 0.95)); bump(t + notes.length * 0.08);
  });
}
export function sfxMiss() {
  if (!audio.sfxOn || !audio.ready) return;
  safe(() => { const t = sfxBase(); loseSynth.triggerAttackRelease('A3', '8n', t); loseSynth.frequency.rampTo('A2', 0.2); bump(t); });
}
export function sfxSplash() {
  if (!audio.sfxOn || !audio.ready) return;
  safe(() => {
    const t = sfxBase(); loseSynth.triggerAttackRelease('C3', '4n', t); loseSynth.frequency.setValueAtTime('C3', t); loseSynth.frequency.rampTo('C2', 0.4); bump(t);
  });
}
export function sfxTick() {
  if (!audio.sfxOn || !audio.ready) return;
  safe(() => { const t = sfxBase(); hat.triggerAttackRelease('64n', t, 0.5); bump(t); });
}
