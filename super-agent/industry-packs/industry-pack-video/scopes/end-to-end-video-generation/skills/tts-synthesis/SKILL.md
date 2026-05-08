# TTS语音合成 (TTS Synthesis)

## 概述
将剧本对白文本转化为与画面情绪匹配的AI配音音频，支持多种情绪表达（喜/怒/哀/惧/惊）和角色音色差异化。语音合成质量直接影响观众的沉浸感和情感共鸣，需确保语速、语调、情感与画面内容高度一致。

## 适用场景
- 剧本对白的AI配音生成
- 旁白/独白的语音合成
- 情感参数不匹配时的重新合成
- 多角色差异化音色生成

## 执行步骤

### Step 1: 文本预处理
- 对对白文本进行分句和断句标记
- 识别特殊发音标注（如：重读/停顿/拖音/尾音上扬）
- 处理数字/英文/特殊符号的发音规则
- 标记语气词和感叹词的特殊处理

### Step 2: 音色配置
为每个角色选择/创建音色：
- **音色选择维度**：年龄（少女/青年/中年）、性别、音质（清亮/低沉/沙哑）
- **常用音色映射**：
  - 男主：青年男声，中低音，清朗有力
  - 女主：青年女声，中高音，温柔清晰
  - 反派：中年男声，低沉略带沙哑
  - 旁白：中性成熟音色，平稳客观
- 确保同一角色全片音色一致

### Step 3: 情感参数配置
根据剧本情绪标注配置TTS参数：
- **喜（Joy）**: speed=1.1, pitch=+10%, energy=high, 语调上扬
- **怒（Anger）**: speed=1.2, pitch=+5%, energy=very_high, 语调急促
- **哀（Sadness）**: speed=0.85, pitch=-10%, energy=low, 语调下沉
- **惧（Fear）**: speed=1.0, pitch=+5%, energy=medium, 语调颤抖不稳
- **惊（Surprise）**: speed=1.3(首字), pitch=+15%, energy=high, 突然拔高
- **平（Neutral）**: speed=1.0, pitch=0, energy=medium, 自然平稳

### Step 4: 时长控制
- 计算目标时长（需与对应视频片段时长匹配）
- 通过调整语速确保配音时长在目标±10%以内
- 如果文本过长无法在目标时长内自然表达，反馈给上游调整文本
- 预留镜头首尾各0.3秒静音（用于转场过渡）

### Step 5: 合成执行
- 调用TTS模型API生成音频
- 支持的TTS模型：Azure TTS、讯飞TTS、Fish Audio、Bark等
- 生成16bit/44.1kHz WAV格式原始音频
- 执行基础音频后处理：降噪、标准化响度（-16 LUFS）

### Step 6: 质量验证
- 检查音频完整性（无截断/卡顿/杂音）
- 验证时长是否在目标范围内
- 检测是否存在AI合成痕迹（机械感/不自然停顿）
- 确认情感表达与标注一致

## 输入规范
```json
{
  "dialogue": {
    "shot_ref": "SHOT-001",
    "speaker": "角色A",
    "text": "你到底在说什么？",
    "emotion": "anger",
    "type": "dialogue|narration|monologue",
    "target_duration": 2.5,
    "special_marks": ["重读'到底'", "尾音上扬"]
  },
  "voice_config": {
    "character": "角色A",
    "voice_id": "young_female_01",
    "base_speed": 1.0,
    "base_pitch": 0
  }
}
```

## 输出规范
```json
{
  "task_id": "TTS-001",
  "shot_ref": "SHOT-001",
  "output_file": "/audio/TTS-001.wav",
  "actual_duration": 2.4,
  "target_duration": 2.5,
  "duration_diff_percent": -4,
  "voice_id": "young_female_01",
  "emotion_applied": "anger",
  "params_used": {
    "speed": 1.2,
    "pitch": "+5%",
    "energy": "very_high"
  },
  "quality_check": {
    "no_truncation": true,
    "no_artifacts": true,
    "loudness_lufs": -16.2
  }
}
```

## 最佳实践
1. **情感层次**：避免全片只有"读"的感觉，需要有情绪起伏变化
2. **断句自然**：参考人类说话的气口节奏，不要只按标点断句
3. **角色区分**：多角色对话时确保音色差异明显，观众能区分说话人
4. **留白艺术**：适当的沉默/停顿比密集的对白更有戏剧张力
5. **响度统一**：所有配音片段的响度标准化，避免忽大忽小

## 约束条件
- 配音时长与目标时长偏差不超过±10%
- 音频格式统一为16bit/44.1kHz WAV
- 响度标准化到-16 LUFS（±1 LUFS）
- 不合成明显不自然的AI语音（如机器人感过重）
- 同一角色全片使用相同voice_id
