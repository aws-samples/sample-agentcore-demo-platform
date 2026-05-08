# 并发任务调度 (Concurrent Task Scheduling)

## 概述
管理大规模AI生成任务的并发执行，包括任务队列管理、优先级排序、负载均衡、失败重试和进度追踪。该技能支持180个视频生成+360个图像生成任务的同时并发处理，确保在资源约束下实现最大化产出效率。

## 适用场景
- 一部短剧所有分镜的批量素材生成
- 多部短剧同时生产时的资源分配
- 生成失败后的智能重试调度
- 资源紧张时的优先级降级处理

## 执行步骤

### Step 1: 任务解析与队列构建
- 解析分镜脚本，提取所有需要生成的素材任务
- 为每个任务分配唯一task_id
- 构建任务依赖图：参考图→融合图→视频片段（串行依赖）
- 语音任务与图像/视频任务可并行

### Step 2: 优先级分配
优先级规则（数字越小优先级越高）：
- P1: 前序镜头的素材（确保按序完成，便于早期质检）
- P2: 包含主角的镜头（一致性问题需要尽早暴露）
- P3: 参考图任务（下游融合图和视频依赖其完成）
- P4: 一般镜头素材
- P5: 备选方案/多版本生成

### Step 3: 资源分配与负载均衡
- 评估各API端点的当前负载和排队深度
- 按照API提供商的并发限制分配任务
  - Runway: 最大50并发
  - 可灵: 最大80并发
  - SDXL: 最大200并发
  - TTS: 最大100并发
- 实现加权轮询（性能好的端点分配更多任务）
- 预留10%的并发余量用于重试任务

### Step 4: 执行监控
- 实时追踪每个任务状态：queued→processing→completed/failed
- 监控各端点的响应延迟和错误率
- 当某端点错误率>10%时触发告警
- 维护全局进度看板（已完成/进行中/排队中/失败数）

### Step 5: 失败处理与重试策略
- 首次失败：等待5秒后原端点重试
- 二次失败：等待30秒后切换备选端点重试
- 三次失败：标记为人工介入，记录所有失败信息
- 超时处理：API调用超过模型预期耗时的2倍视为超时
- 备选模型链：Runway→可灵→Pika（图像）；SDXL→MJ（图像）

### Step 6: 完成汇总与交接
- 所有任务完成后生成批次报告
- 统计成功率、平均耗时、资源利用率
- 将生成的素材文件路径和元数据打包交付质检Agent
- 标记未完成任务及原因

## 输入规范
```json
{
  "task_list": [
    {
      "task_id": "T-001",
      "type": "reference_image|fusion_image|video_clip|tts_audio",
      "shot_ref": "SHOT-001",
      "prompt": "生成提示词",
      "params": {},
      "dependencies": ["T-000"],
      "priority": 1
    }
  ],
  "resource_config": {
    "max_concurrent_video": 180,
    "max_concurrent_image": 360,
    "available_endpoints": ["runway", "kling", "sdxl", "pika"],
    "max_retries": 3
  }
}
```

## 输出规范
```json
{
  "batch_id": "BATCH-20240101-001",
  "total_tasks": 540,
  "completed": 520,
  "failed_final": 5,
  "pending_manual": 5,
  "retried": 45,
  "average_latency_ms": 12000,
  "success_rate": 0.963,
  "resource_utilization": {
    "runway": {"tasks": 150, "avg_latency": 15000, "error_rate": 0.02},
    "kling": {"tasks": 200, "avg_latency": 10000, "error_rate": 0.01}
  },
  "output_manifest": [
    {"task_id": "T-001", "status": "completed", "output_path": "/assets/T-001.mp4", "model_used": "runway"}
  ]
}
```

## 最佳实践
1. **依赖优先**：优先完成有下游依赖的任务（参考图先于融合图）
2. **早期暴露**：主角相关素材优先生成，尽早发现一致性问题
3. **弹性资源**：高峰期可临时提高并发上限，低谷期释放资源
4. **指数退避**：重试间隔采用指数退避策略（5s→30s→120s）
5. **断点续传**：支持任务中断后从最后成功点恢复

## 约束条件
- 不超过各API提供商的并发限制
- 重试次数严格不超过3次
- 总超时率控制在<5%
- 资源利用率目标>80%
- 不修改任务Prompt和参数（只管调度，不管内容）
