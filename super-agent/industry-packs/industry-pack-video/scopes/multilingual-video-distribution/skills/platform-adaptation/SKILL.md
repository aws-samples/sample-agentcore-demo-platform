# 平台规格适配 (Platform Adaptation)

## 技能概述

平台规格适配技能负责将处理后的视频按照各目标平台的技术规格要求进行格式转换和适配，确保视频在每个平台上的上传、审核和播放都满足要求。覆盖YouTube、TikTok、Instagram Reels、B站、快手等主流平台的规格数据库维护和自动化适配执行。

## 适用场景

- 单一视频同时分发到多个平台的规格批量转换
- 画幅变更（16:9→9:16/1:1）的智能裁切
- 平台特定要求的适配（时长限制/文件大小限制/编码要求）
- 字幕样式的平台化定制（硬字幕烧制）
- 封面图的自动生成和平台尺寸适配

## 执行步骤

### 步骤1：平台规格库查询
1. 根据目标平台列表，从规格数据库中加载各平台最新要求：
   - YouTube: 16:9/9:16, H.264/H.265, 最大128GB, 最长12小时
   - TikTok: 9:16, H.264, 最大287.6MB(移动)/10分钟
   - Instagram Reels: 9:16, H.264, 最长90秒, 最大4GB
   - B站: 16:9/9:16, H.264/H.265, 最长4小时
   - 快手: 9:16, H.264, 最长60分钟
2. 识别源视频与目标平台的规格差异点
3. 生成适配任务清单（每个平台需要执行哪些转换）

### 步骤2：画幅智能裁切
1. 若需要宽高比变更（如16:9→9:16），执行智能裁切
2. 使用人脸/主体检测确定关注区域（ROI）
3. 基于ROI进行智能裁切，确保主体不被切出画面
4. 对于运动镜头，执行逐帧ROI追踪裁切
5. 生成裁切预览帧供质量确认

### 步骤3：编码转换与优化
1. 按目标平台要求执行编码转换（codec/bitrate/fps）
2. 执行分辨率缩放（如4K→1080p→720p）
3. 若文件大小超限，执行码率优化压缩
4. 保证压缩后画质不明显下降（SSIM>=0.95）

### 步骤4：字幕烧制
1. 加载目标平台的字幕样式规范（字体/字号/位置/颜色/背景）
2. 将翻译字幕按样式规范渲染到视频画面
3. 处理RTL语种的字幕排版（阿拉伯语/希伯来语从右向左）
4. 确保字幕不遮挡重要画面内容
5. 支持双语字幕（原文+译文同时显示）

### 步骤5：封面生成
1. 从视频中提取关键帧候选（清晰度高、构图好、有人脸的帧）
2. 选择最佳帧作为封面基础图
3. 按平台推荐封面尺寸进行裁切/缩放
4. 可选：添加文字/标题覆盖（需不遮挡主体）

## 输入规格

```json
{
  "source_video": "path/to/processed_video.mp4",
  "subtitle_file": "path/to/subtitles.srt",
  "audio_tracks": {
    "en": "path/to/en_audio.wav",
    "ja": "path/to/ja_audio.wav"
  },
  "target_platforms": ["youtube", "tiktok", "instagram_reels", "bilibili"],
  "adaptation_config": {
    "crop_strategy": "smart_roi|center|top",
    "subtitle_style": "platform_default|custom",
    "cover_generation": true,
    "max_quality_loss": 0.05
  }
}
```

## 输出规格

```json
{
  "platform_outputs": {
    "youtube": {
      "video_file": "output/video_en_youtube.mp4",
      "cover_image": "output/cover_youtube.jpg",
      "resolution": "1920x1080",
      "aspect_ratio": "16:9",
      "duration": 120.5,
      "file_size_mb": 85.3,
      "codec": "H.264",
      "compliance": true
    },
    "tiktok": {
      "video_file": "output/video_en_tiktok.mp4",
      "cover_image": "output/cover_tiktok.jpg",
      "resolution": "1080x1920",
      "aspect_ratio": "9:16",
      "duration": 120.5,
      "file_size_mb": 45.2,
      "codec": "H.264",
      "compliance": true
    }
  },
  "compliance_report": {
    "all_platforms_compliant": true,
    "issues": []
  }
}
```

## 最佳实践

1. **规格库定期更新**：各平台规格会不定期变更，需至少每月同步一次
2. **智能裁切测试**：画幅变更后必须检查人脸/主体是否完整保留
3. **码率梯度**：同一视频面向不同平台的码率应有梯度设置（WiFi平台高码率，移动平台低码率）
4. **字幕安全区**：字幕位置需避开各平台的UI覆盖区域（如TikTok底部的互动按钮区域）

## 约束与限制

- 平台规格合规率必须100%（不合规将被平台拒绝上传）
- 画质损失不得超过5%（SSIM>=0.95）
- 智能裁切不得将人脸裁出画面
- 字幕烧制后不可逆，需确认无误后再执行
