#!/usr/bin/env node

/**
 * Beautiful Mermaid CLI Renderer
 * 
 * 用法:
 *   node scripts/render.js <input.mmd> [options]
 *   node scripts/render.js --code "graph TD\nA --> B" [options]
 *   node scripts/render.js --batch <dir> [options]
 * 
 * 选项:
 *   --format, -f     输出格式: svg (默认) | ascii | png | html
 *   --theme, -t      主题名称或自定义主题JSON
 *   --output, -o     输出文件路径
 *   --code, -c       直接传入 Mermaid 代码
 *   --bg             背景色 (Mono模式)
 *   --fg             前景色 (Mono模式)
 *   --line           连线颜色
 *   --preset, -p     样式预设: default | modern | gradient | outline | glass
 *   --width, -w      PNG 输出宽度 (默认: 1200)
 *   --scale, -s      PNG 缩放比例 (默认: 1, 范围: 0.5-4)
 *   --dpi            PNG 输出 DPI (默认: 144, 范围: 72-600)
 *   --interactive    启用交互式 tooltip (仅 XY 图表)
 *   --batch          批量模式: 渲染目录下所有 .mmd 文件
 *   --color-mode     ASCII 颜色模式: none | auto | ansi16 | ansi256 | truecolor (默认) | html
 *   --help, -h       显示帮助
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  STYLE_PRESETS,
  THEMES,
  THEME_DEFAULTS,
  THEME_META,
  injectStylesToSVG,
  isValidPreset,
  isValidTheme,
  getTheme,
  getThemeMeta,
  getRecommendedPreset,
  resolveTheme,
  getDarkThemes,
  getLightThemes,
  parseSemanticRoles,
  applySemanticRoles,
} from './styles.js';

// 本地主题别名（保持代码兼容）
const LOCAL_THEMES = THEMES;

// sharp 动态加载（仅 PNG 模式使用）
let _sharp = null;
async function loadSharp() {
  if (!_sharp) {
    const sharpModule = await import('sharp');
    _sharp = sharpModule.default;
  }
  return _sharp;
}

// 保存渲染状态到 .workbuddy/last-render.json
function saveRenderState(options, theme, effectivePreset, outputPath) {
  try {
    const state = {
      theme: typeof options.theme === 'string' ? options.theme : JSON.stringify(options.theme),
      preset: effectivePreset,
      themeFull: theme,
      output: outputPath,
      input: options.input,
      format: options.format,
      timestamp: new Date().toISOString()
    };
    
    const statePath = path.join('.workbuddy', 'last-render.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (e) {
    // 静默失败，不影响主流程
  }
}

// 读取上次渲染状态
function loadRenderState() {
  try {
    const statePath = path.join('.workbuddy', 'last-render.json');
    if (fs.existsSync(statePath)) {
      return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    }
  } catch (e) {}
  return null;
}

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    format: 'svg',
    theme: 'github-light',
    output: null,
    code: null,
    bg: null,
    fg: null,
    line: null,
    preset: null,
    width: 1200,
    scale: 1,
    dpi: 144,
    interactive: false,
    colorMode: 'truecolor',
    batch: false,
    input: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--format':
      case '-f':
        options.format = args[++i];
        break;
      case '--theme':
      case '-t':
        options.theme = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--code':
      case '-c':
        options.code = args[++i];
        break;
      case '--bg':
        options.bg = args[++i];
        break;
      case '--fg':
        options.fg = args[++i];
        break;
      case '--line':
        options.line = args[++i];
        break;
      case '--preset':
      case '-p':
        options.preset = args[++i];
        break;
      case '--width':
      case '-w':
        options.width = parseInt(args[++i], 10);
        break;
      case '--scale':
      case '-s':
        options.scale = parseFloat(args[++i]);
        break;
      case '--dpi':
        options.dpi = parseInt(args[++i], 10);
        break;
      case '--interactive':
        options.interactive = true;
        break;
      case '--color-mode':
        options.colorMode = args[++i];
        break;
      case '--batch':
        options.batch = true;
        break;
      case '--list-themes':
        options.listThemes = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('-') && !options.input) {
          options.input = arg;
        }
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Beautiful Mermaid CLI Renderer
================================

用法:
  node scripts/render.js <input.mmd> [options]
  node scripts/render.js --code "graph TD\\nA --> B" [options]
  node scripts/render.js --batch <dir> [options]

选项:
  --format, -f     输出格式: svg (默认) | ascii | png
  --theme, -t      主题名称 (tokyo-night, dracula, github-dark 等)
                   或自定义主题JSON: '{"bg":"#...","fg":"#..."}'
  --output, -o     输出文件路径 (默认: input.svg 或 output.png)
  --code, -c       直接传入 Mermaid 代码
  --bg             背景色 (如: #f7f7fa)
  --fg             前景色/文字颜色 (如: #27272a)
  --line           连线颜色 (如: #6b7280)
  --preset, -p     样式预设: default | modern | gradient | outline | glass
                   (与 preview.html 中的样式预设一致)
  --width, -w      PNG 输出宽度 (默认: 1200px)
  --scale, -s      PNG 缩放比例 (默认: 1, 范围: 0.5-4)
  --dpi            PNG 输出 DPI (默认: 144, 范围: 72-600)
  --interactive    启用交互式 tooltip (仅 XY 图表)
  --color-mode     ASCII 颜色模式: none | auto | ansi16 | ansi256 | truecolor | html
  --batch          批量模式: 渲染目录下所有 .mmd 文件
  --help, -h       显示帮助

可用主题 (共17个):
  github-light        GitHub 亮色 (默认)
  tokyo-night          东京之夜
  tokyo-night-storm    东京之夜·暴风雨
  tokyo-night-light    东京之夜·亮色
  dracula             德古拉红
  github-dark         GitHub 暗色
  nord                Nord 蓝
  nord-light         Nord 亮色
  one-dark            One Dark
  catppuccin-mocha    Catppuccin Mocha
  catppuccin-latte    Catppuccin Latte
  solarized-dark      Solarized 暗色
  solarized-light     Solarized 亮色
  zinc-light          Zinc 亮色
  zinc-dark           Zinc 暗色
  orange-dark         橙色暗色
  orange-light        橙色亮色

样式预设 (--preset):
  default     默认样式 (圆角8px, 边框2px, 阴影)
  modern      现代简约 (圆角16px, 边框1px, 柔和阴影)
  gradient    渐变风格 (圆角12px, 无边框, 彩色阴影)
  outline     线条轮廓 (圆角4px, 边框2px, 无阴影)
  glass       毛玻璃 (圆角12px, 边框1px, 高模糊阴影)

示例:
  # 从文件渲染SVG (使用默认主题)
  node scripts/render.js diagram.mmd -o output.svg

  # 使用特定主题渲染
  node scripts/render.js diagram.mmd -t dracula -o output.svg

  # 自定义颜色 + 样式预设 (与 preview.html 一致)
  node scripts/render.js diagram.mmd --bg '#f7f7fa' --fg '#27272a' --line '#6b7280' -p modern -o output.svg

  # 渲染为PNG (高清位图)
  node scripts/render.js diagram.mmd -f png -o output.png

  # PNG 自定义尺寸
  node scripts/render.js diagram.mmd -f png -w 2400 -o output.png

  # PNG 高清缩放 (2x)
  node scripts/render.js diagram.mmd -f png -s 2 -o output.png

  # PNG 高 DPI (印刷质量)
  node scripts/render.js diagram.mmd -f png --dpi 300 -o output.png

  # 渲染为ASCII (终端友好)
  node scripts/render.js diagram.mmd -f ascii

  # ASCII 自定义颜色模式
  node scripts/render.js diagram.mmd -f ascii --color-mode ansi256

  # XY 图表启用交互式 tooltip
  node scripts/render.js chart.mmd --interactive -o chart.svg

  # 直接传入代码 (注意：使用 \\n 表示换行)
  node scripts/render.js -c "graph TD\\nA[开始] --> B[结束]" -f ascii
  node scripts/render.js -c "graph TD\\nA[开始] --> B[结束]" -o output.svg -t github-dark

  # 批量渲染目录下所有 .mmd 文件
  node scripts/render.js --batch ./diagrams -f svg -t dracula

  # 批量渲染到指定输出目录
  node scripts/render.js --batch ./diagrams -f svg -o ./output
`);
}

async function main() {
  const options = parseArgs();

  // --list-themes：输出所有主题详情
  if (options.listThemes) {
    console.log('\n可用主题 (--theme 参数):\n');
    const dark  = getDarkThemes();
    const light = getLightThemes();
    console.log('  ● 暗色主题 (Dark):');
    dark.forEach(n => {
      const meta = getThemeMeta(n);
      console.log(`    ${n.padEnd(25)} → 推荐预设: ${meta.recommendedPreset}`);
    });
    console.log('\n  ● 亮色主题 (Light):');
    light.forEach(n => {
      const meta = getThemeMeta(n);
      console.log(`    ${n.padEnd(25)} → 推荐预设: ${meta.recommendedPreset}`);
    });
    console.log('');
    process.exit(0);
  }

  // 动态导入 beautiful-mermaid (ESM)
  const { renderMermaidSVG, renderMermaidASCII, THEMES } = await import('beautiful-mermaid');

  // 批量模式（单线程）
  if (options.batch) {
    if (!options.input) {
      console.error('错误: --batch 模式需要指定目录路径');
      showHelp();
      process.exit(1);
    }
    if (!fs.existsSync(options.input)) {
      console.error(`错误: 目录不存在 ${options.input}`);
      process.exit(1);
    }
    const stat = fs.statSync(options.input);
    if (!stat.isDirectory()) {
      console.error(`错误: ${options.input} 不是目录`);
      process.exit(1);
    }

    // 收集 .mmd 文件
    const mmdFiles = fs.readdirSync(options.input)
      .filter(f => f.endsWith('.mmd'))
      .sort();

    if (mmdFiles.length === 0) {
      console.error('错误: 目录中没有 .mmd 文件');
      process.exit(1);
    }

    // 确定输出目录
    const outputDir = options.output || options.input;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const ext = options.format === 'ascii' ? 'txt' : options.format === 'png' ? 'png' : 'svg';
    let success = 0;
    let failed = 0;

    console.log(`批量渲染: ${mmdFiles.length} 个 .mmd 文件 → ${outputDir}/ (${options.format})\n`);

    for (const file of mmdFiles) {
      const inputPath = path.join(options.input, file);
      const baseName = file.replace(/\.mmd$/, '');
      const outputPath = path.join(outputDir, `${baseName}.${ext}`);
      try {
        await renderSingleFile(inputPath, outputPath, options, { renderMermaidSVG, renderMermaidASCII, THEMES });
        success++;
      } catch (e) {
        failed++;
        console.error(`  ✗ ${file}: ${e.message}`);
      }
    }

    console.log(`\n完成: ${success} 成功, ${failed} 失败`);
    return;
  }

  // 单文件模式
  let code;
  if (options.code) {
    code = options.code;
  } else if (options.input) {
    if (!fs.existsSync(options.input)) {
      console.error(`错误: 文件不存在 ${options.input}`);
      process.exit(1);
    }
    code = fs.readFileSync(options.input, 'utf-8');
  } else {
    console.error('错误: 请提供输入文件或使用 --code 传入代码');
    showHelp();
    process.exit(1);
  }

  // 确定默认输出路径
  const ext = options.format === 'ascii' ? 'txt' : options.format === 'png' ? 'png' : 'svg';
  const defaultOutput = options.input
    ? options.input.replace(/\.mmd$/, `.${ext}`)
    : `output.${ext}`;
  const outputPath = options.output || defaultOutput;

  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    await renderSingleCode(code, outputPath, options, { renderMermaidSVG, renderMermaidASCII, THEMES });
  } catch (error) {
    console.error('渲染失败:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 渲染单个文件
async function renderSingleFile(inputPath, outputPath, options, lib) {
  const code = fs.readFileSync(inputPath, 'utf-8');
  await renderSingleCode(code, outputPath, options, lib);
}

// 渲染核心逻辑（从代码字符串到输出）
async function renderSingleCode(code, outputPath, options, { renderMermaidSVG, renderMermaidASCII, THEMES }) {
  // 解析语义角色声明（在过滤注释之前，因为 @roles 在注释行里）
  const roleMap = parseSemanticRoles(code);

  // 剥离 .mmd 文件中的顶部 # 注释行（rich-html.js 的元数据注释）
  // 格式: # @title / # @desc / # @icon / # @meta / # 普通注释
  // Mermaid 语法本身不支持 # 注释，这些行必须在渲染前移除
  code = code
    .split('\n')
    .filter(line => !line.trimStart().startsWith('#'))
    .join('\n')
    .trim();

  // 解析主题
  // 优先级: CLI --bg/--fg > JSON字符串 > 本地 LOCAL_THEMES 名称
  // 解析后通过 resolveTheme() 补全全部 7 个字段（bg/fg/line/accent/muted/surface/border）
  let rawTheme;
  if (options.bg && options.fg) {
    rawTheme = { bg: options.bg, fg: options.fg, line: options.line };
  } else {
    try {
      rawTheme = JSON.parse(options.theme);
    } catch {
      rawTheme = options.theme; // 字符串名称，交给 resolveTheme 解析
    }
  }
  // resolveTheme 将名称 → 完整对象，并补全缺省字段
  const theme = resolveTheme(rawTheme);

  // 验证 preset 参数（不再与 --theme 互斥，任何主题都可搭配任意 preset）
  if (options.preset && !isValidPreset(options.preset)) {
    throw new Error(`未知样式预设 '${options.preset}'，可用: ${Object.keys(STYLE_PRESETS).join(', ')}`);
  }

  // 如果没有指定 preset，尝试用主题的推荐预设（仅当 --theme 是已知名称时）
  const effectivePreset = options.preset ||
    (typeof rawTheme === 'string' ? getRecommendedPreset(rawTheme) : null);

  // 验证 colorMode
  const validColorModes = ['none', 'auto', 'ansi16', 'ansi256', 'truecolor', 'html'];
  if (!validColorModes.includes(options.colorMode)) {
    console.warn(`警告: 未知颜色模式 '${options.colorMode}'，使用默认 'truecolor'`);
    options.colorMode = 'truecolor';
  }

  if (options.format === 'ascii') {
    const output = renderMermaidASCII(code, {
      colorMode: options.colorMode,
    });

    if (outputPath) {
      fs.writeFileSync(outputPath, output);
      console.log(`✓ ASCII 已保存: ${outputPath}`);
      saveRenderState(options, theme, effectivePreset, outputPath);
    } else {
      console.log(output);
    }
  } else if (options.format === 'png') {
    // theme 已经是完整对象（经过 resolveTheme 补全），直接传给库
    const renderOptions = { ...theme, interactive: options.interactive };
    let svgOutput = renderMermaidSVG(code, renderOptions);

    if (effectivePreset) {
      svgOutput = injectStylesToSVG(svgOutput, theme, effectivePreset);
    }
    // 应用语义角色 class（在样式注入之后，确保 CSS 选择器能命中）
    svgOutput = applySemanticRoles(svgOutput, roleMap);

    const scale = Math.max(0.5, Math.min(4, options.scale));
    const dpi = Math.max(72, Math.min(600, options.dpi));
    const outputWidth = Math.round(options.width * scale);

    const pngBuffer = await loadSharp()(Buffer.from(svgOutput))
      .resize(outputWidth, null, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ quality: 100, density: dpi })
      .toBuffer();

    fs.writeFileSync(outputPath, pngBuffer);
    const presetInfo = effectivePreset ? `, preset:${effectivePreset}` : '';
    console.log(`✓ PNG 已保存: ${outputPath} (${outputWidth}px, scale:${scale}, dpi:${dpi}${presetInfo})`);
    saveRenderState(options, theme, effectivePreset, outputPath);
  } else if (options.format === 'html') {
    // HTML 格式：直接调用 rich-html.js 生成（不单独生成 SVG）
    const { execSync } = await import('child_process');
    const title = path.basename(options.input || 'Diagram', '.mmd');
    const themeArg = typeof options.theme === 'string' ? options.theme : 'github-light';
    const richHtmlCmd = `node scripts/rich-html.js "${title}" --diagrams "${options.input}" --theme "${themeArg}" ${effectivePreset ? `--preset ${effectivePreset}` : ''} --output "${outputPath}"`;

    try {
      execSync(richHtmlCmd, { cwd: process.cwd(), stdio: 'inherit' });
      console.log(`✓ HTML 已保存: ${outputPath}`);
      saveRenderState(options, theme, effectivePreset, outputPath);
    } catch (err) {
      console.error(`生成 HTML 失败: ${err.message}`);
    }
  } else {
    const renderOptions = { ...theme, interactive: options.interactive };
    let output = renderMermaidSVG(code, renderOptions);

    if (effectivePreset) {
      output = injectStylesToSVG(output, theme, effectivePreset);
    }
    // 应用语义角色 class（在样式注入之后，确保 CSS 选择器能命中）
    output = applySemanticRoles(output, roleMap);

    fs.writeFileSync(outputPath, output);
    const presetInfo = effectivePreset ? ` + preset:${effectivePreset}` : '';
    console.log(`✓ SVG 已保存: ${outputPath}${presetInfo}`);
    saveRenderState(options, theme, effectivePreset, outputPath);
  }
}

main();
