# MEMORY.md — beautiful-mermaid 技能项目长期记忆

_精简整合版，更新于 2026-03-30 13:20_

---

## 项目结构

- 本项目目录 `beautiful-mermaid/` — 技能分支（SKILL.md + scripts + assets）
- 上游库位于 `beautiful-mermaid-lukilabs/`（lukilabs 原版，不直接修改）

## 关键文件

| 文件 | 用途 |
|------|------|
| `scripts/styles.js` | 主题/预设数据 + CSS 生成（`generateCSSStyles` / `cleanHardcodedColors` / `injectStylesToSVG`）|
| `scripts/render.js` | CLI 渲染 `.mmd → SVG/PNG`，含 `#` 注释行剥离 |
| `scripts/rich-html.js` | 生成展示型 HTML，含卡片/侧边栏/全屏/缩放/拖拽平移 |
| `scripts/test.js` | 40 个 smoke test |
| `scripts/check-pkg.js` | 25 项包结构验证 |
| `scripts/release.js` | 本地发布助手 |
| `assets/examples/` | 10 个示例（含 semantic-roles-test.mmd）|
| `assets/preview.html` | 浏览器交互式预览 |
| `.workbuddy/last-render.json` | 记录最近一次渲染的 theme/preset，用于"继续"任务 |

## 技术要点

- 项目是 ESM only（`"type": "module"`），不能用 `require()`，必须用 `import`
- `sharp` 是 native 模块，用动态 `import()` 加载
- Mermaid 语法不支持分号分隔（`graph TD; A --> B` 报错），必须用换行
- 15 个上游主题 + 2 个本地扩展（orange-dark、orange-light）= 17 个主题
- 5 种预设：default、modern、gradient、outline、glass

## SKILL.md 修复记录（2026-03-30）

| 修复项 | 详情 |
|--------|------|
| 移除无效 trigger | 从 `triggers` 删除 `用户旅程图`（User Journey 暂不支持，会触发渲染失败） |
| 补充 `--format html` | 参数表 + CLI 示例均已补全 `html` 格式支持 |
| 主题数量统一 | 参数优先级说明"15主题"改为"17主题"，与文档其他部分保持一致 |

## CI/CD 修复记录（2026-03-30）

| 修复项 | 详情 |
|--------|------|
| `release.yml` release notes | "3 种输出格式" → "4 种"，补充 HTML |
| `package.json` scripts | 新增 `render:html` shortcut，与 svg/ascii/png 一致 |
| `package.json` author | `CodeBuddy / codebuddy.ai` → `chouray / github.com/chouraycn` |

## 发布状态（2026-03-30）

- 版本：v1.1.5（package.json + SKILL.md 一致）
- Release：https://github.com/chouraycn/beautiful-mermaid/releases/tag/v1.1.5
- LICENSE：MIT-0，author：chouray (github.com/chouraycn)
- CI/CD：`.github/workflows/` 含 ci.yml / release.yml / version-check.yml
- 发布命令：`npm run release:dry` 预检，`npm run release` 一键打 tag + 触发 CD
- CodeBuddy 市场：未上架；OpenClaw ClawHub：未发布

## 文件清理记录（2026-03-30）

| 删除文件 | 原因 |
|---------|------|
| `assets/.DS_Store` | macOS 系统文件，已加入 .gitignore |
| `.workbuddy/settings.local.json` | 本地开发设置，非必需 |
| `assets/examples/sequence-diagram.svg` | 已删除的 SVG 输出文件（git status 显示） |
| `assets/preview-test.html` | 测试文件，非必需 |
| `assets/test-block.html` | 测试文件，非必需 |
| `assets/test-block.mmd` | 测试文件，非必需 |
| `assets/test-block.svg` | 测试文件，非必需 |

## 已修复 Bug 归档（2026-03-28 ~ 2026-03-30）

| 修复项 | 说明 |
|--------|------|
| 时序图 rect 块多余边线 | `renderBlock` 对 `rect` 类型单独处理，仅渲染背景矩形（`seq-rect-bg`），不画边框；`styles.js` Step 2.5 还原 `data-bm-color` 颜色 |
| 时序图 loop/alt 块白色填充 | `generateCSSStyles` 追加三条覆盖规则，修复通用 `rect` 选择器过宽问题 |
| 类图/ER图文字居中 | `cleanHardcodedColors` 删除内联 `dy` 属性；追加 `.class-node text` / `.entity text` 的 `dominant-baseline` 规则 |
| 语义角色 CSS 系统 | `@roles` 注释系统，5 个语义角色（critical/success/danger/info/muted）亮暗主题自适应颜色 |
| SVG 节点颜色回退黑色 | 删除无效属性选择器，改为类选择器 + 通用元素选择器双保险 |
| 拖拽平移 + 边界限制 | 直接拖拽（5px 阈值），`_applySvgTransform` 统一缩放+平移；clamp 防越界 |
| 去掉全屏点击 | 保留放大/缩小/重置/下载 4 个悬浮按钮 |
| rich-html Footer | 底部显示 "chouray 开源" + GitHub 图标 |
| `render.js` 注释行剥离 | 剥离 `.mmd` 头部 `#` 注释，避免 Mermaid 误解析为 header |
| 添加 `--format html` 支持 | 直接生成内嵌 SVG 的 HTML |

## 工作流程经验

### AI 必须遵守的完整工作流（强制）

1. **新任务**：打开 preview.html → 用户选择主题/预设 → 生成 `.mmd` → 渲染命令 → `preview_url` 打开
2. **继续任务**：读取 `.workbuddy/last-render.json` → 使用其中的 theme/preset → 渲染 → `preview_url`
3. **渲染命令**：`node scripts/rich-html.js "<标题>" --diagrams <file.mmd> --theme <t> --preset <p> --output <output.html>`
4. **必须最终步**：`preview_url("file://" + 绝对路径)`

### preview.html 打开方式

- `preview_url` 支持 `file://` 协议，**不要启动 HTTP 服务器**
- 正确检测路径：`find ~/.workbuddy/skills -name "SKILL.md" -exec grep -l "name: beautiful-mermaid" {} \;`
- zip 安装的 skill 目录名 = zip 文件名（不含 .zip），改名后必须用新目录名

### Mermaid 语法最佳实践

- subgraph 避免多层嵌套，`zinc-light + outline` 与复杂 subgraph 兼容性差
- 节点 ID 用描述性名称（如 `start_node`），避免简单字母（`AA`、`BB`）
- `.mmd` 文件可用 `# @title` / `# @desc` / `# @icon` / `# @meta` / `# @type` / `# @roles` 注释声明元数据

### last-render.json 格式

```json
{
  "theme": "zinc-light",
  "preset": "outline",
  "output": "output.svg",
  "input": "diagram.mmd",
  "format": "svg",
  "timestamp": "2026-03-28T18:10:00.000Z"
}
```
