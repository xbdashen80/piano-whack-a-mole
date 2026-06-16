// ================= Tone.js 封装 =================
// 背景鼓机/贝斯/旋律 + 命中等音效。Tone 由 index.html 的 CDN 脚本以全局形式提供。
import { MUSIC } from './levels.js';
import { game } from './state.js';
import { emit } from './events.js';
import { logErr } from './diagnostics.js';

export const audio = { ready: false, bgmOn: true, sfxOn: true };

// 背景乐总音量基准（开关/闪避都相对它），推高一点让信号撞到限幅、更响更冲
const BGM_LEVEL = 0.85;

// 音效排程游标：单音合成器要求每次触发的开始时间严格递增，否则 Tone 抛
// "Start time must be strictly greater than previous start time"，而该异常曾在
// 过关瞬间冒泡进 levelClear，导致弹窗不显示、游戏僵死（P0 根因）。
let sfxClock = 0;
function sfxBase() { const t = Math.max(Tone.now(), sfxClock + 0.002); return t; }
function bump(t) { if (t > sfxClock) sfxClock = t; }
// 任何音频异常都不得冒泡进游戏逻辑：音效是副作用，绝不能阻断状态机。
function safe(fn) { try { fn(); } catch (e) { logErr('audio', e); } }

// 音效链
let hitSynth, hitSynth2, arpSynth, loseSynth, tickSynth, sfxReverb, sfxBus, boomNoise, boomFilter, boomDrive, boomSub;
// 背景乐：主控链 + 鼓组分层 + 贝斯/sub + 旋律 + 铺底 pad
let limiter, bgmComp, bgmEq, bgmBus, bgmReverb, bgmReverbSend, pumpGain, drumDrive;
let kick, kickClick, kickClickHP, snareNoise, snareBody, hat, hatHP, bass, sub, lead, pad, padFilter, drumLoop;

// 取第 s 步当前生效的贝斯根音（向前回溯到最近的非空），用于 pad 跟和声
function bassRootAt(M, s) {
  if (!M.bass) return null;
  for (let i = s; i >= 0; i--) if (M.bass[i]) return M.bass[i];
  return M.bass.find(Boolean) || null;
}
const semis = (note, n) => Tone.Frequency(note).transpose(n).toNote();

export async function initAudio() {
  if (audio.ready) return;
  await Tone.start();
  Tone.Transport.bpm.value = 96;

  // ---------- 总限幅器（防爆音，统一汇入） ----------
  limiter = new Tone.Limiter(-1).toDestination();

  // ---------- 音效链（独立于 bgm，不被闪避） ----------
  sfxReverb = new Tone.Reverb({ decay: 1.6, wet: 0.22 }).connect(limiter);
  sfxBus = new Tone.Gain(0.9).connect(sfxReverb); sfxBus.connect(limiter);
  hitSynth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 } }).connect(sfxBus); hitSynth.volume.value = -6;
  hitSynth2 = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.06 } }).connect(sfxBus); hitSynth2.volume.value = -12;
  arpSynth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.1, sustain: 0.05, release: 0.1 } }).connect(sfxBus); arpSynth.volume.value = -7;
  loseSynth = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.1 } }).connect(sfxBus); loseSynth.volume.value = -8;
  tickSynth = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 } }).connect(sfxBus); tickSynth.volume.value = -22;
  // 炸弹爆炸：棕噪经失真+低通=带颗粒的轰鸣，再叠一层低频 sub 增加胸腔冲击
  boomFilter = new Tone.Filter(1100, 'lowpass').connect(sfxBus);
  boomDrive = new Tone.Distortion({ distortion: 0.6, wet: 0.7 }).connect(boomFilter);
  boomNoise = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.7, sustain: 0 } }).connect(boomDrive); boomNoise.volume.value = 2;
  boomSub = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.55, sustain: 0, release: 0.1 } }).connect(sfxBus); boomSub.volume.value = -2;

  // ---------- 背景乐主控链：bgmBus → EQ3 → 压缩器 → 限幅器 ----------
  // 压缩更狠（阈值更低/比率更高），配合推高的 bgmBus 把整体响度顶到限幅，听感更冲。
  bgmComp = new Tone.Compressor({ threshold: -24, ratio: 4, attack: 0.003, release: 0.12 }).connect(limiter);
  bgmEq = new Tone.EQ3({ low: 4, mid: -1, high: 2.5, lowFrequency: 180, highFrequency: 3200 }).connect(bgmComp);
  bgmBus = new Tone.Gain(BGM_LEVEL).connect(bgmEq);        // bgm 总音量/开关/闪避都作用在这里
  bgmReverb = new Tone.Reverb({ decay: 2.0, wet: 1 }).connect(bgmBus); // 混响回流到 bgmBus，随 bgm 一起闪避
  bgmReverbSend = new Tone.Gain(0.18).connect(bgmReverb);  // 各乐器按需送一份到混响

  // 侧链泵：旋律/贝斯/pad 都汇到这里，每记 kick 把它瞬间压到 0.35 再 0.16s 回弹 →
  // 经典电子"泵感"，是冲击力最显著的来源。鼓不走这条，保持稳实。
  pumpGain = new Tone.Gain(1).connect(bgmBus);
  // 鼓组轻饱和总线：加谐波密度，鼓更有"拳头"；不参与侧链。
  drumDrive = new Tone.Distortion({ distortion: 0.2, wet: 0.35 }).connect(bgmBus);

  // ---------- 鼓组（分层 + click 瞬态，更冲更脆） ----------
  kick = new Tone.MembraneSynth({ pitchDecay: 0.045, octaves: 8, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.36, sustain: 0, release: 0.02 } }).connect(drumDrive); kick.volume.value = 0;
  // 高通噪声短促爆点，叠在 kick 头上给"咔"的瞬态冲击，小音箱也能感到拳头
  kickClickHP = new Tone.Filter(2200, 'highpass').connect(drumDrive);
  kickClick = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.0005, decay: 0.018, sustain: 0 } }).connect(kickClickHP); kickClick.volume.value = -13;
  snareNoise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0 } }).connect(drumDrive); snareNoise.volume.value = -11; snareNoise.connect(bgmReverbSend);
  snareBody = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.02 } }).connect(drumDrive); snareBody.volume.value = -15;
  hatHP = new Tone.Filter(7000, 'highpass').connect(drumDrive);
  hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 } }).connect(hatHP); hat.volume.value = -14;

  // ---------- 贝斯：带滤波包络的 MonoSynth + 低八度 sub（走侧链泵） ----------
  bass = new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, filter: { Q: 1, type: 'lowpass' }, filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.2, baseFrequency: 120, octaves: 2.6 }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.2 } }).connect(pumpGain); bass.volume.value = -7;
  sub = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.2 } }).connect(pumpGain); sub.volume.value = -11;

  // ---------- 旋律 + 铺底 pad（走侧链泵，补满空隙） ----------
  lead = new Tone.Synth({ oscillator: { type: 'fatsquare', count: 2, spread: 18 }, envelope: { attack: 0.01, decay: 0.12, sustain: 0.12, release: 0.12 } }).connect(pumpGain); lead.volume.value = -12; lead.connect(bgmReverbSend);
  padFilter = new Tone.Filter(1200, 'lowpass').connect(pumpGain); padFilter.connect(bgmReverbSend);
  pad = new Tone.PolySynth(Tone.Synth).connect(padFilter); pad.volume.value = -19;
  pad.set({ oscillator: { type: 'fatsawtooth', count: 2, spread: 20 }, envelope: { attack: 0.4, decay: 0.3, sustain: 0.7, release: 1.2 } });

  let step = 0;
  drumLoop = new Tone.Loop((time) => {
    const M = MUSIC[game.musicTier];
    const len = M.kick.length;
    const s = step % len;               // 乐句内步序（乐句可为多小节，16 的倍数）
    const bar = Math.floor(step / 16);  // 宏观小节计数：跨乐句持续累加，编排据此演进
    const beat = s % 16;                // 所属小节内的步序（fill / hat 补点判定）

    // ===== 节拍同步：四分音符栅格发"拍"事件，驱动地鼠卡鼓点生成（P2） =====
    // Tone.Draw 在音频时间到达 time 的视觉帧触发，回调里 performance.now() ≈ 可听见的鼓点，
    // 借此把音频时钟桥回游戏的 performance.now() 时钟。
    if (s % 4 === 0) { const ms = 60 / M.bpm * 1000, strong = !!M.kick[s]; Tone.Draw.schedule(() => emit('beat', ms, strong), time); }

    // ===== 宏观编排：每 4 小节一段、4 段成 16 小节大循环，做出"歌"的起伏，久听不腻 =====
    const block = Math.floor(bar / 4) % 4;        // 0 收 / 1 常 / 2 放(chorus) / 3 回
    // 狂热 Fever：强制 chorus 级强度，旋律抬八度，music 更炸（不改 BPM 以保持踩点同步）
    const intensity = game.fever ? 2 : [0, 1, 2, 1][block];
    const leadOct = M.tier <= 2 ? (game.fever ? 12 : [0, 0, 12, 0][block]) : 0; // 低档 chorus/狂热抬八度变亮；高档已够高不抬
    const fillBar = (bar % 4) === 3;              // 每 4 小节最后一小节加段尾过门
    const thin = intensity === 0 && M.tier < 4;   // 收段把旋律变稀给 chorus 留对比；终章不收

    if (M.kick[s]) {
      kick.triggerAttackRelease('C1', '8n', time);
      kickClick.triggerAttackRelease('16n', time, 0.9);
      // 侧链泵：kick 瞬间把旋律/贝斯/pad 压到 0.35，再 0.16s 回弹到 1 → "泵感"
      pumpGain.gain.setValueAtTime(0.35, time);
      pumpGain.gain.rampTo(1, 0.16, time);
      Tone.Draw.schedule(() => { game.beatPulse = 1; }, time);
    }
    if (M.snare[s]) { snareNoise.triggerAttackRelease('16n', time); snareBody.triggerAttackRelease('G3', '16n', time, 0.7); }
    // 段尾过门：每 4 小节最后一拍补一串 16 分军鼓渐强，推进到下一段
    if (fillBar && beat >= 13 && !M.snare[s]) snareNoise.triggerAttackRelease('32n', time, 0.3 + (beat - 13) * 0.18);
    // hi-hat：基础踩点力度微抖（人性化）；chorus 段把空拍也补成 16 分，密度更高
    if (M.hat[s]) hat.triggerAttackRelease('32n', time, (M.tier >= 3 ? 0.7 : 0.45) + Math.random() * 0.2);
    else if (intensity >= 2 && beat % 2 === 1) hat.triggerAttackRelease('32n', time, 0.22 + Math.random() * 0.15);
    if (M.bass && M.bass[s]) { bass.triggerAttackRelease(M.bass[s], '8n', time); sub.triggerAttackRelease(semis(M.bass[s], -12), '8n', time); }
    // 旋律：收段只在拍点(每 4 步)演奏、变稀；chorus 抬八度并加力度，做出明暗对比
    if (M.lead && M.lead[s] && (!thin || beat % 4 === 0)) {
      lead.triggerAttackRelease(semis(M.lead[s], leadOct), '16n', time, 0.55 + intensity * 0.12);
    }
    // 每半小节按当前贝斯根音铺纯五度和弦；放段多叠一个高八度顶音更饱满
    if (s % 8 === 0) {
      const r = bassRootAt(M, s);
      if (r) {
        const chord = [semis(r, 12), semis(r, 19), semis(r, 24)];
        if (intensity >= 2) chord.push(semis(r, 28));
        pad.triggerAttackRelease(chord, '2n', time, 0.42 + intensity * 0.08);
      }
    }
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
  // drumLoop 恒定运行：它现在还是节拍/生成的时钟源，静音由 bgmBus.gain 处理（关 BGM 也有拍可用）
  if (drumLoop.state !== 'started') drumLoop.start(0);
  bgmBus.gain.rampTo(audio.bgmOn ? BGM_LEVEL : 0, 0.4);
}

export function setBgm(on) {
  audio.bgmOn = on;
  if (audio.ready && bgmBus) bgmBus.gain.rampTo(on ? BGM_LEVEL : 0, 0.3);
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
  safe(() => { const t = sfxBase(); tickSynth.triggerAttackRelease('64n', t, 0.5); bump(t); });
}
// 敲到炸弹的一记震撼爆响：颗粒轰鸣 + 低频 sub 胸腔冲击 + 下坠 + 爆点
export function sfxBomb() {
  if (!audio.sfxOn || !audio.ready) return;
  safe(() => {
    const t = sfxBase();
    boomNoise.triggerAttackRelease('1n', t, 1);                 // 颗粒轰鸣
    boomSub.triggerAttackRelease('C1', '2n', t, 1); boomSub.frequency.setValueAtTime('C2', t); boomSub.frequency.rampTo('C0', 0.5); // 低频下坠胸腔感
    loseSynth.triggerAttackRelease('C2', '2n', t); loseSynth.frequency.setValueAtTime('C2', t); loseSynth.frequency.rampTo('C0', 0.5);
    tickSynth.triggerAttackRelease('8n', t, 1); bump(t + 0.12); // 起爆脆点
  });
}
// 金鼠命中的一记明亮 sparkle，区别于普通命中
export function sfxGold() {
  if (!audio.sfxOn || !audio.ready) return;
  safe(() => {
    const notes = ['G5', 'C6', 'E6', 'G6']; const t = sfxBase();
    notes.forEach((n, i) => arpSynth.triggerAttackRelease(n, '32n', t + i * 0.05, 0.9));
    tickSynth.triggerAttackRelease('32n', t + 0.02, 0.5); bump(t + notes.length * 0.05);
  });
}
// 结束/失败的一记下行 doom 收尾（淹水/炸弹通用）
export function sfxGameOver() {
  if (!audio.sfxOn || !audio.ready) return;
  safe(() => {
    const notes = ['G4', 'Eb4', 'C4', 'G3']; const t = sfxBase();
    notes.forEach((n, i) => loseSynth.triggerAttackRelease(n, '8n', t + i * 0.16, 0.9));
    boomSub && boomSub.triggerAttackRelease('C2', '1n', t + 0.1, 0.8);
    bump(t + notes.length * 0.16 + 0.1);
  });
}
// 进入狂热的一记上行 riser，宣告高潮
export function sfxFever() {
  if (!audio.sfxOn || !audio.ready) return;
  safe(() => {
    const notes = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7']; const t = sfxBase();
    notes.forEach((n, i) => arpSynth.triggerAttackRelease(n, '16n', t + i * 0.04, 1));
    tickSynth.triggerAttackRelease('16n', t + notes.length * 0.04, 0.8); bump(t + notes.length * 0.04 + 0.05);
  });
}
