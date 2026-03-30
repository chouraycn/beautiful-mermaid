/**
 * Performance Test for Batch Rendering
 * 
 * 测试批量渲染性能，对比单线程和多线程性能
 */

import { renderBatch, estimatePerformance } from './batch-render.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 从assets目录加载测试图表
 */
function loadTestDiagrams(count = 100) {
  const diagrams = [];
  const examplesDir = path.join(__dirname, '..', 'assets', 'examples');
  
  // 获取所有.mmd文件
  const files = fs.readdirSync(examplesDir)
    .filter(f => f.endsWith('.mmd'));
  
  // 循环读取文件以填充测试集
  for (let i = 0; i < count; i++) {
    const file = files[i % files.length];
    const content = fs.readFileSync(path.join(examplesDir, file), 'utf-8');
    diagrams.push(content);
  }
  
  return diagrams;
}

/**
 * 单线程渲染（基准测试）
 */
async function renderSingleThread(diagrams, config) {
  const mermaid = await import('mermaid');
  mermaid.default.initialize(config);
  
  const results = [];
  for (let i = 0; i < diagrams.length; i++) {
    const elementId = `mermaid-single-${Date.now()}-${i}`;
    const { svg } = await mermaid.default.render(elementId, diagrams[i]);
    results.push(svg);
  }
  return results;
}

/**
 * 运行性能测试
 */
async function runPerfTest(diagramCount = 100, concurrency = 8) {
  console.log(`\n🚀 Performance Test: ${diagramCount} diagrams`);
  console.log(`   Concurrency: ${concurrency}`);
  console.log(`   System CPU cores: ${os.cpus().length}\n`);
  
  // 加载测试数据
  console.log('📂 Loading test diagrams...');
  const diagrams = loadTestDiagrams(diagramCount);
  console.log(`   Loaded ${diagrams.length} diagrams\n`);
  
  const config = {
    theme: 'default',
    startOnLoad: false
  };
  
  // 性能预测
  const perfEst = estimatePerformance(diagramCount, concurrency);
  console.log('📊 Performance Estimation:');
  console.log(`   Single thread: ${(perfEst.singleThreadTime / 1000).toFixed(2)}s`);
  console.log(`   Parallel:      ${(perfEst.parallelTime / 1000).toFixed(2)}s`);
  console.log(`   Speedup:       ${perfEst.speedup}x\n`);
  
  // 并行渲染测试
  console.log('⚡ Batch rendering with Worker threads...');
  const batchResults = [];
  let progressUpdateCount = 0;
  
  const batchStartTime = Date.now();
  await renderBatch(diagrams, config, {
    concurrency,
    onProgress: (completed, total) => {
      progressUpdateCount++;
      if (progressUpdateCount % 10 === 0 || completed === total) {
        const percent = ((completed / total) * 100).toFixed(1);
        process.stdout.write(`\r   Progress: ${completed}/${total} (${percent}%)`);
      }
    }
  });
  const batchTime = Date.now() - batchStartTime;
  
  console.log(`\n   ✓ Completed in ${batchTime}ms (${(batchTime / 1000).toFixed(2)}s)`);
  
  // 统计成功/失败
  const successCount = batchResults.filter(r => typeof r === 'string').length;
  const failCount = batchResults.filter(r => r instanceof Error).length;
  console.log(`   Success: ${successCount}, Failed: ${failCount}\n`);
  
  // 对比单线程（仅测试10个，避免太慢）
  const smallTestCount = 10;
  console.log(`⏱️  Single-thread baseline (testing ${smallTestCount} diagrams)...`);
  const smallDiagrams = diagrams.slice(0, smallTestCount);
  
  const singleStartTime = Date.now();
  await renderSingleThread(smallDiagrams, config);
  const singleTime = Date.now() - singleStartTime;
  
  console.log(`   ✓ Completed in ${singleTime}ms (${(singleTime / 1000).toFixed(2)}s)\n`);
  
  // 推算单线程全部时间
  const estimatedFullTime = (singleTime / smallTestCount) * diagramCount;
  const actualSpeedup = (estimatedFullTime / batchTime).toFixed(2);
  
  // 性能报告
  console.log('📈 Performance Report:');
  console.log('   ┌─────────────────────┬──────────────┬──────────────┐');
  console.log('   │ Metric              │ Single Thread │ Worker Pool  │');
  console.log('   ├─────────────────────┼──────────────┼──────────────┤');
  console.log(`   │ Time (${diagramCount} items)  │ ${(estimatedFullTime / 1000).toFixed(2)}s        │ ${(batchTime / 1000).toFixed(2)}s        │`);
  console.log(`   │ Avg per item        │ ${(singleTime / smallTestCount).toFixed(0)}ms         │ ${(batchTime / diagramCount).toFixed(0)}ms         │`);
  console.log(`   │ Speedup             │ 1.00x         │ ${actualSpeedup}x         │`);
  console.log('   └─────────────────────┴──────────────┴──────────────┘\n');
  
  // 内存使用
  const memUsage = process.memoryUsage();
  console.log('💾 Memory Usage:');
  console.log(`   RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Heap: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB / ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB\n`);
  
  return {
    batchTime,
    estimatedSingleTime: estimatedFullTime,
    speedup: parseFloat(actualSpeedup)
  };
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  const diagramCount = parseInt(process.argv[2]) || 100;
  const concurrency = parseInt(process.argv[3]) || undefined;
  
  runPerfTest(diagramCount, concurrency)
    .then(results => {
      console.log('✅ Performance test completed!\n');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Test failed:', err);
      process.exit(1);
    });
}

export { runPerfTest };
