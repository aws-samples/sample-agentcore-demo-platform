# AI生成提示词工程 (Prompt Engineering)

## 概述
为AI图像/视频生成模型编写高质量的提示词（Prompt），将分镜脚本中的视觉描述转化为模型可精确理解和执行的技术指令。提示词质量直接决定抽卡合格率（目标>=80%），是影响生产效率的关键技能。

## 适用场景
- 基于分镜脚本为每个镜头编写生成Prompt
- 抽卡合格率偏低时的Prompt优化
- 针对特定模型（Runway/Pika/可灵/SD）的Prompt适配
- 人物一致性不达标时的Prompt修复

## 执行步骤

### Step 1: 分析镜头需求
- 解析分镜脚本中的视觉需求
- 确定主体（人物/环境/物品）的优先级
- 识别情绪基调对视觉风格的要求
- 评估镜头复杂度（单人/多人/动作/静态）

### Step 2: 构建正面提示词（Positive Prompt）
按照标准结构组织：
```
[主体描述] + [动作/姿态] + [环境描述] + [光影描述] + [风格描述] + [质量标签]
```
- **主体描述**：引用角色参数库的固定描述，确保一致性
- **动作/姿态**：当前镜头中角色的具体动作和表情
- **环境描述**：场景的空间、物品、天气、时间
- **光影描述**：光源方向、光质（硬光/柔光）、色温
- **风格描述**：艺术风格、画面质感（cinematic/photorealistic/anime等）
- **质量标签**：8k, masterpiece, best quality, highly detailed等

### Step 3: 构建负面提示词（Negative Prompt）
排除不需要的元素：
- 角色负面：与参数库矛盾的特征（如角色是黑发则排除blonde/red hair）
- 质量负面：blurry, low quality, distorted, extra limbs, bad anatomy
- 风格负面：与目标风格矛盾的风格标签
- 内容负面：watermark, text, logo, signature

### Step 4: 模型适配优化
根据使用的生成模型进行Prompt调整：
- **Stable Diffusion XL**：支持长Prompt，可使用权重语法(keyword:1.3)
- **Midjourney**：偏好简洁描述，使用--ar --style参数
- **Runway Gen-3**：视频生成需额外描述动作方向和速度
- **可灵Kling**：支持中文Prompt，对人物动作描述敏感
- **Pika**：简洁为主，强调camera movement描述

### Step 5: 一致性保障检查
- 验证Prompt中的角色描述与参数库100%匹配
- 确认相邻镜头的环境描述保持连贯
- 检查光照/色调与情绪基调的一致性
- 确保不同镜头中同一角色的Prompt核心词完全一致

### Step 6: 迭代优化
当抽卡合格率不达标时：
- 分析不合格样本的共性问题
- 针对性地加强/弱化某些描述词
- 调整词语顺序（前面的词权重更高）
- 增加更多约束性的负面Prompt

## 输入规范
```json
{
  "shot": "分镜脚本中的单个shot对象",
  "character_profiles": "角色参数库",
  "target_model": "sdxl|midjourney|runway|kling|pika",
  "generation_type": "image|video",
  "previous_attempts": "之前的Prompt和不合格原因（如果是优化任务）"
}
```

## 输出规范
```json
{
  "shot_id": "SHOT-001",
  "target_model": "sdxl",
  "prompt_positive": "a young Chinese woman with oval face and beauty mark below right eye, shoulder-length straight chestnut brown hair center-parted, wearing cream cashmere sweater, sitting at wooden table in modern cafe, afternoon golden sunlight from left window, shocked expression, leaning forward, cinematic lighting, photorealistic, 8k, masterpiece, best quality",
  "prompt_negative": "curly hair, blonde hair, dark skin, blurry, low quality, distorted face, extra fingers, bad anatomy, watermark, text",
  "generation_params": {
    "width": 768,
    "height": 1344,
    "steps": 30,
    "cfg_scale": 7.5,
    "seed": -1
  },
  "consistency_notes": "角色锚点已全部包含：beauty mark + chestnut hair + oval face + silver earrings + slender figure",
  "optimization_history": "版本2：加强了hair color描述，解决了v1中发色偏差问题"
}
```

## 最佳实践
1. **角色描述前置**：将角色核心特征放在Prompt最前面，确保最高权重
2. **具体化光影**：用"golden afternoon sunlight streaming from left window"而非"good lighting"
3. **情绪可视化**：将抽象情绪转化为可视化描述（如"angry"→"furrowed brows, clenched jaw, intense stare"）
4. **逐步调优**：每次只修改1-2个变量，便于追踪优化效果
5. **保存成功模板**：将高合格率的Prompt结构保存为模板复用

## 约束条件
- 正面Prompt长度：SDXL建议77-150 tokens，MJ建议<60词
- 负面Prompt必须包含基础质量排除项
- 角色描述部分必须严格引用参数库，不得自行发挥
- 同一场景的不同镜头必须使用相同的环境/光影描述基底
