#!/usr/bin/env node
/**
 * Beautiful Mermaid Skill — 本地发布助手
 *
 * 功能：
 *   1. 验证 package.json 和 SKILL.md 版本号一致
 *   2. 运行 test + check:pkg
 *   3. 自动创建 git tag 并 push（触发 GitHub Actions CD）
 *
 * 用法:
 *   node scripts/release.js [--dry-run]
 *   # --dry-run: 只检查，不 push
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { cwd: ROOT, stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf-8' });
}

function step(title) {
  console.log(`\n[${title}]`);
}

// ─── 1. 读取版本号 ────────────────────────────────────────────
step('Check versions');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const skillContent = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
const skillVersionMatch = skillContent.match(/^version:\s*"?([^"\n]+)"?/m);
if (!skillVersionMatch) {
  console.error('ERROR: Cannot parse version from SKILL.md');
  process.exit(1);
}
const pkgVersion = pkg.version;
const skillVersion = skillVersionMatch[1].trim();

console.log(`  package.json: ${pkgVersion}`);
console.log(`  SKILL.md:     ${skillVersion}`);

if (pkgVersion !== skillVersion) {
  console.error(`\nERROR: Version mismatch!`);
  console.error(`  package.json = "${pkgVersion}"`);
  console.error(`  SKILL.md     = "${skillVersion}"`);
  console.error(`  Please update both files to the same version.`);
  process.exit(1);
}
console.log(`  ✓ Versions match: v${pkgVersion}`);

// ─── 2. 确保工作区干净（或只有文档改动） ──────────────────────
step('Check git status');
try {
  const status = run('git status --porcelain', { quiet: true }).trim();
  if (status) {
    const lines = status.split('\n').filter(l => l.trim());
    const hasCodeChanges = lines.some(l =>
      !l.match(/\.(md|txt|gitignore)$/) && !l.includes('.DS_Store')
    );
    if (hasCodeChanges) {
      console.warn('  ⚠ Uncommitted changes detected:');
      lines.forEach(l => console.warn(`    ${l}`));
      console.warn('  Consider committing before releasing.');
    } else {
      console.log('  ✓ Only doc/meta changes pending (OK to continue)');
    }
  } else {
    console.log('  ✓ Working directory clean');
  }
} catch (e) {
  console.warn('  ⚠ Cannot check git status');
}

// ─── 3. 运行测试 ──────────────────────────────────────────────
step('Run tests');
try {
  run('npm test');
} catch {
  console.error('\nERROR: Tests failed. Fix before releasing.');
  process.exit(1);
}

step('Run package check');
try {
  run('npm run check:pkg');
} catch {
  console.error('\nERROR: Package check failed. Fix before releasing.');
  process.exit(1);
}

// ─── 4. 检查 tag 是否已存在 ────────────────────────────────────
step('Check tag');
const TAG = `v${pkgVersion}`;
try {
  const existing = run(`git tag -l "${TAG}"`, { quiet: true }).trim();
  if (existing) {
    console.error(`ERROR: Tag ${TAG} already exists!`);
    console.error('  To re-release: git tag -d v<version> && git push origin :refs/tags/v<version>');
    process.exit(1);
  }
  console.log(`  ✓ Tag ${TAG} is available`);
} catch (e) {
  console.warn('  ⚠ Cannot check existing tags');
}

// ─── 5. 创建 tag 并 push ───────────────────────────────────────
if (DRY_RUN) {
  console.log(`\n[DRY RUN] Would create tag ${TAG} and push to origin`);
  console.log('  Remove --dry-run to actually release.');
} else {
  step(`Create & push tag ${TAG}`);
  run(`git tag -a "${TAG}" -m "Release ${TAG}"`);
  run(`git push origin "${TAG}"`);
  console.log(`\n✓ Tag ${TAG} pushed! GitHub Actions will now:`);
  console.log('  1. Run tests on Node 18/20/22');
  console.log('  2. Build skill zip');
  console.log(`  3. Publish GitHub Release: beautiful-mermaid-${pkgVersion}.zip`);
  console.log(`\n  Watch progress: https://github.com/chouraycn/beautiful-mermaid/actions`);
}
