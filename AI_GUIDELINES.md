# AI 工作指南

本文档包含 beautiful-mermaid skill 的 AI 工作规则，供 AI 助手参考。

---

## 任务识别规则（强制执行）

### 第0步：检测新建还是继续（每次都要执行）

**检查是否有上次渲染记录**：
- 读取 `.workbuddy/last-render.json` 文件
- 如果文件存在且包含有效的 theme/preset，说明用户之前有渲染过

**弹窗询问用户**：
```
您有以下选择：
1. 继续完善 - 继承上次的主题和预设，继续优化
2. 全新开始 - 创建全新的图表（上次的主题/预设会丢失）

请选择：___
```

- **如果用户选择"继续完善"**：读取 last-render.json 中的 theme/preset，直接进入渲染步骤（跳过 Step 1 打开预览）
- **如果用户选择"全新开始"**：执行下面的标准流程（Step 1 打开预览）

---

### 新任务的标准流程（必须全部执行）

**Step 1 — 打开预览工具（第一优先级）**

首先通过 `search_file` 工具找到 skill 实际安装目录（目录名取决于 zip 文件名，不一定是 `beautiful-mermaid`）：

```javascript
// 使用 search_file 工具查找（glob 方式，低风险）
// 搜索目标目录：/Users/<user>/.workbuddy/skills
// 搜索模式："**/SKILL.md"
// 返回结果示例：["beautiful-mermaid/SKILL.md", ...]
// 取第一个结果的父目录路径即为 SKILL_DIR
```

得到 `SKILL_DIR` 后，立即执行：
```javascript
// 优先从 last-render.json 读取上次的主题/预设，传递到 URL 参数
// 这样 preview.html 会自动继承上次的样式（用户无需重新选择）
const lastRender = readRenderState(); // 读取 .workbuddy/last-render.json
const themeParam = lastRender ? `?theme=${lastRender.theme}&preset=${lastRender.preset}` : '';
preview_url("file://" + SKILL_DIR + "/assets/preview.html" + themeParam)
```

- **禁止**：硬编码 `beautiful-mermaid` 作为目录名
- 如果有 last-render.json，URL 参数会自动传递上次的主题/预设（preview.html 会优先使用 URL 参数）
- 不要问用户任何问题，先打开 preview.html
- 等用户在预览界面选择主题和预设

**Step 2 — 记录用户选择（关键：主题必须保留到最终输出）**
- 用户选择完主题和预设后，底部 CLI 命令栏会实时显示选择结果
- **必须记录**用户选择的主题（如 `tokyo-night`）和预设（如 `glass`）
- **这两个值将贯穿后续所有步骤，包括渲染命令和 rich-html.js 命令**

**Step 3 — 生成 .mmd 文件**
- 根据用户描述的业务场景，生成对应的 .mmd 文件
- **禁止**：在生成前读取工作区现有的任何 .mmd 文件
- **禁止**：在生成前询问"让我看看你现有的图表"

**Step 4 — 执行渲染，传递 Step 2 记录的主题**
- 使用 Step 2 记录的主题和预设执行渲染，**必须带 `--theme` 和 `--preset` 参数**
- 单图表：`node scripts/render.js <file.mmd> -t <主题> -p <预设> -o output.svg`
- 多图表聚合：`node scripts/rich-html.js "标题" --diagrams *.mmd --theme <主题> --preset <预设> --output result.html`
- 用 `preview_url` 打开生成的 HTML 结果（`file://` + 绝对路径）

---

- **继续任务的唯一条件**：用户明确说"继续"、"接着上一个"、"在之前基础上"时，才可读取之前的文件继续
- 如果用户只是说"帮我画个流程图"而没有具体内容，可以询问具体需求

---

## 【强制】新任务必须先打开 preview.html

**任何新任务开始时**（无论是用户明确说"全新开始"还是第一次请求生成图表），**都必须先执行以下步骤**：

1. **找到 skill 实际目录**（不得硬编码 `beautiful-mermaid`）：
   ```bash
   find ~/.workbuddy/skills -name "SKILL.md" -exec grep -l "name: beautiful-mermaid" {} \;
   ```
   取结果的父目录路径作为 `SKILL_DIR`

2. **打开 preview.html**（使用 preview_url 工具）：
   ```
   const lastRender = readRenderState();
   const themeParam = lastRender ? `?theme=${lastRender.theme}&preset=${lastRender.preset}` : '';
   preview_url("file://" + SKILL_DIR + "/assets/preview.html" + themeParam)
   ```

3. **【关键】暂停所有操作**

4. **明确告诉用户**："请选择主题和预设，选择完成后告诉我"

5. **等待用户确认选择完成后**，才能继续生成 .mmd 文件

**禁止行为**：
- ❌ 打开 preview.html 后继续生成代码
- ❌ 在用户选择完成前读取现有文件
- ❌ 直接询问用户想要什么主题（必须让用户自己选）
- ❌ 硬编码目录名（如 `~/.workbuddy/skills/beautiful-mermaid/`）

**这是最基础的流程，任何新任务都必须遵守。**

---

## 意图不确定时的确认机制（强制）

当 AI 无法明确判断用户意图时（即用户既没有明确说"继续"，也没有明确说"新任务"，但 AI 感觉可能涉及之前的内容时），**必须主动弹出确认对话框**，不得自行猜测继续。

**触发条件**：
- 用户的请求中包含之前任务中出现的关键词（如之前的业务名称、产品名称、概念等）
- 用户使用了指代词如"这个"、"那个"、"它"、"之前那个"
- 用户只说了很短的话（如"换一个"、"再做一个"）

**确认方式**：
- 使用 `ask_followup_question` 工具提供选项：
  - "继续之前的任务" → 读取并修改现有文件
  - "全新开始一个任务" → **打开 preview.html** 让用户选择主题和预设

**确认后的执行流程**：
- 用户选择"继续之前的任务" → 执行**继续任务流程**（读取现有文件 → 修改 → 渲染）
- 用户选择"全新开始一个任务" → 执行**新任务流程**：
  1. **找到 skill 实际目录**：用 `search_file` 工具查找
  2. **打开 preview.html**（传递 last-render.json 中的主题/预设）：
     ```
     const lastRender = readRenderState();
     const themeParam = lastRender ? `?theme=${lastRender.theme}&preset=${lastRender.preset}` : '';
     preview_url("file://" + SKILL_DIR + "/assets/preview.html" + themeParam)
     ```
  3. **【关键】暂停所有操作，等待用户选择主题和预设**
  4. **【关键】只有用户明确告诉你选择完成后，才能继续下一步**
  5. 记录选择的主题和预设（如 `tokyo-night` + `glass`）——**此值贯穿后续所有渲染命令**
  6. 生成新的 .mmd 文件
  7. 渲染时带上 `--theme <主题> --preset <预设>`，生成结果并 preview_url 打开

**【强制规则】AI 在打开 preview.html 后的行为**：
- ❌ 禁止：打开 preview.html 后继续生成代码或执行其他操作
- ❌ 禁止：在用户选择完成前就准备下一步工作
- ✅ 必须：明确告诉用户"请选择主题和预设，选择完成后告诉我"
- ✅ 必须：等待用户回复"选好了"或类似表示选择完成的信息
- ✅ 只有用户明确确认选择完成后，才能记录主题和预设，继续生成 .mmd 文件
- ✅ **记录的主题/预设必须传递给所有后续渲染命令（包括 render.js 和 rich-html.js）**

**示例对话**：
- 用户说"换一个" → AI 问："请问你是想继续修改之前的图表，还是全新开始？"
- 用户说"再做一种样式" → AI 问："请问你是想在之前基础上添加新样式，还是全新开始？"

**原则**：宁可多问一次，也不要猜错继续导致用户不满。

---

## 暂不支持的图表类型处理规则

当用户请求以下图表类型时，**必须明确告知用户暂不支持**，并提供替代方案：

| 图表类型 | 用户可能的说辞 | 替代方案 |
|---------|---------------|---------|
| **Mindmap（思维导图）** | "思维导图"、"脑图"、"mind map" | 建议使用流程图 `graph TD` 替代，或使用 mermaid.live 导出后用本 skill 转换样式 |
| **Pie Chart（饼图）** | "饼图"、"占比图"、"pie chart" | 建议使用 XY 柱状图替代 |
| **Gantt（甘特图）** | "甘特图"、"项目进度" | 建议使用流程图 + 状态图组合 |
| **Git Graph** | "Git 图"、"版本历史" | 暂无替代，建议使用 mermaid.live |
| **User Journey** | "用户旅程"、"journey" | 暂无替代，建议使用流程图 |

**处理流程**：
1. 检测到用户请求上述图表类型
2. **立即告知**："抱歉，当前版本的 beautiful-mermaid 暂不支持 [图表类型]。支持列表为：流程图、序列图、状态图、类图、ER图、XY图表"
3. 提供替代方案（见上表）
4. 询问用户是否接受替代方案，或等待上游支持后再次尝试

**AI 常见错误（必须避免）**：
- ❌ "让我看看你现有的图表" → **禁止**，新任务不读取现有文件
- ❌ "我看到你已有XX相关的流程图" → **禁止**，这是继承上一个任务的思维
- ❌ 先询问用户想要什么主题 → **禁止**，必须先打开 preview.html 让用户自己选

---

## 继续任务的标准流程（用户说"继续"时执行）

当用户明确说以下话术时，执行继续任务流程：
- "继续"、"接着上一个"
- "在之前基础上"
- "基于XX修改"
- "优化这个图表"
- "修改一下"

**继续任务的标准流程**：

**Step 1 — 读取现有文件 + 上次渲染状态**
- 读取用户指定的 .mmd 文件（如果用户没有指定，列出工作区的 .mmd 文件让用户选择）
- **读取 `.workbuddy/last-render.json` 获取上次渲染时使用的主题和预设**（这是 AI 知道主题/预设的唯一方式）

**Step 2 — 理解修改需求**
- 询问或理解用户想要如何修改（如"增加节点"、"修改流程"、"简化步骤"等）
- 不要重新打开 preview.html，除非用户要求更换主题

**Step 3 — 修改 .mmd 文件**
- 在原有基础上进行修改
- 保留原有的元数据（@title、@desc 等）

**Step 4 — 重新渲染**
- 使用 **last-render.json 中记录的 theme 和 preset** 重新渲染
- 命令示例：`node scripts/render.js <input.mmd> -o <output.svg> -t <theme> -p <preset>`
- 用 `preview_url` 打开结果

---

## 修改/更新 .mmd 文件

当用户要求修改已有的 .mmd 文件时：

1. **先读取现有文件**：了解当前内容
2. **理解修改意图**：询问用户想要如何修改
3. **直接编辑**：使用 replace_in_file 修改文件内容
4. **重新渲染**：执行渲染命令并预览

**修改技巧**：
- 使用 `search_content` 定位需要修改的位置
- 使用 `replace_in_file` 进行精确修改
- 保留元数据注释（%% @xxx 开头的内容）

---

## AI 预览工作规则（最高优先级）

任何涉及渲染 Mermaid 图表的请求，**无论用户是否已指定主题/预设**，都必须先调用 `preview_url` 打开预览工具，让用户在 preview.html 中直观确认效果后，再执行渲染命令。

**触发场景（包括但不限于）**：
- 用户询问主题/配色推荐
- 用户已明确指定主题和预设（如"用 tokyo-night + glass 渲染"）→ **仍需先打开 preview 让用户确认，不得跳过**
- 需要查看图表效果
- 任何使用 skill 渲染图表的场景

**打开方式**（唯一合法方式）：
- 工具：`preview_url`
- URL：`file://` + skill目录 + `assets/preview.html`
- **AI 自动检测规则**：本 SKILL.md 所在目录即为 skill 根目录（无论安装目录名是什么）。**不要硬编码目录名**。正确做法：
  1. 先执行 `ls ~/.workbuddy/skills/` 列出实际目录名
  2. 在结果中找到包含 `SKILL.md`（且文件内含 `name: beautiful-mermaid`）的目录
  3. 拼接 `assets/preview.html` 得到完整路径
  4. 若用户级不存在，检查项目级 `.workbuddy/skills/` 目录
  - **示例**：若实际目录名为 `beautiful-mermaid-v2`，路径为 `~/.workbuddy/skills/beautiful-mermaid-v2/assets/preview.html`

**唯一例外**：用户明确说"直接渲染，不用预览"或"跳过预览"时，才可跳过 preview 步骤。

**禁止**：
- 使用 `open`/`start`/`xdg-open` 等命令打开系统浏览器
- 启动 `python3 -m http.server` 或任何本地 HTTP 服务
- 用户未明确说跳过时，擅自跳过 preview 直接执行渲染

用户打开预览后，可在 Themes 和 Presets 标签页中直接点击切换对比效果。
