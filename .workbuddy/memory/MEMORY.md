# MEMORY.md — beautiful-mermaid 技能项目长期记忆

## 项目结构
- 本项目目录 `beautiful-mermaid/` — 技能分支（SKILL.md + scripts + assets），发布目标
- 上游库位于 `beautiful-mermaid-lukilabs/`（lukilabs 原版）
- skill 安装在项目级 `.workbuddy/skills/beautiful-mermaid/`（优先级最高）

## CI/CD 状态（2026-03-28）
- `.github/workflows/ci.yml`：CI — 测试（Node 18/20/22 矩阵）+ SKILL.md lint
- `.github/workflows/release.yml`：CD — push v*.*.* tag → 自动打 zip + 发布 GitHub Release
- `.github/workflows/version-check.yml`：PR 检查 — SKILL.md 与 package.json 版本号一致性
- `scripts/test.js`：39 个 smoke test（全部通过），覆盖所有示例、主题、预设、注释回归
- `scripts/check-pkg.js`：包结构验证（25 项，全部通过）
- `scripts/release.js`：本地发布助手，`npm run release:dry` 预检，`npm run release` 一键打 tag

## 发布流程（标准 SOP）
```
1. 更新 package.json version + SKILL.md version（保持一致）
2. npm run release:dry  → 预检所有条件
3. git add -A && git commit -m "v<x.y.z>"
4. npm run release      → 自动 tag + push，触发 GitHub Actions CD
5. GitHub Actions 自动发布 beautiful-mermaid-<x.y.z>.zip
```

## Bug 修复记录（2026-03-28）
### 问题：render.js 不支持 .mmd 文件顶部 # 注释行 ✓ 已修复
- 根本原因：`renderSingleCode()` 直接将原始文件内容传给 Mermaid，`# 示例: 标题` 被误解析为无效 header
- 修复位置：`scripts/render.js` `renderSingleCode()` 函数开头
- 修复方案：在渲染前用 `.filter(line => !line.trimStart().startsWith('#'))` 剥离所有 # 注释行
- 注：`rich-html.js` 在 3104 行已有同样逻辑，不需要修改

### 文档准确性修复（2026-03-28）
- 主题数量：SKILL.md/render.js 中的 17 主题 → 修正为 15（orange-dark/orange-light 不在 v1.1.3 中）
- 移除 SKILL.md 主题表格中不存在的 orange-dark 和 orange-light 两行
- 移除 render.js 帮助文本中的 orange 主题列表项

## 技术要点
- beautiful-mermaid 库是 ESM only（`"type": "module"`），不能用 `require()`，必须用 `import`
- Mermaid 语法不支持分号分隔（`graph TD; A --> B` 会报错），必须用换行
- 上游 lukilabs 库的 dist/ 需要手动 build（`npm run build` / `tsup`）
- `sharp` 用于 PNG 输出，是 native 模块

## 已安装位置
- **项目级**：`beautiful-mermaid/.workbuddy/skills/beautiful-mermaid/` ✓
- **用户级**：`~/.workbuddy/skills/beautiful-mermaid/`

## 发布状态（2026-03-28）
- CodeBuddy 官方市场：未上架（需联系官方团队）
- OpenClaw ClawHub：未发布
- frontmatter 已对齐官方标准（version/description/description_zh/description_en/homepage）
- LICENSE：MIT-0
- author：chouray (github.com/chouraycn)
- .gitignore 已创建（排除 node_modules/.DS_Store/.workbuddy/）
- 已删除 .gitattributes、assets/examples/er-diagram.mmd
- 已删除内嵌的旧版本 beautiful-mermaid bundle（避免版本冲突）
- 项目依赖 beautiful-mermaid@1.1.3（最新版本）
- 排除 node_modules 后发布包总大小约 1.9MB（无超过 10MB 的文件）

## 修复记录（2026-03-28）
### 问题 7：交互按钮点击无响应（JavaScript 函数作用域问题）✓ 已修复
- 根本原因：JS 函数定义在 IIFE 内部，onclick 属性无法访问
- 修复方案：
  1. 将 toggleCode、copyCode、openFullscreen、closeFullscreen 移到 IIFE 外部
  2. 使用 `window.xxx = function(...)` 方式定义，使其成为全局函数
  3. 事件委托处理器中的调用也改为 `window.toggleCode()` 和 `window.copyCode()`
- 验证：JavaScript 语法检查通过

### 问题 8：全屏关闭按钮 onclick 失效 ✓ 已修复
- 根本原因：onclick="closeFullscreen()" 缺少 window. 前缀
- 修复：将 onclick 属性改为 onclick="window.closeFullscreen()"

### 问题 9：SVG 放大缩小按钮无法点击 ✓ 已修复
- 根本原因：z-index 被覆盖，pointer-events: none
- 修复：提高 z-index 到 100，添加 pointer-events: auto，默认透明度 0.7

### 问题 10：总结区域风格与图表一致 ✓ 已修复
- 修复：总结区域改用独立风格（虚线边框、中性 muted 颜色，不使用图表 accent 强调色）

### 问题 11：意图不确定时缺少确认机制 ✓ 已修复
- 新增：SKILL.md 中添加"意图不确定时的确认机制"规则
- 触发条件：用户请求涉及之前任务的关键词、使用指代词、或请求过于简短
- 确认方式：使用 ask_followup_question 让用户选择"继续"或"全新开始"

### 问题 1：package.json 模块类型冲突 ✓ 已修复
- 将 `"type": "commonjs"` 改为 `"type": "module"`
- 将 `license` 改为 `MIT-0`
- scripts/*.js 的 `require()` 全部改为 ES6 `import`
- sharp 改为动态 `import()` 避免顶层加载错误

### 问题 2：SKILL.md 与已安装版本不同步 ✓ 已修复
- 主题数量从 15 更新为 17（新增 orange-dark, orange-light）
- THEMES 表格补充缺失的橙色主题
- 代码示例中的 `require()` 改为 `import`

### 问题 3：非标准 frontmatter 字段 ✓ 已修复
- 添加 `version: "1.1.3"`
- 添加 `homepage`, `author`, `keywords`, `triggers`
- 将触发词从 description 拆分到独立 `triggers` 数组

### 问题 4：文档准确性修复 ✓ 已修复
- 修复SKILL.md中主题数量不一致问题（描述中从15+改为17+）
- 修正主题对照表，添加orange-dark和orange-light主题
- 更新预览功能描述中的主题数量（从15改为17）
- 修复render.js帮助信息中的主题列表（移除重复项，添加缺失主题）
- 修复图表类型描述不一致问题（明确6种核心图表类型 vs XY图表细分类型）

### 问题 5：版本号不一致 ✓ 已修复（2026-03-28）
- package.json 版本从 1.0.0 统一为 1.1.3
- 本地安装目录从 beautiful-mermaid-main 改为 beautiful-mermaid

### 问题 6：ESM 兼容性 ✓ 已修复（2026-03-28）
- rich-html.js 中 __dirname 定义移至所有 import 之前

## 文件清理记录（2026-03-28）
删除了以下无关联无效文件：
- `diagrams/`（9个.mmd）— 用户自己的业务图表，非Skill组成部分
- `output/`（2个.html）— rich-html.js的生成产物，可随时重新生成
- `references/api-config.json` — 纯冗余文档，无任何脚本引用，内容已被SKILL.md覆盖
- `references/`（空目录，顺带删除）
- `assets/examples/erp-oms-flow.mmd` 等5个ERP业务示例 — 之前测试留下的业务文件，非通用示例

**清理后保留的assets/examples/（9个通用示例）**：
flowchart-basic、sequence-diagram、state-diagram、class-diagram、er-diagram、system-architecture、xychart-bar、xychart-combo、xychart-line

## 工作流程经验

### preview.html 本地打开方式
- `preview_url` 工具支持 `file://` 协议，无需 HTTP 服务器
- **AI 自动检测规则（已修复 zip 改名 bug，v2 版本）**：**不要硬编码目录名 `beautiful-mermaid`**。正确流程：
  1. 执行 `find ~/.workbuddy/skills -name "SKILL.md" -exec grep -l "name: beautiful-mermaid" {} \;` 找到实际目录路径
  2. 取结果父目录为 SKILL_DIR
  3. `preview_url("file://" + SKILL_DIR + "/assets/preview.html")`
  4. 若用户级不存在，检查项目级 `.workbuddy/skills/`
- **示例**（目录名可能不是 beautiful-mermaid）：`file:///Users/chouray/.workbuddy/skills/<实际目录名>/assets/preview.html`
- **禁止**：使用 `http://localhost:xxx` 或启动 HTTP 服务器
- **重要**：zip 安装的 skill 目录名 = zip 文件名（不含 .zip），改名后必须用新目录名

### 主题传递规则（2026-03-28 强化）
- 用户在 preview.html 中选择的主题/预设**必须贯穿所有后续步骤**
- render.js：`--theme <主题> --preset <预设>`
- rich-html.js：`--theme <主题> --preset <预设>`（所有颜色自动继承，无需手动指定颜色）
- 生成最终 HTML 后必须用 `preview_url("file://" + 绝对路径)` 打开结果

### 继续任务与 last-render.json（2026-03-28 新增）
- **问题**：用户说"继续"时，AI 无法读取浏览器 localStorage 中的主题/预设
- **解决方案**：每次渲染成功后自动保存到 `.workbuddy/last-render.json`
- **继续任务流程**：
  1. 读取 `.workbuddy/last-render.json` 获取 theme 和 preset
  2. 使用相同的 theme/preset 重新渲染
  3. 命令示例：`node scripts/render.js <input.mmd> -o <output.svg> -t {{theme}} -p {{preset}}`
- **文件格式**：
```json
{
  "theme": "zinc-light",
  "preset": "outline",
  "themeFull": { "bg": "...", "fg": "...", ... },
  "output": "output.svg",
  "input": "diagram.mmd",
  "format": "svg",
  "timestamp": "2026-03-28T18:10:00.000Z"
}
```

## preview.html 图表类型功能（2026-03-28）
- 恢复图表类型选择 Tab（作为最后一个 Tab）
- 从多选模式改为单一选择模式
- 每个图表类型按钮添加了图标、名称、描述（样式演示说明）
- 底部添加提示文字："点击上方卡片切换图表示例，编辑器将自动加载对应的 Mermaid 代码模板"
- 预览区域显示当前图表类型（如 "zinc-light + Default + 流程图"）

## 2026-03-28 工作记录

### 1. 立即修复
- **README.md 主题数量错误**：第 28 行从"15 个"改为"17 个"

### 2. 新图表类型支持分析
- **上游状态**：lukilabs/beautiful-mermaid Issue #59 正在开发 Mermaid v11 新图表支持
- **当前支持**：6 种（flowchart, sequence, state, class, er, xychart）
- **暂不支持**：mindmap, pie chart, gantt, git graph, user journey, c4

### 3. 文档增强
- **SKILL.md**：新增"1.1 暂不支持的图表类型"章节，列出上游 Issue #59 跟踪状态
- **AI_GUIDELINES.md**：新增"暂不支持的图表类型处理规则"，AI 遇到这些请求时必须明确告知用户并提供替代方案
- **示例文件**：更新 flowchart-basic.mmd 添加元数据，更新 system-architecture.mmd

### 4. 下一步方向（短期）
- 等待上游 Issue #59 完成后同步更新
- 考虑 fork 上游自行实现（工作量较大）
- 当前通过文档引导用户使用替代方案

### 5. 图表类型标签一致性修复（2026-03-28）
- **问题**：preview.html 的 XY 图表选项（柱状图/折线图/组合图/横向柱图）与 rich-html.js 生成的 HTML 标签不一致
- **修复**：
  - 修改 rich-html.js 的 TYPE_LABEL，添加 XY Bar/XY Line/XY Combo/XY Horizontal 映射
  - 修改 inferDiagramType() 函数，检测前 10 行代码来识别子类型（bar/line/combo/horizontal）
  - 添加各子类型的 badge 颜色配置
- **验证**：测试全部通过 (39/39)
