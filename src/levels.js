// ================= 纯数据 + 小工具 =================
// 白键 MIDI 音高（C4 起，一个多八度），关卡按 keys 取前 N 个
export const WHITE = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];

export const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiName = m => NM[m % 12];

// 手指编号配色：1拇指 2食指 3中指 4无名指 5小指
export const FINGER_COLORS = { 1: '#FF9D9D', 2: '#FFC371', 3: '#9DE5B5', 4: '#9DB4FF', 5: '#D9A0FF' };
export const fingerFor = idx => (idx % 5) + 1;

// 目标圈 / 特效配色
export const palettes = [
  ['#FF6B9D', '#FFC371'], ['#5DCAA5', '#3CE0C0'], ['#7F77DD', '#B5A0FF'],
  ['#378ADD', '#6BC0FF'], ['#EF9F27', '#FFD166'], ['#E24B4A', '#FF8585'], ['#1D9E75', '#5DE0B0']
];

export const MUSIC_NAMES = ['🎵欢快', '🎵放克', '🎵舞曲', '🎵快板', '🎵终章'];

// music: 0=轻松 1=明快 2=有劲 3=紧张 4=激烈 (背景音乐档位,随关卡递进)
export const LEVELS = [
  // 3键 (6小台阶)
  { keys: 3, spawn: [1400, 1800], ttl: 3200, maxActive: 1, goal: 160, sink: 0.016, bounce: 0.17, music: 0, t: '3键 启程' },
  { keys: 3, spawn: [1250, 1650], ttl: 3000, maxActive: 1, goal: 200, sink: 0.018, bounce: 0.16, music: 0, t: '3键 入门' },
  { keys: 3, spawn: [1100, 1450], ttl: 2750, maxActive: 1, goal: 240, sink: 0.021, bounce: 0.16, music: 0, t: '3键 适应' },
  { keys: 3, spawn: [950, 1250], ttl: 2500, maxActive: 1, goal: 290, sink: 0.024, bounce: 0.15, music: 0, t: '3键 熟练' },
  { keys: 3, spawn: [820, 1100], ttl: 2250, maxActive: 1, goal: 340, sink: 0.027, bounce: 0.15, music: 1, t: '3键 加速' },
  { keys: 3, spawn: [700, 1000], ttl: 2000, maxActive: 2, goal: 400, sink: 0.030, bounce: 0.15, music: 1, t: '3键 双发' },
  // 4键 (5)
  { keys: 4, spawn: [1150, 1500], ttl: 2800, maxActive: 1, goal: 330, sink: 0.022, bounce: 0.16, music: 1, t: '4键 启程' },
  { keys: 4, spawn: [1000, 1350], ttl: 2600, maxActive: 1, goal: 390, sink: 0.025, bounce: 0.15, music: 1, t: '4键 入门' },
  { keys: 4, spawn: [860, 1180], ttl: 2350, maxActive: 1, goal: 450, sink: 0.028, bounce: 0.15, music: 1, t: '4键 熟练' },
  { keys: 4, spawn: [740, 1020], ttl: 2100, maxActive: 2, goal: 520, sink: 0.031, bounce: 0.14, music: 2, t: '4键 加速' },
  { keys: 4, spawn: [640, 900], ttl: 1900, maxActive: 2, goal: 600, sink: 0.034, bounce: 0.14, music: 2, t: '4键 双发' },
  // 5键 (5)
  { keys: 5, spawn: [1050, 1400], ttl: 2700, maxActive: 1, goal: 480, sink: 0.025, bounce: 0.15, music: 2, t: '5键 启程' },
  { keys: 5, spawn: [900, 1250], ttl: 2450, maxActive: 1, goal: 550, sink: 0.028, bounce: 0.14, music: 2, t: '5键 入门' },
  { keys: 5, spawn: [780, 1080], ttl: 2200, maxActive: 2, goal: 640, sink: 0.031, bounce: 0.14, music: 2, t: '5键 熟练' },
  { keys: 5, spawn: [680, 950], ttl: 2000, maxActive: 2, goal: 730, sink: 0.034, bounce: 0.13, music: 2, t: '5键 加速' },
  { keys: 5, spawn: [590, 830], ttl: 1800, maxActive: 2, goal: 830, sink: 0.037, bounce: 0.13, music: 3, t: '5键 高速' },
  // 6键 (4)
  { keys: 6, spawn: [900, 1250], ttl: 2400, maxActive: 2, goal: 660, sink: 0.030, bounce: 0.14, music: 3, t: '6键 入门' },
  { keys: 6, spawn: [780, 1080], ttl: 2150, maxActive: 2, goal: 760, sink: 0.033, bounce: 0.13, music: 3, t: '6键 熟练' },
  { keys: 6, spawn: [680, 940], ttl: 1900, maxActive: 2, goal: 870, sink: 0.037, bounce: 0.13, music: 3, t: '6键 加速' },
  { keys: 6, spawn: [590, 820], ttl: 1700, maxActive: 3, goal: 1000, sink: 0.040, bounce: 0.12, music: 3, t: '6键 高速' },
  // 7键 (4)
  { keys: 7, spawn: [820, 1120], ttl: 2150, maxActive: 2, goal: 840, sink: 0.034, bounce: 0.13, music: 3, t: '7键 入门' },
  { keys: 7, spawn: [720, 1000], ttl: 1950, maxActive: 2, goal: 960, sink: 0.037, bounce: 0.12, music: 3, t: '7键 熟练' },
  { keys: 7, spawn: [620, 860], ttl: 1750, maxActive: 3, goal: 1100, sink: 0.040, bounce: 0.12, music: 4, t: '7键 加速' },
  { keys: 7, spawn: [540, 760], ttl: 1600, maxActive: 3, goal: 1250, sink: 0.044, bounce: 0.11, music: 4, t: '7键 高速' },
  // 8键 (3)
  { keys: 8, spawn: [680, 940], ttl: 1850, maxActive: 2, goal: 1080, sink: 0.038, bounce: 0.12, music: 4, t: '8键 入门' },
  { keys: 8, spawn: [580, 820], ttl: 1650, maxActive: 3, goal: 1240, sink: 0.042, bounce: 0.11, music: 4, t: '8键 加速' },
  { keys: 8, spawn: [510, 720], ttl: 1500, maxActive: 3, goal: 1420, sink: 0.046, bounce: 0.11, music: 4, t: '8键 高速' },
  // 10键 (2)
  { keys: 10, spawn: [540, 780], ttl: 1550, maxActive: 3, goal: 1350, sink: 0.046, bounce: 0.11, music: 4, t: '10键 挑战' },
  { keys: 10, spawn: [450, 660], ttl: 1380, maxActive: 3, goal: 1600, sink: 0.052, bounce: 0.10, music: 4, t: '10键 高速' },
  // 12键 疯狂 (1)
  { keys: 12, spawn: [370, 580], ttl: 1180, maxActive: 4, goal: 1900, sink: 0.060, bounce: 0.10, music: 4, t: '12键 疯狂' },
];

// 5档递进背景乐:每档都是完整、够嗨的律动,靠风格/旋律不同来递进,不是靠放慢
export const MUSIC = [
  { // 0 欢快流行:轻松但有完整节奏和旋律
    tier: 0, bpm: 118,
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    bass: ['C2', null, 'C2', null, 'A1', null, 'A1', null, 'F1', null, 'F1', null, 'G1', null, 'G1', null],
    lead: ['E4', null, 'G4', null, 'C5', null, 'G4', null, 'A4', null, 'F4', null, 'G4', null, 'D4', null]
  },
  { // 1 律动放克:加切分,更弹
    tier: 1, bpm: 124,
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0],
    bass: ['C2', null, 'G1', 'C2', 'A1', null, 'E1', 'A1', 'F1', null, 'C1', 'F1', 'G1', null, 'D1', 'G1'],
    lead: ['C5', null, null, 'E5', 'G4', null, null, 'C5', 'F4', null, null, 'A4', 'G4', null, null, 'B4']
  },
  { // 2 电子舞曲:四踩底鼓,有劲
    tier: 2, bpm: 128,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    bass: ['C2', 'C2', null, 'C2', 'A1', 'A1', null, 'A1', 'F1', 'F1', null, 'F1', 'G1', 'G1', null, 'G1'],
    lead: ['C5', 'E5', 'G5', 'E5', 'A4', 'C5', 'E5', 'C5', 'F4', 'A4', 'C5', 'A4', 'G4', 'B4', 'D5', 'B4']
  },
  { // 3 紧张快板:密鼓,推进感强
    tier: 3, bpm: 138,
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    bass: ['C2', 'C2', 'C2', 'C2', 'A1', 'A1', 'A1', 'A1', 'F1', 'F1', 'F1', 'F1', 'G1', 'G1', 'G1', 'G1'],
    lead: ['C5', null, 'D5', 'E5', 'G5', null, 'E5', 'C5', 'A4', null, 'F4', 'A4', 'G4', null, 'B4', 'D5']
  },
  { // 4 激烈终章:最快,炸裂全开
    tier: 4, bpm: 150,
    kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    bass: ['C2', 'C2', 'G1', 'C2', 'A1', 'A1', 'E1', 'A1', 'F1', 'F1', 'C1', 'F1', 'G1', 'G1', 'D1', 'G1'],
    lead: ['C5', 'E5', 'G5', 'C6', 'B5', 'G5', 'E5', 'C5', 'A5', 'F5', 'D5', 'A4', 'G5', 'D5', 'B4', 'G4']
  }
];
