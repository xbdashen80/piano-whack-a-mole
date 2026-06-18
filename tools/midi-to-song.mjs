// 一次性转换脚本（不进打包流程）：把简化版《天空之城》MIDI 解析成歌曲模式的音符数据。
// 用法：先临时装依赖再运行——
//   npm i -D @tonejs/midi
//   node tools/midi-to-song.mjs laputa.mid
// 它会 (1) 打印 MIDI 结构/音域/是否有黑键的报告到 stderr，(2) 把 rightHand 数组 JS 写到 tools/_out.js。
// 校对无误后把 _out.js 的内容贴进 src/levels.js 的 SONGS.laputa.levels[0].rightHand，然后卸载依赖、删 _out.js。
import { readFileSync, writeFileSync } from 'node:fs';
import pkg from '@tonejs/midi';
const { Midi } = pkg;

const file = process.argv[2] || 'laputa.mid';
const midi = new Midi(readFileSync(file));
const ppq = midi.header.ppq;
const bpm = Math.round(midi.header.tempos[0]?.bpm || 70);
const log = (...a) => console.error(...a);

log(`文件: ${file}  PPQ=${ppq}  速度=${bpm}bpm  轨数=${midi.tracks.length}`);
midi.tracks.forEach((t, i) => log(`  轨${i}: name="${t.name}" 音符=${t.notes.length}`));

// 选主旋律轨 = 平均音高最高的轨（右手旋律）；忽略左手伴奏轨。再按起拍取每组最高音 = 单行旋律（化解个别和弦）。
const avgPitch = t => t.notes.reduce((s, n) => s + n.midi, 0) / (t.notes.length || 1);
const melodyTrack = midi.tracks.reduce((best, t) => avgPitch(t) > avgPitch(best) ? t : best);
log(`选定主旋律轨: name="${melodyTrack.name}" 音符=${melodyTrack.notes.length} 均值midi=${avgPitch(melodyTrack).toFixed(0)}`);
const all = melodyTrack.notes.slice().sort((a, b) => a.ticks - b.ticks);

const Q = 0.25; // 量化网格(拍)：能表达八分/附点/十六分
const qz = beats => Math.round(beats / Q) * Q;
const groups = new Map(); // startBeat -> {midi, durBeats}
for (const n of all) {
  const sb = qz(n.ticks / ppq);
  const durBeats = n.durationTicks / ppq;
  const g = groups.get(sb);
  if (!g || n.midi > g.midi) groups.set(sb, { midi: n.midi, durBeats });
}
const starts = [...groups.keys()].sort((a, b) => a - b);

// 时值命名（对齐 render.js 的 DUR_BEATS）
const DUR = [['whole', 4], ['dotted-half', 3], ['half', 2], ['dotted-quarter', 1.5], ['quarter', 1], ['eighth', 0.5]];
const nameDur = b => DUR.reduce((best, [name, v]) => Math.abs(v - b) < Math.abs(best[1] - b) ? [name, v] : best, ['eighth', 0.5])[0];

const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);
const sci = m => NM[m % 12].replace('#', '#') + (Math.floor(m / 12) - 1);
const whiteIndex = m => { let c = 0; for (let x = 24; x < m; x++) if (WHITE.has(x % 12)) c++; return c; }; // 从 C1 起白键序号

const midis = starts.map(s => groups.get(s).midi);
const lo = Math.min(...midis), hi = Math.max(...midis);
const minW = whiteIndex(lo);
const blacks = starts.filter(s => !WHITE.has(groups.get(s).midi % 12));
log(`音符数=${starts.length}  音域=${sci(lo)}..${sci(hi)}  黑键(临时记号)=${blacks.length}`);
if (blacks.length) log('  ⚠ 含黑键: ' + blacks.map(s => sci(groups.get(s).midi) + '@' + s).join(', '));

// 输出本项目格式；finger 为近似教学提示（在白键音域内滚动 1..5，不参与判定）
const notes = starts.map(s => {
  const g = groups.get(s); const finger = ((whiteIndex(g.midi) - minW) % 5 + 5) % 5 + 1;
  return { pitch: sci(g.midi), midi: g.midi, finger, duration: nameDur(g.durBeats), startBeat: +s.toFixed(2) };
});
const arr = notes.map(n =>
  `  { pitch: '${n.pitch}', midi: ${n.midi}, finger: ${n.finger}, duration: '${n.duration}', startBeat: ${n.startBeat} },`
).join('\n');
const out = `// ⚠ 由 tools/midi-to-song.mjs 从 ${file} 自动生成——勿手改；改旋律请改源 MIDI 后重跑转换。\n` +
  `// 《天空之城》主旋律(单行)，仅供个人练习。演奏速度由源 MIDI 得出。\n` +
  `export const LAPUTA_BPM = ${bpm};\nexport const LAPUTA_RIGHT_HAND = [\n${arr}\n];\n`;
writeFileSync('src/song-laputa.js', out);
log(`\n已写 src/song-laputa.js（${notes.length} 个音）。演奏速度 bpm=${bpm}。`);
