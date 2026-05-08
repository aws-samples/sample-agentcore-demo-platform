# 批量分发管理 (Batch Distribution Management)

## 技能概述

批量分发管理技能负责管理大规模视频×语种×平台的矩阵式产出任务，包括任务调度、进度追踪、异常隔离、输出汇总和分发包生成。该技能确保50+视频×多语种×多平台的批量处理高效有序完成，目标完成时间<24小时。

## 适用场景

- 50+视频的批量多语种转换与分发
- 视频×语种×平台三维矩阵任务的进度管理
- 批量任务中的异常隔离与容错处理
- 分发包的自动汇总与元数据生成
- 批量任务的优先级调度与资源分配

## 执行步骤

### 步骤1：任务矩阵生成
1. 接收批量任务配置（视频列表×语种列表×平台列表）
2. 生成完整的任务矩阵（如50视频×5语种×3平台=750个输出单元）
3. 为每个任务单元分配唯一ID和初始状态（pending）
4. 计算资源需求和预估完成时间
5. 设定任务优先级排序（可按视频/语种/平台维度排序）

### 步骤2：并发调度执行
1. 根据可用资源，设定并发度（建议按视频维度并发）
2. 维护任务队列，按优先级依次分配执行
3. 实时更新每个任务单元的状态（pending→processing→completed/failed）
4. 监控整体进度百分比和预估剩余时间
5. 动态调整并发度（空闲资源多则扩大并发，异常多则降低并发）

### 步骤3：异常隔离与容错
1. 单个视频处理失败时，隔离该视频的所有关联任务
2. 不阻塞其他视频的正常处理流程
3. 对失败任务记录详细错误信息和失败阶段
4. 自动重试可恢复的错误（如网络超时）最多3次
5. 不可恢复的错误标记为"需人工干预"并继续其他任务

### 步骤4：输出汇总与分发包生成
1. 所有任务完成后（或达到超时阈值），执行输出汇总
2. 按视频×语种×平台三维结构组织输出文件
3. 生成完整的元数据清单（每个文件的规格/质量/状态信息）
4. 生成分发包摘要报告（成功率/失败项/质量统计）
5. 输出文件命名遵循标准规范：{video_id}_{lang}_{platform}.{ext}

## 输入规格

```json
{
  "batch_config": {
    "batch_id": "batch_20240101_001",
    "videos": ["video_001.mp4", "video_002.mp4", "...50+ videos"],
    "target_languages": ["en", "es", "ar", "ja", "ko"],
    "target_platforms": ["youtube", "tiktok", "instagram_reels"],
    "priority_order": "video_first|language_first|platform_first",
    "max_concurrent": 10,
    "timeout_hours": 24,
    "retry_config": {
      "max_retries": 3,
      "retry_delay_seconds": 60
    }
  }
}
```

## 输出规格

```json
{
  "batch_summary": {
    "batch_id": "batch_20240101_001",
    "total_tasks": 750,
    "completed": 738,
    "failed": 8,
    "skipped": 4,
    "success_rate": 0.984,
    "total_duration_hours": 18.5,
    "output_directory": "output/batch_20240101_001/"
  },
  "file_manifest": [
    {
      "video_id": "video_001",
      "language": "en",
      "platform": "youtube",
      "file_path": "output/video_001_en_youtube.mp4",
      "file_size_mb": 85.3,
      "quality_score": 0.92,
      "status": "completed"
    }
  ],
  "failure_report": [
    {
      "video_id": "video_023",
      "language": "ar",
      "platform": "all",
      "error": "TTS Arabic model unavailable",
      "stage": "dubbing_synthesis",
      "retries": 3,
      "action_needed": "manual_review"
    }
  ]
}
```

## 最佳实践

1. **视频维度并发**：以视频为单位进行并发处理效率最高（同一视频的不同语种共享中间结果）
2. **快速失败**：单个任务的超时时间应合理设置（防止僵死任务占用资源）
3. **进度透明**：实时对外暴露进度信息，让上层系统或用户可以监控
4. **增量输出**：每完成一个任务单元就立即写入输出，不等待全部完成

## 约束与限制

- 单个视频失败绝不能阻塞整批任务
- 批量任务整体超时阈值为24小时（超时后强制汇总当前结果）
- 并发度不得超过系统资源上限（防止OOM/CPU过载）
- 所有输出文件必须遵循统一命名规范
