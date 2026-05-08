# 音画同步 (Audio-Visual Sync)

## 概述
将AI配音音轨与视频画面进行精确的时序对齐，确保对白/旁白与画面动作和口型保持同步，同时处理背景音乐的匹配和音量层级平衡。音画同步误差必须控制在<100ms，这是人耳感知的舒适阈值。

## 适用场景
- AI配音与视频画面的时序对齐
- 背景音乐的节奏匹配和音量调整
- 音效的精确定位和添加
- 音画不同步问题的诊断和修复

## 执行步骤

### Step 1: 音频素材清点
- 确认所有对白配音文件已到位
- 验证每段配音的时长与对应镜头时长兼容
- 检查音频格式一致性（采样率/位深度/声道）
- 选择背景音乐（根据整体情绪基调）

### Step 2: 对白音画对齐
- 根据分镜脚本中的audio_sync标注确定对白起始时间
- 将配音音轨精确放置到时间线对应位置
- 验证对白结束点不超过镜头结束点
- 如果配音与镜头时长有偏差，微调对白起始点或调整播放速度（±5%以内）

### Step 3: 口型匹配验证
- 分析视频中人物的嘴部动作节奏
- 对比配音的音素节奏
- 计算口型匹配度评分
- 偏差>150ms时标记为需要调整
- 调整策略：微调音频时间/调整视频速度/接受偏差

### Step 4: 背景音乐处理
- 根据情绪曲线选择合适的背景音乐段落
- 设置音乐入点和出点（淡入2秒/淡出3秒）
- 音乐节奏与剪辑节奏的匹配（重音在画面切换点）
- 情绪转折处切换/调整音乐

### Step 5: 音量层级平衡（Mixing）
- 对白层级（最高优先级）：-6 dBFS基准
- 背景音乐：-18 dBFS基准，对白出现时自动ducking到-24 dBFS
- 音效：-12 dBFS，按需点缀
- 确保整体响度标准化：-14 LUFS（适合移动端播放）
- 峰值不超过-1 dBFS（避免削波失真）

### Step 6: 同步验证与输出
- 对每个对白段落进行音画同步误差测量
- 生成同步报告（标注各段偏差值）
- 所有段落偏差<100ms则通过
- 输出混缩后的音频主轨

## 输入规范
```json
{
  "timeline": "已构建的时间线JSON",
  "audio_assets": [
    {
      "shot_ref": "SHOT-001",
      "dialogue_file": "/audio/TTS-001.wav",
      "target_start": 0.5,
      "target_end": 3.8,
      "emotion": "anger"
    }
  ],
  "bgm_config": {
    "mood": "tense",
    "energy": "medium",
    "genre_preference": "orchestral"
  },
  "video_fps": 24
}
```

## 输出规范
```json
{
  "sync_report": {
    "total_dialogue_segments": 12,
    "all_within_threshold": true,
    "max_offset_ms": 75,
    "avg_offset_ms": 32,
    "segments": [
      {
        "shot_ref": "SHOT-001",
        "target_start": 0.5,
        "actual_start": 0.52,
        "offset_ms": 20,
        "lip_sync_score": 0.85,
        "status": "pass"
      }
    ]
  },
  "audio_mix": {
    "output_file": "/audio/final_mix.wav",
    "format": "48kHz/24bit/stereo",
    "loudness_lufs": -14.2,
    "peak_dbfs": -1.5,
    "bgm_track": "tense_orchestral_01",
    "ducking_applied": true
  }
}
```

## 最佳实践
1. **对白优先**：所有音频处理的首要原则是确保对白清晰可闻
2. **Ducking自动化**：背景音乐在对白出现时自动降低音量
3. **预留缓冲**：对白首尾各预留0.1秒静音缓冲
4. **移动端优化**：考虑到大部分用户使用手机扬声器，低频不宜过重
5. **情绪匹配**：音乐的情绪变化应与画面情绪同步（不可错位）

## 约束条件
- 音画同步误差<100ms（所有对白段落）
- 整体响度-14 LUFS ±1 LUFS
- 峰值不超过-1 dBFS
- 音乐不可遮盖对白（ducking必须生效）
- 输出格式：48kHz/24bit立体声WAV
