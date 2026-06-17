// ================= 纯数据 + 小工具 =================
// 白键 MIDI 音高（C4 起，一个多八度）
export const WHITE = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];

// 一关的活动键 = 从 off 起的 keys 个白键（off 默认 0=中央C）。"换把位"靠它实现：
// 手整体移到别处仍是五指位，无需穿指。off 白键序：C=0 D=1 E=2 F=3 G=4 A=5。
export const activeMidis = L => WHITE.slice((L.off || 0), (L.off || 0) + L.keys);

export const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiName = m => NM[m % 12];

// 手指编号配色：1拇指 2食指 3中指 4无名指 5小指
export const FINGER_COLORS = { 1: '#FF9D9D', 2: '#FFC371', 3: '#9DE5B5', 4: '#9DB4FF', 5: '#D9A0FF' };
// 真实右手指法：
//  · 5 键以内 = "五指位"，手不动，1 2 3 4 5 依次对应窗口里从低到高的 5 个键（拇指在最低音）。
//  · 6 键及以上 = C 大调音阶(off 恒 0)，5 指不够用，必须"拇指穿掌"：标准右手指法每七度循环
//    1 2 3 1 2 3 4（拇指在每个 C、F 穿到手下变回 1 指）；若整段最高音正好落在主音 C
//    （一个完整八度的收尾）用 5 指收。idx 即该键在窗口内的序号。
const RH_SCALE = [1, 2, 3, 1, 2, 3, 4];
export const fingerFor = (idx, keys) => {
  if (keys <= 5) return idx + 1;                    // 五指位
  if (idx === keys - 1 && idx % 7 === 0) return 5;  // 音阶收尾落在主音 C
  return RH_SCALE[idx % 7];
};

// 目标圈 / 特效配色
export const palettes = [
  ['#FF6B9D', '#FFC371'], ['#5DCAA5', '#3CE0C0'], ['#7F77DD', '#B5A0FF'],
  ['#378ADD', '#6BC0FF'], ['#EF9F27', '#FFD166'], ['#E24B4A', '#FF8585'], ['#1D9E75', '#5DE0B0']
];

export const MUSIC_NAMES = ['🎵欢快', '🎵放克', '🎵舞曲', '🎵快板', '🎵终章'];

// music: 0=轻松 1=明快 2=有劲 3=紧张 4=激烈 (背景音乐档位,随关卡递进)
// ===================== 主体：五指位（≤5键、手不动、不穿指） =====================
// 难度靠 速度/节奏/换把位(off) 增长；每换一个新把位，第一关明显放慢+单发"熟悉把位"。
// ===================== 后期：进阶·穿指音阶（6~12键、off0） =====================
// 标题前缀"进阶·穿指"，入口很慢、单发，让手慢慢练拇指穿掌；炸弹只在此段出现(见 game.js)。
export const LEVELS = [
  // ---- C 位（off0: C D E F G）：3→4→5 键渐入 ----
  { keys: 3, off: 0, spawn: [1900, 2400], ttl: 3600, maxActive: 1, goal: 110, sink: 0.012, bounce: 0.18, music: 0, t: 'C位 启程·3键' },
  { keys: 3, off: 0, spawn: [1700, 2150], ttl: 3500, maxActive: 1, goal: 150, sink: 0.013, bounce: 0.18, music: 0, t: 'C位 3键 熟练' },
  { keys: 4, off: 0, spawn: [1650, 2050], ttl: 3450, maxActive: 1, goal: 200, sink: 0.013, bounce: 0.17, music: 0, t: 'C位 加4指' },
  { keys: 4, off: 0, spawn: [1480, 1880], ttl: 3350, maxActive: 1, goal: 260, sink: 0.014, bounce: 0.17, music: 0, t: 'C位 4键 熟练' },
  { keys: 5, off: 0, spawn: [1400, 1800], ttl: 3300, maxActive: 1, goal: 330, sink: 0.015, bounce: 0.17, music: 1, t: 'C位 满五指' },
  { keys: 5, off: 0, spawn: [1250, 1620], ttl: 3150, maxActive: 1, goal: 400, sink: 0.016, bounce: 0.16, music: 1, t: 'C位 五指 熟练' },
  { keys: 5, off: 0, spawn: [1120, 1460], ttl: 3000, maxActive: 1, goal: 470, sink: 0.017, bounce: 0.16, music: 1, t: 'C位 五指 加速' },
  { keys: 5, off: 0, spawn: [1020, 1340], ttl: 2850, maxActive: 2, goal: 550, sink: 0.018, bounce: 0.16, music: 1, t: 'C位 五指 双发' },
  // ---- G 位（off4: G A B C D）：换把位，从慢开始 ----
  { keys: 5, off: 4, spawn: [1400, 1800], ttl: 3200, maxActive: 1, goal: 480, sink: 0.015, bounce: 0.16, music: 2, t: 'G位 换把位·熟悉' },
  { keys: 5, off: 4, spawn: [1250, 1620], ttl: 3050, maxActive: 1, goal: 560, sink: 0.016, bounce: 0.15, music: 2, t: 'G位 五指 熟练' },
  { keys: 5, off: 4, spawn: [1120, 1460], ttl: 2900, maxActive: 1, goal: 650, sink: 0.017, bounce: 0.15, music: 2, t: 'G位 五指 加速' },
  { keys: 5, off: 4, spawn: [1020, 1340], ttl: 2750, maxActive: 2, goal: 750, sink: 0.018, bounce: 0.15, music: 2, t: 'G位 五指 双发' },
  // ---- D 位（off1: D E F G A）：换把位 ----
  { keys: 5, off: 1, spawn: [1350, 1750], ttl: 3050, maxActive: 1, goal: 680, sink: 0.016, bounce: 0.16, music: 2, t: 'D位 换把位·熟悉' },
  { keys: 5, off: 1, spawn: [1200, 1560], ttl: 2900, maxActive: 1, goal: 780, sink: 0.017, bounce: 0.15, music: 2, t: 'D位 五指 熟练' },
  { keys: 5, off: 1, spawn: [1080, 1420], ttl: 2750, maxActive: 2, goal: 890, sink: 0.018, bounce: 0.15, music: 3, t: 'D位 五指 双发' },
  // ---- A 位（off5: A B C D E）：换把位 ----
  { keys: 5, off: 5, spawn: [1300, 1700], ttl: 2950, maxActive: 1, goal: 850, sink: 0.017, bounce: 0.15, music: 3, t: 'A位 换把位·熟悉' },
  { keys: 5, off: 5, spawn: [1150, 1500], ttl: 2800, maxActive: 1, goal: 970, sink: 0.018, bounce: 0.14, music: 3, t: 'A位 五指 熟练' },
  { keys: 5, off: 5, spawn: [1040, 1360], ttl: 2650, maxActive: 2, goal: 1100, sink: 0.019, bounce: 0.14, music: 3, t: 'A位 五指 双发' },
  // ---- 五指综合提速（混把位，仍五指） ----
  { keys: 5, off: 0, spawn: [980, 1300], ttl: 2600, maxActive: 2, goal: 1150, sink: 0.019, bounce: 0.14, music: 3, t: 'C位 综合·提速' },
  { keys: 5, off: 4, spawn: [920, 1220], ttl: 2500, maxActive: 2, goal: 1300, sink: 0.020, bounce: 0.14, music: 3, t: 'G位 综合·提速' },
  // ===== 进阶·穿指音阶（off0，从这里起才出炸弹；入口很慢、单发） =====
  { keys: 6, off: 0, spawn: [1500, 1950], ttl: 3200, maxActive: 1, goal: 900, sink: 0.016, bounce: 0.16, music: 3, t: '进阶·穿指入门(F穿掌)' },
  { keys: 6, off: 0, spawn: [1330, 1730], ttl: 3000, maxActive: 1, goal: 1020, sink: 0.017, bounce: 0.15, music: 3, t: '进阶·穿指 6键熟练' },
  { keys: 7, off: 0, spawn: [1400, 1820], ttl: 3000, maxActive: 1, goal: 1150, sink: 0.017, bounce: 0.15, music: 3, t: '进阶·穿指 加7指' },
  { keys: 7, off: 0, spawn: [1230, 1600], ttl: 2800, maxActive: 2, goal: 1300, sink: 0.018, bounce: 0.14, music: 4, t: '进阶·穿指 7键加速' },
  { keys: 8, off: 0, spawn: [1300, 1700], ttl: 2800, maxActive: 1, goal: 1450, sink: 0.018, bounce: 0.14, music: 4, t: '进阶·满八度音阶' },
  { keys: 8, off: 0, spawn: [1150, 1500], ttl: 2600, maxActive: 2, goal: 1620, sink: 0.019, bounce: 0.14, music: 4, t: '进阶·八度 加速' },
  { keys: 10, off: 0, spawn: [1200, 1560], ttl: 2600, maxActive: 2, goal: 1800, sink: 0.020, bounce: 0.13, music: 4, t: '进阶·音阶扩展' },
  { keys: 12, off: 0, spawn: [1100, 1440], ttl: 2450, maxActive: 2, goal: 2000, sink: 0.021, bounce: 0.13, music: 4, t: '进阶·满键音阶' },
  { keys: 12, off: 0, spawn: [1000, 1320], ttl: 2300, maxActive: 3, goal: 2230, sink: 0.022, bounce: 0.12, music: 4, t: '进阶·穿指 疯狂' },
];

// ===================== 歌曲模式（Song Mode）数据 =====================
// 与打地鼠的 LEVELS 并列、互不影响。一首歌 = 一组由易到难的渐进关卡，每关一串音符。
// 音符 { pitch(仅供人读), midi(★判定以此为准), finger(1-5 右手指, 仅作教学提示), duration, startBeat }。
// 第一阶段只实现《天空之城》关卡 1（C 大调骨架, 全四分音符, 不判节奏, 只判音高顺序）。
export const SONGS = {
  laputa: {
    title: '天空之城', key: 'C', timeSignature: '4/4',
    levels: [
      {
        id: 1, name: '认骨架', bpm: 50,
        rightHand: [
          // 小节1 (startBeat 0-3)
          { pitch: 'E5', midi: 76, finger: 3, duration: 'quarter', startBeat: 0 },
          { pitch: 'D5', midi: 74, finger: 2, duration: 'quarter', startBeat: 1 },
          { pitch: 'B4', midi: 71, finger: 1, duration: 'quarter', startBeat: 2 },
          { pitch: 'A4', midi: 69, finger: 1, duration: 'quarter', startBeat: 3 },
          // 小节2 (4-7)，第4拍休止
          { pitch: 'B4', midi: 71, finger: 1, duration: 'quarter', startBeat: 4 },
          { pitch: 'E5', midi: 76, finger: 3, duration: 'quarter', startBeat: 5 },
          { pitch: 'E5', midi: 76, finger: 3, duration: 'quarter', startBeat: 6 },
          // 小节3 (8-11)
          { pitch: 'A5', midi: 81, finger: 5, duration: 'quarter', startBeat: 8 },
          { pitch: 'G5', midi: 79, finger: 4, duration: 'quarter', startBeat: 9 },
          { pitch: 'E5', midi: 76, finger: 2, duration: 'quarter', startBeat: 10 },
          { pitch: 'D5', midi: 74, finger: 1, duration: 'quarter', startBeat: 11 },
          // 小节4 (12-15)，第4拍休止
          { pitch: 'E5', midi: 76, finger: 2, duration: 'quarter', startBeat: 12 },
          { pitch: 'G5', midi: 79, finger: 4, duration: 'quarter', startBeat: 13 },
          { pitch: 'G5', midi: 79, finger: 4, duration: 'quarter', startBeat: 14 },
          // 小节5 (16-19)
          { pitch: 'F5', midi: 77, finger: 3, duration: 'quarter', startBeat: 16 },
          { pitch: 'E5', midi: 76, finger: 2, duration: 'quarter', startBeat: 17 },
          { pitch: 'D5', midi: 74, finger: 1, duration: 'quarter', startBeat: 18 },
          { pitch: 'C5', midi: 72, finger: 1, duration: 'quarter', startBeat: 19 },
          // 小节6 (20-23)
          { pitch: 'D5', midi: 74, finger: 1, duration: 'quarter', startBeat: 20 },
          { pitch: 'E5', midi: 76, finger: 2, duration: 'quarter', startBeat: 21 },
          { pitch: 'C5', midi: 72, finger: 1, duration: 'quarter', startBeat: 22 },
          { pitch: 'B4', midi: 71, finger: 1, duration: 'quarter', startBeat: 23 },
          // 小节7 (24-27)
          { pitch: 'A4', midi: 69, finger: 1, duration: 'quarter', startBeat: 24 },
          { pitch: 'B4', midi: 71, finger: 2, duration: 'quarter', startBeat: 25 },
          { pitch: 'C5', midi: 72, finger: 3, duration: 'quarter', startBeat: 26 },
          { pitch: 'E5', midi: 76, finger: 5, duration: 'quarter', startBeat: 27 },
          // 小节8 (28-31)，第4拍休止
          { pitch: 'D5', midi: 74, finger: 2, duration: 'quarter', startBeat: 28 },
          { pitch: 'B4', midi: 71, finger: 1, duration: 'quarter', startBeat: 29 },
          { pitch: 'A4', midi: 69, finger: 1, duration: 'quarter', startBeat: 30 }
        ],
        leftHand: []
      }
      // 关卡 2(真实节奏)/4(左手根音)/7(配伴奏) 待补：先把关卡 1 整条链路跑通
    ]
  }
};

// 5档递进背景乐:每档是 2~4 小节乐句(每行=1 小节=16 步),靠旋律变奏 + 段末过门(fill)
// 减少循环重复感。和声骨架统一 C–A–F–G(i–vi–IV–V),pad 跟贝斯根音铺底。
// _ = 该步不触发(null 别名,纯为让谱子排版整齐可读)。drumLoop 用 step % 数组长度 循环。
const _ = null;
export const MUSIC = [
  { // 0 欢快流行:轻松但有完整节奏和旋律 —— 2 小节(A 主句 / B 变句带走音)
    tier: 0, bpm: 118,
    kick: [
      1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0,
      1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    snare: [
      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
    hat: [
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    bass: [
      'C2', _, 'C2', _, 'A1', _, 'A1', _, 'F1', _, 'F1', _, 'G1', _, 'G1', _,
      'C2', _, 'C2', _, 'A1', _, 'A1', _, 'F1', _, 'F1', _, 'G1', _, 'G1', 'B1'],
    lead: [
      'E4', _, 'G4', _, 'C5', _, 'G4', _, 'A4', _, 'F4', _, 'G4', _, 'D4', _,
      'E4', _, 'C5', _, 'D5', _, 'C5', _, 'A4', _, 'C5', _, 'B4', _, 'G4', _]
  },
  { // 1 律动放克:加切分,更弹 —— 2 小节(B 把旋律抬高八度作答)
    tier: 1, bpm: 124,
    kick: [
      1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0,
      1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1],
    snare: [
      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
      0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0],
    hat: [
      1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0,
      1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1],
    bass: [
      'C2', _, 'G1', 'C2', 'A1', _, 'E1', 'A1', 'F1', _, 'C1', 'F1', 'G1', _, 'D1', 'G1',
      'C2', _, 'G1', 'C2', 'A1', _, 'E1', 'A1', 'F1', _, 'C1', 'F1', 'G1', _, 'D1', 'B1'],
    lead: [
      'C5', _, _, 'E5', 'G4', _, _, 'C5', 'F4', _, _, 'A4', 'G4', _, _, 'B4',
      'E5', _, _, 'G5', 'C5', _, _, 'A4', 'A4', _, _, 'C5', 'B4', _, _, 'D5']
  },
  { // 2 电子舞曲:四踩底鼓,有劲 —— 4 小节(B 上行变奏 / C 回主句 / D 过门 + hat 推进)
    tier: 2, bpm: 128,
    kick: [
      1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
      1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
      1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
      1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    snare: [
      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1],
    hat: [
      0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0,
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    bass: [
      'C2', 'C2', _, 'C2', 'A1', 'A1', _, 'A1', 'F1', 'F1', _, 'F1', 'G1', 'G1', _, 'G1',
      'C2', 'C2', _, 'C2', 'A1', 'A1', _, 'A1', 'F1', 'F1', _, 'F1', 'G1', 'G1', _, 'G1',
      'C2', 'C2', _, 'C2', 'A1', 'A1', _, 'A1', 'F1', 'F1', _, 'F1', 'G1', 'G1', _, 'G1',
      'C2', 'C2', _, 'C2', 'A1', 'A1', _, 'A1', 'F1', 'F1', _, 'F1', 'G1', 'G1', _, 'B1'],
    lead: [
      'C5', 'E5', 'G5', 'E5', 'A4', 'C5', 'E5', 'C5', 'F4', 'A4', 'C5', 'A4', 'G4', 'B4', 'D5', 'B4',
      'E5', 'G5', 'C6', 'G5', 'C5', 'E5', 'A5', 'E5', 'A4', 'C5', 'F5', 'C5', 'B4', 'D5', 'G5', 'D5',
      'C5', 'E5', 'G5', 'E5', 'A4', 'C5', 'E5', 'C5', 'F4', 'A4', 'C5', 'A4', 'G4', 'B4', 'D5', 'B4',
      'G5', 'E5', 'C5', 'G4', 'A5', 'C5', 'E5', 'A4', 'F5', 'C5', 'A4', 'F4', 'G5', 'D5', 'B4', 'G4']
  },
  { // 3 紧张快板:密鼓,推进感强 —— 4 小节(B 高八度问答 / D 鼓 fill 收尾)
    tier: 3, bpm: 138,
    kick: [
      1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1],
    snare: [
      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1,
      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1,
      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1,
      0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1],
    hat: [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    bass: [
      'C2', 'C2', 'C2', 'C2', 'A1', 'A1', 'A1', 'A1', 'F1', 'F1', 'F1', 'F1', 'G1', 'G1', 'G1', 'G1',
      'C2', 'C2', 'C2', 'C2', 'A1', 'A1', 'A1', 'A1', 'F1', 'F1', 'F1', 'F1', 'G1', 'G1', 'G1', 'G1',
      'C2', 'C2', 'C2', 'C2', 'A1', 'A1', 'A1', 'A1', 'F1', 'F1', 'F1', 'F1', 'G1', 'G1', 'G1', 'G1',
      'C2', 'C2', 'C2', 'C2', 'A1', 'A1', 'A1', 'A1', 'F1', 'F1', 'F1', 'F1', 'G1', 'G1', 'G1', 'B1'],
    lead: [
      'C5', _, 'D5', 'E5', 'G5', _, 'E5', 'C5', 'A4', _, 'F4', 'A4', 'G4', _, 'B4', 'D5',
      'E5', _, 'F5', 'G5', 'C6', _, 'G5', 'E5', 'A4', _, 'C5', 'A4', 'B4', _, 'D5', 'G5',
      'C5', _, 'D5', 'E5', 'G5', _, 'E5', 'C5', 'A4', _, 'F4', 'A4', 'G4', _, 'B4', 'D5',
      'G5', _, 'E5', 'C5', 'A5', _, 'F5', 'A4', 'F5', _, 'D5', 'A4', 'G5', _, 'D5', 'B4']
  },
  { // 4 激烈终章:最快,炸裂全开 —— 4 小节(B 高八度 / D 鼓滚 fill + 旋律下行收束)
    tier: 4, bpm: 150,
    kick: [
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1],
    snare: [
      0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1,
      0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1,
      0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1,
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1],
    hat: [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    bass: [
      'C2', 'C2', 'G1', 'C2', 'A1', 'A1', 'E1', 'A1', 'F1', 'F1', 'C1', 'F1', 'G1', 'G1', 'D1', 'G1',
      'C2', 'C2', 'G1', 'C2', 'A1', 'A1', 'E1', 'A1', 'F1', 'F1', 'C1', 'F1', 'G1', 'G1', 'D1', 'G1',
      'C2', 'C2', 'G1', 'C2', 'A1', 'A1', 'E1', 'A1', 'F1', 'F1', 'C1', 'F1', 'G1', 'G1', 'D1', 'G1',
      'C2', 'C2', 'G1', 'C2', 'A1', 'A1', 'E1', 'A1', 'F1', 'F1', 'C1', 'F1', 'G1', 'G1', 'D1', 'B1'],
    lead: [
      'C5', 'E5', 'G5', 'C6', 'B5', 'G5', 'E5', 'C5', 'A5', 'F5', 'D5', 'A4', 'G5', 'D5', 'B4', 'G4',
      'E5', 'G5', 'C6', 'E6', 'D6', 'B5', 'G5', 'E5', 'C6', 'A5', 'F5', 'C5', 'B5', 'G5', 'D5', 'B4',
      'C5', 'E5', 'G5', 'C6', 'B5', 'G5', 'E5', 'C5', 'A5', 'F5', 'D5', 'A4', 'G5', 'D5', 'B4', 'G4',
      'C6', 'B5', 'A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'A5', 'G5', 'F5', 'E5', 'D5', 'G5', 'B5', 'C6']
  }
];
