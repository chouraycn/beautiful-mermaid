#!/usr/bin/env node
/**
 * Beautiful Mermaid Skill — Package Structure Checker
 *
 * 验证 skill 发布包的完整性：
 * - 必须包含所有关键文件
 * - SKILL.md frontmatter 完整
 * - package.json 字段完整
 * - 无超过 10MB 的单个文件
 * - node_modules 未被打包进来
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const errors = [];

function ok(name) {
  console.log(`  ✓ ${name}`);
  passed++;
}

function fail(name, reason) {
  console.error(`  ✗ ${name}: ${reason}`);
  failed++;
  errors.push({ name, reason });
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ─── 1. 必需文件存在 ──────────────────────────────────────────
section('Required files');
const REQUIRED_FILES = [
  'SKILL.md',
  'package.json',
  'README.md',
  'beautiful-mermaid.png',
  'scripts/render.js',
  'scripts/rich-html.js',
  'scripts/styles.js',
  'assets/preview.html',
];

for (const file of REQUIRED_FILES) {
  const fullPath = path.join(ROOT, file);
  if (fs.existsSync(fullPath)) {
    ok(file);
  } else {
    fail(file, 'File not found');
  }
}

// ─── 2. assets/examples/ 有示例文件 ───────────────────────────
section('Example diagrams');
const examplesDir = path.join(ROOT, 'assets', 'examples');
if (!fs.existsSync(examplesDir)) {
  fail('assets/examples/', 'Directory not found');
} else {
  const mmdFiles = fs.readdirSync(examplesDir).filter(f => f.endsWith('.mmd'));
  if (mmdFiles.length < 3) {
    fail('assets/examples/', `Too few examples: found ${mmdFiles.length}, expected ≥3`);
  } else {
    ok(`${mmdFiles.length} example .mmd files`);
  }
}

// ─── 3. package.json 关键字段 ─────────────────────────────────
section('package.json fields');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const PKG_REQUIRED = ['name', 'version', 'description', 'type', 'license'];
for (const field of PKG_REQUIRED) {
  if (pkg[field]) {
    ok(`package.json: ${field} = "${pkg[field]}"`);
  } else {
    fail(`package.json: ${field}`, 'Missing or empty');
  }
}
// type 必须是 module（ESM）
if (pkg.type !== 'module') {
  fail('package.json: type', `Expected "module", got "${pkg.type}"`);
} else {
  ok('package.json: type is "module" (ESM)');
}

// ─── 4. SKILL.md frontmatter ─────────────────────────────────
section('SKILL.md frontmatter');
const skillContent = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
const SKILL_REQUIRED = ['name:', 'version:', 'description:', 'description_zh:', 'description_en:', 'homepage:', 'author:'];
for (const field of SKILL_REQUIRED) {
  if (skillContent.includes(field)) {
    ok(`SKILL.md: ${field}`);
  } else {
    fail(`SKILL.md: ${field}`, 'Missing frontmatter field');
  }
}

// SKILL.md version 应与 package.json version 一致
const skillVersionMatch = skillContent.match(/^version:\s*"?([^"\n]+)"?/m);
if (skillVersionMatch) {
  const skillVersion = skillVersionMatch[1].trim();
  if (skillVersion === pkg.version) {
    ok(`Version consistent: SKILL.md = package.json = ${pkg.version}`);
  } else {
    fail('Version mismatch', `SKILL.md="${skillVersion}" vs package.json="${pkg.version}"`);
  }
} else {
  fail('SKILL.md: version', 'Cannot parse version field');
}

// ─── 5. 无超大文件（>10MB） ────────────────────────────────────
section('File size check');
function scanDir(dir, maxBytes = 10 * 1024 * 1024) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    if (entry.isDirectory()) {
      scanDir(fullPath, maxBytes);
    } else {
      const size = fs.statSync(fullPath).size;
      if (size > maxBytes) {
        fail(fullPath.replace(ROOT + '/', ''), `File too large: ${(size / 1024 / 1024).toFixed(1)} MB (limit 10 MB)`);
      }
    }
  }
}
scanDir(ROOT);
if (!errors.find(e => e.name.includes('too large'))) {
  ok('No files exceed 10MB size limit');
}

// ─── 6. node_modules 不应在 .gitignore 以外提交 ────────────────
section('node_modules hygiene');
const gitignoreContent = fs.existsSync(path.join(ROOT, '.gitignore'))
  ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf-8')
  : '';
if (gitignoreContent.includes('node_modules')) {
  ok('.gitignore excludes node_modules');
} else {
  fail('.gitignore', 'node_modules/ not in .gitignore — will pollute skill zip');
}

// ─── 结果 ─────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Package checks: ${passed + failed} total, ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed checks:');
  errors.forEach(({ name, reason }) => console.error(`  ✗ ${name}: ${reason}`));
}
console.log(`${'─'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
