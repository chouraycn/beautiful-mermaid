# MEMORY.md — beautiful-mermaid 技能项目长期记忆

## 项目结构
- `beautiful-mermaid-main/` — 技能分支（SKILL.md + scripts + assets），发布目标
- `beautiful-mermaid-lukilabs/` — 上游库 fork（src/ + dist/），依赖源

## 技术要点
- beautiful-mermaid 库是 ESM only（`"type": "module"`），不能用 `require()`，必须用 `import`
- Mermaid 语法不支持分号分隔（`graph TD; A --> B` 会报错），必须用换行
- 上游 lukilabs 库的 dist/ 需要手动 build（`npm run build` / `tsup`）
- `sharp` 用于 PNG 输出，是 native 模块

## 已安装位置
- `~/.workbuddy/skills/beautiful-mermaid-main/`（需手动同步修改）

## 发布状态（2026-03-28）
- CodeBuddy 官方市场：未上架（需联系官方团队）
- OpenClaw ClawHub：未发布
- frontmatter 已对齐官方标准（version/description/description_zh/description_en/homepage）
- LICENSE：MIT-0
- author：chouray (github.com/chouraycn)
- .gitignore 已创建（排除 node_modules/.DS_Store/.workbuddy/）
- 已删除 .gitattributes、assets/examples/er-diagram.mmd
- 排除 node_modules 后发布包总大小约 1.9MB（无超过 10MB 的文件）

## 修复记录（2026-03-28）
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
