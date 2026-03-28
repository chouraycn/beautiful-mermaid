#!/usr/bin/env node
/**
 * Beautiful Mermaid Skill — Smoke Test Suite
 *
 * 验证以下核心能力：
 * 1. render.js 能正确渲染所有 assets/examples/*.mmd（包含 # 注释行的文件）
 * 2. rich-html.js 能正确渲染多图表聚合 HTML
 * 3. 所有 17 个内置主题均可被解析
 * 4. 所有 5 种预设均能注入样式
 *
 * 用法:
 *   node scripts/test.js
 *   npm test
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const EXAMPLES_DIR = path.join(ROOT, 'assets', 'examples');
const TMP_DIR = path.join(ROOT, '.tmp-test');

let passed = 0;
let failed = 0;
const errors = [];

function ok(name) {
  console.log(`  ✓ ${name}`);
  passed++;
}

function fail(name, err) {
  console.error(`  ✗ ${name}`);
  console.error(`    ${err}`);
  failed++;
  errors.push({ name, err });
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ─── 1. 准备临时目录 ──────────────────────────────────────────
if (fs.existsSync(TMP_DIR)) {
  fs.rmSync(TMP_DIR, { recursive: true });
}
fs.mkdirSync(TMP_DIR, { recursive: true });

// ─── 2. 验证库能正常 import ───────────────────────────────────
section('Library import');
try {
  const lib = await import('beautiful-mermaid');
  const { renderMermaidSVG, THEMES } = lib;
  if (typeof renderMermaidSVG !== 'function') throw new Error('renderMermaidSVG is not a function');
  if (!THEMES || typeof THEMES !== 'object') throw new Error('THEMES is not an object');
  ok('beautiful-mermaid ESM import');
  ok(`THEMES object (${Object.keys(THEMES).length} entries)`);
} catch (e) {
  fail('beautiful-mermaid ESM import', e.message);
}

// ─── 3. 渲染所有示例文件（SVG） ───────────────────────────────
section('Render examples (SVG, tokyo-night + glass)');
const mmdFiles = fs.readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.mmd')).sort();
if (mmdFiles.length === 0) {
  fail('assets/examples/', 'No .mmd files found');
} else {
  for (const file of mmdFiles) {
    const inputPath = path.join(EXAMPLES_DIR, file);
    const outputPath = path.join(TMP_DIR, file.replace('.mmd', '.svg'));
    try {
      execSync(
        `node scripts/render.js "${inputPath}" --theme tokyo-night --preset glass -o "${outputPath}"`,
        { cwd: ROOT, stdio: 'pipe' }
      );
      const size = fs.statSync(outputPath).size;
      if (size < 100) throw new Error(`Output too small (${size} bytes), likely empty SVG`);
      ok(file);
    } catch (e) {
      const msg = e.stderr ? e.stderr.toString().split('\n')[0] : e.message;
      fail(file, msg);
    }
  }
}

// ─── 4. 覆盖所有 17 个主题（用一个简单的流程图） ──────────────
section('Theme coverage (all 17 themes)');
const { THEMES } = await import('beautiful-mermaid');
const ALL_THEMES = Object.keys(THEMES);
// beautiful-mermaid@1.1.3 包含 15 个内置主题（orange-dark/orange-light 在 >1.1.3 中引入）
if (ALL_THEMES.length < 15) {
  fail('Theme count', `Expected ≥15 themes, got ${ALL_THEMES.length}`);
} else {
  ok(`Found ${ALL_THEMES.length} built-in themes`);
}

const simpleMmd = 'graph TD\n  A[Start] --> B[End]';
const simpleMmdPath = path.join(TMP_DIR, 'simple.mmd');
fs.writeFileSync(simpleMmdPath, simpleMmd);

for (const theme of ALL_THEMES) {
  const outputPath = path.join(TMP_DIR, `theme-${theme}.svg`);
  try {
    execSync(
      `node scripts/render.js "${simpleMmdPath}" --theme "${theme}" -o "${outputPath}"`,
      { cwd: ROOT, stdio: 'pipe' }
    );
    if (!fs.existsSync(outputPath)) throw new Error('Output file not created');
    ok(`theme: ${theme}`);
  } catch (e) {
    const msg = e.stderr ? e.stderr.toString().split('\n')[0] : e.message;
    fail(`theme: ${theme}`, msg);
  }
}

// ─── 5. 覆盖所有 5 种预设 ─────────────────────────────────────
section('Preset coverage (all 5 presets)');
const PRESETS = ['default', 'modern', 'gradient', 'outline', 'glass'];
for (const preset of PRESETS) {
  const outputPath = path.join(TMP_DIR, `preset-${preset}.svg`);
  try {
    execSync(
      `node scripts/render.js "${simpleMmdPath}" --theme dracula --preset "${preset}" -o "${outputPath}"`,
      { cwd: ROOT, stdio: 'pipe' }
    );
    if (!fs.existsSync(outputPath)) throw new Error('Output file not created');
    ok(`preset: ${preset}`);
  } catch (e) {
    const msg = e.stderr ? e.stderr.toString().split('\n')[0] : e.message;
    fail(`preset: ${preset}`, msg);
  }
}

// ─── 6. .mmd 文件 # 注释行支持（关键回归测试） ───────────────
section('# comment line regression (Issue #1)');
const commentedMmd = '# 这是标题注释\n# @title 测试图表\ngraph TD\n  A[开始] --> B[结束]';
const commentedPath = path.join(TMP_DIR, 'commented.mmd');
fs.writeFileSync(commentedPath, commentedMmd);
const commentedOut = path.join(TMP_DIR, 'commented.svg');
try {
  execSync(
    `node scripts/render.js "${commentedPath}" --theme github-light -o "${commentedOut}"`,
    { cwd: ROOT, stdio: 'pipe' }
  );
  if (!fs.existsSync(commentedOut)) throw new Error('Output file not created');
  ok('.mmd with # comment lines renders correctly');
} catch (e) {
  const msg = e.stderr ? e.stderr.toString().split('\n')[0] : e.message;
  fail('.mmd with # comment lines', msg);
}

// ─── 7. rich-html.js 多图表输出 ───────────────────────────────
section('rich-html.js multi-diagram output');
const richOut = path.join(TMP_DIR, 'rich-test.html');
try {
  const diagramArgs = mmdFiles.slice(0, 3).map(f => `"${path.join(EXAMPLES_DIR, f)}"`).join(' ');
  execSync(
    `node scripts/rich-html.js "CI测试" --diagrams ${diagramArgs} --theme tokyo-night --preset glass -o "${richOut}"`,
    { cwd: ROOT, stdio: 'pipe' }
  );
  const size = fs.statSync(richOut).size;
  if (size < 1000) throw new Error(`Output HTML too small (${size} bytes)`);
  ok(`rich-html.js generated ${(size / 1024).toFixed(1)} KB`);
} catch (e) {
  const msg = e.stderr ? e.stderr.toString().split('\n')[0] : e.message;
  fail('rich-html.js multi-diagram', msg);
}

// ─── 8. SKILL.md frontmatter 验证 ────────────────────────────
section('SKILL.md validation');
try {
  const skillContent = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
  const requiredFields = ['name:', 'version:', 'description:', 'description_zh:', 'description_en:'];
  for (const field of requiredFields) {
    if (!skillContent.includes(field)) throw new Error(`Missing frontmatter field: ${field}`);
    ok(`frontmatter: ${field}`);
  }
} catch (e) {
  fail('SKILL.md frontmatter', e.message);
}

// ─── 9. 清理临时文件 ─────────────────────────────────────────
fs.rmSync(TMP_DIR, { recursive: true });

// ─── 结果汇总 ─────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach(({ name, err }) => console.error(`  ✗ ${name}: ${err}`));
}
console.log(`${'─'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
