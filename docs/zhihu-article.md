# Agent 装了 80 个 Skill，你却不知道哪些在烧 Token

> 适合知乎发布。配图可用仓库 `docs/preview-*.png` 三张截图。  
> 仓库：https://github.com/wei63w/skill-monitor  
> 安装：`npx skills@latest add wei63w/skill-monitor`

---

## 先说一个很真实的尴尬

如果你最近在用 Cursor / Claude Code / Codex，大概经历过这种事：

- 看别人分享就装，装着装着本地多了几十上百个 Skill  
- 写需求时 Agent「看起来很专业」，但上下文又长又贵  
- 你隐约觉得：**有些 Skill 天天在读，有些从没打开过**  
- 可你拿不出数据，只能靠感觉删——不敢删

Skill 生态越来越繁荣，却几乎没人回答一个朴素问题：

**哪些 Skill 真的在用？每次加载大概多重？Rules / AGENTS.md 是不是也在悄悄膨胀？开子 Agent 又额外烧多少？**

于是我做了一个开源 Skill：**skill-monitor**。

---

## 它解决什么问题

一句话：

**给本地 Agent Skill 做使用账本，并粗估「Skill 税」。**

具体包括四块：

1. **Skill 使用频率**  
   谁被加载了、几次、哪些是 0 次僵尸 Skill。

2. **SKILL.md 粗估 Token**  
   每次读说明书大概多重（不是厂商账单，是相对比较用的启发式估算）。

3. **Rules / AGENTS.md 膨胀监控**  
   常驻上下文有多胖，有没有超软预算。

4. **子 Agent / Task 启动成本**  
   启动次数 × 启动时 Rules+AGENTS 体积，看编排税有多重。

如果你也怀疑「不是模型不行，是说明书和规则太重」，这东西就是为你准备的。

---

## 30 秒安装（推荐）

兼容 Agent Skills 开放标准，一条命令即可：

```bash
npx skills@latest add wei63w/skill-monitor
```

装完后，在项目里大致这样用：

```bash
# 初始化，并（可选）打开 Cursor Hook 自动记账
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs setup --project . --hooks

# 从历史对话尽量回填
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs backfill
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs backfill-tasks

# 出报告
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs analyze --project . --write
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs bloat --project . --snapshot --write
node ~/.cursor/skills/skill-monitor/scripts/cli.mjs analyze-tasks --project . --write
```

也可以直接对 Agent 说：

> 用 skill-monitor 分析本机 skill 使用频率和 token 粗估  
> 检查一下 AGENTS.md / rules 有没有膨胀  
> 看看子 Agent 启动成本

仓库与说明：  
https://github.com/wei63w/skill-monitor

skills.sh 页面：  
https://skills.sh/wei63w/skill-monitor

---

## 你会看到什么样的结果

（发帖时请上传这三张图：总览 / 排行表 / 分解图）

**图 1：使用频率总览**  
加载次数、估算 Skill Token、已用/发现数量、Task/子 Agent 启动次数。一眼看到谁在主导工作流。

**图 2：按调用排序 + Token 成本**  
有的 Skill 调用少但单次很重；有的调用多且总 token 占比极高。删什么、拆什么，终于有依据。

**图 3：流水线 / 重 Token / 子 Agent / 库存健康**  
例如某条 Speckit 流水线很稳，但 constitution 很少；某些设计类 Skill「少用但很贵」；库存里大量 unused。

这些结论不神秘，但**没有账本时你永远只能猜**。

---

## 它最有价值的用法（不是再多一张排行榜）

我更建议这样用数据：

### 1. 敢删

0 次调用，或「体积大、调用少」——优先删除、合并，或拆成更小的渐进披露。

### 2. 设安装预算

新项目不要一上来塞 50 个 Skill。用估算加载 token 给默认包设上限。

### 3. 改说明书，而不是再装一个

高频 Skill 任务仍翻车 → 问题往往在 Skill 本身，不在「再找一个更神的」。

### 4. 盯住常驻上下文

AGENTS.md、`.cursor/rules` 是每个回合/子 Agent 的底噪。它们膨胀，比单个冷门 Skill 更伤。

### 5. 看清子 Agent 税

`generalPurpose` / `explore` 开得多，而 Rules 又很重时，成本会乘上去。

---

## 诚实说清楚边界（避免被骂）

请务必读这三句：

1. **各工具没有统一的 `onSkillUsed` API**，采集是尽力而为（Cursor Hook 最强，transcript 回填次之）。  
2. **Token 是粗估**，用于比较 Skill/规则体积，不是 Cursor/API 账单替代品。  
3. **没读盘、只被注入上下文的 Skill**，可能记不到。

它强在**治理与相对比较**，弱在**绝对计费**。  
真正值钱的是：你终于敢删、敢设预算、敢卡住越写越长的说明书。

---

## 为什么我把它开源

因为 Skill 正在变成新的「依赖地狱」：

- 安装成本极低  
- 卸载决策极贵（怕删错）  
- 体积与调用不可见  

包管理有 `npm ls` / bundle size；前端有 Lighthouse；可 Agent Skill 侧长期靠感觉。

skill-monitor 想做的，就是那张最小可用的账本。

MIT 开源，欢迎 Star、提 Issue、直接提 PR。

- GitHub：https://github.com/wei63w/skill-monitor  
- 安装：`npx skills@latest add wei63w/skill-monitor`

---

## 写在最后

如果你也有过这些念头：

- 「我是不是装太多 Skill 了」  
- 「这次对话为什么这么贵」  
- 「Rules 是不是写爆了」  
- 「子 Agent 开太多会不会很亏」

不妨先装上，跑一次 `analyze` / `bloat` / `analyze-tasks`。

数据不一定完美，但通常比感觉诚实。

---

**一键安装再次放这里：**

```bash
npx skills@latest add wei63w/skill-monitor
```

如果你装完跑出有意思的结论（比如删掉了多少 unused、某条流水线占了 60% token），欢迎评论区贴出来——我很想看大家真实的 Skill 税长什么样。
