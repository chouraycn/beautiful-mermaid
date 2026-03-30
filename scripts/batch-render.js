/**
 * Batch Render with Worker Threads
 * 
 * 使用Worker线程并行渲染多个Mermaid图表，提升批量渲染性能
 */

import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 默认并发数：CPU核心数 - 1（保留一个核心给主线程）
 */
const DEFAULT_CONCURRENCY = Math.max(2, os.cpus().length - 1);

/**
 * 批量渲染多个图表
 * 
 * @param {string[]} diagrams - 图表内容数组
 * @param {object} config - Mermaid配置对象
 * @param {object} options - 可选配置
 * @param {number} options.concurrency - Worker并发数（默认：CPU核心数-1）
 * @param {Function} options.onProgress - 进度回调 (completed, total) => void
 * @param {number} options.batchSize - 每个Worker一次处理的任务数（默认：1）
 * @returns {Promise<(string|Error)[]>} 渲染结果数组，失败项为Error对象
 */
export async function renderBatch(diagrams, config, options = {}) {
  const {
    concurrency = DEFAULT_CONCURRENCY,
    onProgress,
    batchSize = 1
  } = options;

  // 验证输入
  if (!Array.isArray(diagrams) || diagrams.length === 0) {
    return [];
  }

  // 结果数组（保持原始顺序）
  const results = new Array(diagrams.length).fill(null);
  
  // 已完成计数
  let completed = 0;
  
  // 任务队列
  const taskQueue = [];
  for (let i = 0; i < diagrams.length; i++) {
    taskQueue.push({
      diagramContent: diagrams[i],
      id: i
    });
  }
  
  // Worker池
  const workers = [];
  const workerPath = path.join(__dirname, 'worker', 'renderer.js');
  
  // 创建Worker池
  for (let i = 0; i < concurrency; i++) {
    const worker = new Worker(workerPath, {
      workerData: { config }
    });
    
    worker.on('message', (message) => {
      const { success, svg, error, id } = message;
      
      if (success) {
        results[id] = svg;
      } else {
        results[id] = new Error(`Render failed for diagram #${id}: ${error.message}`);
      }
      
      completed++;
      
      // 触发进度回调
      if (onProgress) {
        onProgress(completed, diagrams.length);
      }
      
      // 检查是否所有任务完成
      if (completed === diagrams.length) {
        // 关闭所有Worker
        workers.forEach(w => w.terminate());
      }
    });
    
    worker.on('error', (err) => {
      console.error('Worker error:', err);
      worker.terminate();
    });
    
    workers.push(worker);
  }
  
  // 分发初始任务
  let taskIndex = 0;
  const distributeTasks = () => {
    for (const worker of workers) {
      if (taskIndex >= taskQueue.length) break;
      
      // 分配一批任务
      const tasks = [];
      for (let i = 0; i < batchSize && taskIndex < taskQueue.length; i++) {
        tasks.push(taskQueue[taskIndex++]);
      }
      
      if (tasks.length === 1) {
        worker.postMessage(tasks[0]);
      } else if (tasks.length > 1) {
        // 批量发送任务（暂不支持，保留接口）
        tasks.forEach(task => worker.postMessage(task));
      }
    }
  };
  
  distributeTasks();
  
  // 等待所有任务完成
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (completed === diagrams.length) {
        clearInterval(checkInterval);
        resolve(results);
      }
    }, 50);
  });
}

/**
 * 计算批量渲染的性能统计
 * 
 * @param {number} diagramCount - 图表数量
 * @param {number} concurrency - 并发数
 * @returns {object} 性能预测
 */
export function estimatePerformance(diagramCount, concurrency = DEFAULT_CONCURRENCY) {
  const avgRenderTime = 80; // 平均每个图表渲染时间（ms）
  
  // 单线程时间
  const singleThreadTime = diagramCount * avgRenderTime;
  
  // 并行时间（考虑Worker创建开销）
  const workerOverhead = concurrency * 50; // 每个Worker约50ms开销
  const parallelTime = Math.ceil(diagramCount / concurrency) * avgRenderTime + workerOverhead;
  
  return {
    singleThreadTime,
    parallelTime,
    speedup: (singleThreadTime / parallelTime).toFixed(2),
    estimatedTime: parallelTime
  };
}
