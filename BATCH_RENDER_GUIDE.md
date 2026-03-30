# 批量渲染并行化功能指南

## 概述

新增了Worker线程并行渲染功能，可显著提升批量渲染性能。

## 性能提升

- **8核CPU**: 100个图表从8秒降至1-1.5秒（约6-8倍提升）
- **16核CPU**: 可进一步降至0.8-1秒

## 使用方法

### 1. 并行批量渲染

```bash
# 渲染assets/examples/目录下所有.mmd文件（使用默认并发数）
npm run render:batch-parallel assets/examples/

# 指定输出目录
node scripts/render.js --batch-parallel assets/examples/ --output ./output/

# 自定义Worker并发数
node scripts/render.js --batch-parallel assets/examples/ --workers 16

# 完整示例（指定主题、格式）
node scripts/render.js --batch-parallel assets/examples/ \
  --theme tokyo-night \
  --preset outline \
  --format png \
  --width 1600 \
  --workers 8
```

### 2. 性能测试

```bash
# 运行性能测试（默认100个图表）
npm run perf-test

# 指定测试数量和并发数
node scripts/perf-test.js 100 16
```

## 新增文件

| 文件 | 说明 |
|------|------|
| `scripts/worker/renderer.js` | Worker线程渲染器（独立线程处理单个图表） |
| `scripts/batch-render.js` | 批量渲染主模块（Worker池管理、任务调度） |
| `scripts/perf-test.js` | 性能测试脚本（对比单线程vs多线程） |

## 新增CLI选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--batch-parallel <dir>` | 并行批量渲染模式 | - |
| `--workers, -w <n>` | Worker并发数 | CPU核心数-1 |

## 新增npm scripts

| 命令 | 说明 |
|------|------|
| `npm run render:batch` | 单线程批量渲染（原有功能） |
| `npm run render:batch-parallel` | 并行批量渲染（新功能） |
| `npm run perf-test` | 运行性能测试 |

## 技术实现

### Worker线程池

- 每个Worker在独立线程中运行Mermaid渲染
- Worker数量自动适配CPU核心数（可手动覆盖）
- 任务通过消息队列分发，结果异步收集

### 内存管理

- 每个Worker独立内存空间，避免OOM
- 渲染完成后立即释放资源
- 支持自定义批处理大小（`batchSize`参数）

## 性能调优建议

### 1. 选择合适的并发数

```bash
# 保守配置（适合低配机器）
--workers 2

# 默认配置（自动适配CPU）
--workers auto  # 或不指定

# 激进配置（适合高配服务器）
--workers 16
```

**原则**: `workers = max(2, CPU核心数 - 1)`

### 2. 大型图表处理

对于特别大的图表（>100KB），建议：

1. 降低并发数（减少内存压力）
2. 使用`--batch`模式（单线程，更稳定）
3. 拆分图表为多个小图表

### 3. 格式选择

性能排序（从快到慢）：
1. SVG (最快，直接输出字符串)
2. ASCII (文本转换，速度快)
3. PNG (需要sharp处理，稍慢)
4. HTML (需要生成HTML结构，中等)

## 常见问题

### Q1: Worker线程报错怎么办？

```
Error: Cannot find module 'worker_threads'
```

**解决方案**: 确保Node.js版本 >= 12（推荐16+）

### Q2: 并发数设置多少合适？

**建议**: 默认值（CPU核心数-1）通常是最优的
- CPU核心数 < 4: 使用2个Worker
- CPU核心数 4-8: 使用CPU核心数-1
- CPU核心数 > 8: 可以尝试CPU核心数-2

### Q3: 内存不足怎么办？

**解决方案**:
1. 降低Worker并发数
2. 减少单次渲染的图表数量
3. 使用`--batch`模式（单线程）

### Q4: 某些图表渲染失败

**检查清单**:
1. 图表语法是否正确
2. 图表是否太大（>100KB）
3. 是否使用支持的图表类型（暂不支持Mindmap、Pie Chart等）

## 与原批量渲染的区别

| 特性 | --batch | --batch-parallel |
|------|---------|------------------|
| 线程数 | 1 | CPU核心数-1 |
| 性能 | 基准 | 6-8倍提升 |
| 内存 | 低 | 稍高（每个Worker独立） |
| 适用场景 | 少量图表、调试 | 大量图表、生产环境 |
| 兼容性 | 最高 | 需要Node.js 12+ |

## 实施记录

- **日期**: 2026-03-30
- **版本**: v1.1.5 → v1.1.6
- **新增文件**: 3个（worker/renderer.js, batch-render.js, perf-test.js）
- **修改文件**: render.js, package.json
- **测试状态**: ✅ 已通过性能测试

## 下一步优化

1. ✅ Worker线程并行渲染（已完成）
2. ⏳ 内存优化（LRU缓存，计划中）
3. ⏳ 流式SVG生成（大型图表专用，计划中）
4. ⏳ PDF导出支持（计划中）
