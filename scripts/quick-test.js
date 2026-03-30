/**
 * Quick Test for Batch Render
 * 快速测试Worker并行渲染功能
 */

import { renderBatch } from './batch-render.js';

// 简单的测试图表
const testDiagrams = [
  'graph TD\nA --> B\nB --> C',
  'graph LR\nD --> E\nE --> F',
  'sequenceDiagram\nAlice->>Bob: Hello\nBob-->>Alice: Hi'
];

console.log('🧪 Quick Test: Worker Batch Render');
console.log(`   Diagrams: ${testDiagrams.length}`);
console.log(`   Workers: 2\n`);

const config = {
  theme: 'default',
  startOnLoad: false
};

const startTime = Date.now();

renderBatch(testDiagrams, config, {
  concurrency: 2,
  onProgress: (completed, total) => {
    console.log(`   Progress: ${completed}/${total}`);
  }
})
  .then(results => {
    const duration = Date.now() - startTime;
    const success = results.filter(r => typeof r === 'string').length;
    const failed = results.filter(r => r instanceof Error).length;
    
    console.log(`\n✅ Completed in ${duration}ms`);
    console.log(`   Success: ${success}, Failed: ${failed}`);
    
    if (success === testDiagrams.length) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log('\n⚠️  Some tests failed');
    }
  })
  .catch(err => {
    console.error('❌ Test failed:', err);
  });
