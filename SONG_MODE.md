# 钢琴打地鼠 · 歌曲模式（Song Mode）接手文档

> 这是一份给 Claude Code 的接手说明。请先完整读一遍，再开始动手。
> **务必先读 `PROJECT.md` 和 `README.md`**，理解现有架构（事件总线、双时钟、数据驱动的 `levels.js`）后再开工。
> 本文件描述的是在**现有打地鼠成品之上新增的第二个游戏模式**，不是重构。

---

## 0. 一句话目标

在不动现有打地鼠的前提下，新增一个**「歌曲模式」**：玩家不再敲随机冒出的目标圈，而是**跟着一首真实歌曲的固定音符序列，按正确的音高 + 指法，把整首歌弹下来**。第一首歌是久石让《天空之城》（《君をのせて》）主题。

打地鼠练的是**基本功**（键位反应、指法、节奏感）；歌曲模式练的是**应用**（把基本功用到一首真歌上）。两者是同一软件里的两个阶段，共用底层设施。

---

## 1. 为什么做这个（设计动机，影响取舍）

- 打地鼠是「随机目标 + 即时反应」，玩久了缺少一个**明确的、情感化的终点目标**。用户最想要的成就感是 **「我居然会弹《天空之城》了」**，而不是「我连击破百了」。
- 教学法上，歌曲模式采用**逆向切片 + 渐进脚手架**：不是先练通用技巧再够歌曲，而是**从目标歌曲反推**，把它拆成由易到难的一串小关，让玩家在不知不觉中攒齐弹这首歌的全部能力，最后「突然就会了」。
- 关键体验点：玩家从第 1 关进来弹的是**这首歌的骨架**，可能还没意识到是哪首歌——直到某一关节奏一对、旋律成型，「啊这是天空之城！」那个瞬间，就是这个模式的最大意义。

---

## 2. 这是「新增」不是「重构」（最重要的约束）

**现有打地鼠是已完成、可玩、测试齐全的成品，它本身有价值，一行都不要破坏。**

- 歌曲模式是在它**旁边长出来的第二个模式**，用一个 `mode` 状态区分（如 `state.mode = 'whack' | 'song'`）。
- 现有 29 关、`LEVELS` 数据、全部 10 个测试，**改动后必须依然全绿、依然可玩**。
- 任何时候歌曲模式做到一半，打地鼠都应保持完全可用。
- 沿用项目既有原则：**小步提交、可回退；副作用绝不阻断状态机**（P0 卡死的教训）。

---

## 3. 能直接复用的现有设施（先盘点，别重造轮子）

读完现有代码你会发现，歌曲模式需要的基础设施几乎都现成：

| 现有模块 / 机制 | 歌曲模式怎么复用 |
|---|---|
| `levels.js` 纯数据驱动 | 歌曲关卡也是「数据」，新增并列的 `SONGS` 数据，不碰 `LEVELS` |
| `midi.js` 统一 `'press'` 事件 | 歌曲模式判定的输入源**完全相同**，不用改输入层 |
| `fingerFor` / 指法配色体系 | 歌曲音符自带 `finger` 字段，复用同一套指法提示与配色 |
| 音频/游戏**双时钟桥接** | `Tone.Draw.schedule` + `performance.now()` 这套「踩鼓点」机制，**正是**主旋律判定 + 伴奏同步要用的同一条时间轴。配伴奏关直接复用 |
| `render.js` 键盘绘制 | 复用「画一排琴键 + 音名 + 手指编号」，歌曲模式只需高亮「当前/下一个该弹的键」 |
| `bear.js` / 连击 / 狂热 / 粒子 | 原样搬来当歌曲模式的反馈层（弹对就爽） |
| `state.js` 换把位 `off` / `activeMidis` | 歌曲音域跨把位时复用同一套把位逻辑 |
| `diagnostics.js` 看门狗 | 歌曲模式主循环也挂上，防新的僵死 |

**结论：歌曲模式的核心工作量 = 一种新的关卡数据格式 + `game.js` 里一个新的判定分支。其余多为复用。**

---

## 4. 歌曲关卡的数据格式（已设计好，直接用）

在 `levels.js` 新增 `SONGS`，与 `LEVELS` 并列。一首歌是一组**渐进关卡**，每关是一串音符。音符结构：

```js
// 单个音符
{
  pitch: "E5",        // 科学音高记法，仅供人读
  midi: 76,           // ★判定以此为准，不受音名写法影响
  finger: 3,          // 手指编号 1-5（右手）；左手声部另存
  duration: "eighth", // 时值：eighth/quarter/dotted-quarter/half/dotted-half/whole
  startBeat: 0        // 在本关整条时间轴上的起拍位置（每小节 4 拍）
}
```

MIDI 编号对照（C 大调常用音）：
`C3=48 D3=50 E3=52 F3=53 G3=55 A3=57 B3=59 C4=60 D4=62 E4=64 F4=65 G4=67 A4=69 B4=71 C5=72 D5=74 E5=76 F5=77 G5=79 A5=81`

时值→拍数：`eighth=0.5 quarter=1 dotted-quarter=1.5 half=2 dotted-half=3 whole=4`

一首歌的整体结构（先只实现关卡 1，其余留空占位）：

```js
SONGS = {
  laputa: {
    title: "天空之城",
    key: "C", timeSignature: "4/4",
    levels: [
      { id: 1, name: "认骨架", bpm: 50, rightHand: [ /* 见 §5 */ ], leftHand: [] },
      { id: 2, name: "出旋律", bpm: 50, rightHand: [ /* 真实节奏 */ ], leftHand: [] },
      { id: 4, name: "加左手", bpm: 50, rightHand: [...], leftHand: [ /* 根音 */ ] },
      { id: 7, name: "配伴奏", bpm: 65, rightHand: [...], leftHand: [...], accompaniment: "midi文件轨" }
      // 关卡 3/5/6/8 待补
    ]
  }
}
```

---

## 5. 第一阶段只做关卡 1 的数据（音符序列）

《天空之城》A 段、C 大调、4/4、≈50 BPM、全部四分音符等长（单音骨架）。这是用户已核对方向的初稿（个别经过音以用户最终核对的 MIDI 为准）：

```js
rightHand: [
  // 小节1 (startBeat 0-3)
  { pitch:"E5", midi:76, finger:3, duration:"quarter", startBeat:0 },
  { pitch:"D5", midi:74, finger:2, duration:"quarter", startBeat:1 },
  { pitch:"B4", midi:71, finger:1, duration:"quarter", startBeat:2 },
  { pitch:"A4", midi:69, finger:1, duration:"quarter", startBeat:3 },
  // 小节2 (4-7)，第4拍休止
  { pitch:"B4", midi:71, finger:1, duration:"quarter", startBeat:4 },
  { pitch:"E5", midi:76, finger:3, duration:"quarter", startBeat:5 },
  { pitch:"E5", midi:76, finger:3, duration:"quarter", startBeat:6 },
  // 小节3 (8-11)
  { pitch:"A5", midi:81, finger:5, duration:"quarter", startBeat:8 },
  { pitch:"G5", midi:79, finger:4, duration:"quarter", startBeat:9 },
  { pitch:"E5", midi:76, finger:2, duration:"quarter", startBeat:10 },
  { pitch:"D5", midi:74, finger:1, duration:"quarter", startBeat:11 },
  // 小节4 (12-15)，第4拍休止
  { pitch:"E5", midi:76, finger:2, duration:"quarter", startBeat:12 },
  { pitch:"G5", midi:79, finger:4, duration:"quarter", startBeat:13 },
  { pitch:"G5", midi:79, finger:4, duration:"quarter", startBeat:14 },
  // 小节5 (16-19)
  { pitch:"F5", midi:77, finger:3, duration:"quarter", startBeat:16 },
  { pitch:"E5", midi:76, finger:2, duration:"quarter", startBeat:17 },
  { pitch:"D5", midi:74, finger:1, duration:"quarter", startBeat:18 },
  { pitch:"C5", midi:72, finger:1, duration:"quarter", startBeat:19 },
  // 小节6 (20-23)
  { pitch:"D5", midi:74, finger:1, duration:"quarter", startBeat:20 },
  { pitch:"E5", midi:76, finger:2, duration:"quarter", startBeat:21 },
  { pitch:"C5", midi:72, finger:1, duration:"quarter", startBeat:22 },
  { pitch:"B4", midi:71, finger:1, duration:"quarter", startBeat:23 },
  // 小节7 (24-27)
  { pitch:"A4", midi:69, finger:1, duration:"quarter", startBeat:24 },
  { pitch:"B4", midi:71, finger:2, duration:"quarter", startBeat:25 },
  { pitch:"C5", midi:72, finger:3, duration:"quarter", startBeat:26 },
  { pitch:"E5", midi:76, finger:5, duration:"quarter", startBeat:27 },
  // 小节8 (28-31)，第4拍休止
  { pitch:"D5", midi:74, finger:2, duration:"quarter", startBeat:28 },
  { pitch:"B4", midi:71, finger:1, duration:"quarter", startBeat:29 },
  { pitch:"A4", midi:69, finger:1, duration:"quarter", startBeat:30 }
]
```

> 关卡 2（真实节奏）、关卡 4（左手根音 C–G–Am–F 走向，省力版固定在 C3–A3 五指手位）的数据用户手上已有，**第一阶段先不要写**，等关卡 1 整条链路跑通再补。

---

## 6. `game.js` 要新增的判定逻辑（核心）

歌曲模式和打地鼠**共用主循环和输入**，区别只在「呈现什么 + 怎么判定」。建议用 `state.mode` 分支：

- **呈现**：不再 `spawnMole` 随机生成。按 `startBeat` 顺序，**高亮「当前该弹的音」**对应的键 + 手指编号；可同时把「下一个音」做弱提示。
- **判定**：监听同一个 `'press'` 事件，比对
  1. `press.midi === 当前目标.midi`（音高对不对）
  2. `press.finger === 当前目标.finger`（指法对不对，按对音用错指单独记一项，不算 miss 但不给指法分）
  3. 节奏（**关卡 1 不判定节奏**，只判音高顺序；节奏从关卡 2 起按 `startBeat` 比对 `performance.now()`，沿用双时钟桥接，宽松判定 ±110ms 给「准点」加分，偏拍不 miss）
- **推进**：按对当前音 → 指针移到下一个音。弹错音 → 提示但不强制中断（零基础友好，参考打地鼠「越级提示」而非直接失败）。
- **完成**：弹完最后一个音 → 通关结算，复用现有结算页 + 解锁逻辑（存 `localStorage`）。

**判定务必分手处理**：双手关卡里左手根音是长音（按住整小节），右手在其间弹多个音。不要求两手「同时按」——左手在小节起拍按下并保持、右手各音按自己的 `startBeat` 触发，两手独立判定。左手关卡 1 阶段用不到，但架构先留好口子。

---

## 7. 建议的接手步骤（小步提交）

1. **加 `state.mode` 与模式入口**：开始界面加一个「歌曲模式」入口，先能切到一个空白歌曲场景再切回，不破坏打地鼠。提交。
2. **`levels.js` 加 `SONGS` 数据**：只放 §5 的关卡 1。提交。
3. **`game.js` 加歌曲判定分支**：按 §6 实现「按音高顺序弹、复用 `'press'`、复用结算」。先**不要**节奏判定、**不要**左手、**不要**伴奏。提交。
4. **`render.js` 复用绘制**：高亮当前/下一个该弹的键 + 手指号。复用小熊/连击当反馈。提交。
5. **本地真机验证**：Chrome 接 P-115，在歌曲模式里把关卡 1 完整弹一遍——数据→显示→判定→反馈整条链路通。未插琴用键盘兜底。
6. 关卡 1 跑通后，再依次补关卡 2（真实节奏）、关卡 4（左手根音）、关卡 7（配伴奏，复用双时钟 + 扒来的《天空之城》伴奏 MIDI 轨）。

---

## 8. 测试（沿用 `test/` 纯 Node 体例）

新增至少：

- `song-advance.mjs`：喂入关卡 1 数据 + 模拟一串「正确 `press`」，断言指针按 `startBeat` 顺序推进、最后触发通关。
- `song-wrong-note.mjs`：弹错音高时给提示但**不中断、不僵死**（继承 P0 教训：副作用不阻断状态机）。
- 回归：现有 10 个测试**必须依然全绿**。

> 注意现有桩的限制（`Tone.Loop` 回调不触发、无 `createRadialGradient`）：节奏/伴奏的音频侧逻辑仍**只能在浏览器验证**，Node 测试只覆盖「音高顺序推进 + 不僵死」这层。

---

## 9. 验收标准（第一阶段）

- [ ] 开始界面能进入「歌曲模式」并能切回打地鼠；打地鼠 29 关与全部原测试**不受影响、依然全绿**。
- [ ] 歌曲模式能加载《天空之城》关卡 1，按 `startBeat` 顺序高亮「当前该弹的键 + 手指」。
- [ ] Chrome 接 P-115 能按音高顺序把关卡 1 完整弹下来并通关结算；未插琴键盘兜底可用。
- [ ] 弹错音不会卡死、不会中断状态机，给出零基础友好的提示。
- [ ] 新增 ≥2 个 Node 测试覆盖「顺序推进」「错音不僵死」。
- [ ] 全程小步提交、git 历史可回退。

---

## 10. 始终遵守的原则（继承自 PROJECT.md）

- **零基础友好**：提示直白，不假设懂乐理。
- **教学法正确**：指法、把位、切片渐进符合真实钢琴技法。
- **新增不破坏**：歌曲模式与打地鼠共存，互不拖累。
- **副作用不阻断主流程**：音效等异常只记录、绝不冒泡进状态机。
- **改动增量化、可回退**：每步小提交，配回归测试。
- **先跑通一关，再加内容**：关卡 1 整条链路通了，才是衔接成立的证明；其余全是加数据。**不要等整首歌做完美再合并。**
