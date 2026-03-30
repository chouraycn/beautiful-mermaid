/**
 * Worker Thread Renderer
 * 
 * 在独立线程中渲染单个Mermaid图表，避免阻塞主线程
 */

import { parentPort, workerData } from 'worker_threads';
import mermaid from 'mermaid';

// 初始化Mermaid配置
mermaid.initialize(workerData.config);

/**
 * 监听主线程发送的渲染任务
 */
parentPort.on('message', async ({ diagramContent, id }) => {
  try {
    // 生成唯一ID避免冲突
    const elementId = `mermaid-worker-${Date.now()}-${id}`;
    
    // 渲染图表
    const { svg } = await mermaid.render(elementId, diagramContent);
    
    // 返回成功结果
    parentPort.postMessage({
      success: true,
      svg,
      id
    });
  } catch (error) {
    // 返回失败结果
    parentPort.postMessage({
      success: false,
      error: {
        message: error.message,
        stack: error.stack
      },
      id
    });
  }
});
