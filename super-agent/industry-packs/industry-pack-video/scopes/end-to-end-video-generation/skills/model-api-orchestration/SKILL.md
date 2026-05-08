# 模型API编排 (Model API Orchestration)

## 概述
管理和编排多个AI生成模型的API调用，实现三级生产流水线（参考图→融合图→视频片段）的自动化执行。该技能需要熟悉各主流AI生成模型的API规范、参数配置和最佳实践，确保生成质量和效率的最优平衡。

## 适用场景
- 三级流水线的自动化执行（参考图→融合图→视频）
- 多模型选型和切换（根据镜头需求选择最优模型）
- API故障时的降级切换
- 生成参数的精细调优

## 执行步骤

### Step 1: 模型选型决策
根据任务类型和需求选择最优模型：
- **静态图像（角色参考图）**: SDXL（高一致性）> Midjourney（高美感）
- **动态融合图**: SDXL + ControlNet（精确控制）> 可灵（快速）
- **视频片段生成**: Runway Gen-3（画质最优）> 可灵（性价比）> Pika（速度快）
- **人物特写**: SDXL + FaceID（最佳一致性）
- **全景/环境**: Midjourney（最佳美感）

### Step 2: 参数配置
为不同模型配置最优参数：
- **SDXL**: steps=30-50, cfg_scale=7-8, sampler=DPM++2M_Karras, size=1024x1024
- **Runway Gen-3**: duration=4s, motion_intensity=medium, interpolation=smooth
- **可灵Kling**: duration=5s, creativity=0.5, model_version=v1.5
- **Pika**: motion=2, guidance_scale=12, fps=24
- **TTS**: 根据情绪标注选择语速(0.8-1.2x)和语调(pitch±20%)

### Step 3: 三级流水线执行
```
Level 1: 参考图生成
├── 调用SDXL生成角色全身参考图（用于后续一致性锚定）
├── 调用SDXL生成场景环境参考图
└── 参考图通过质检后进入Level 2

Level 2: 融合图生成
├── 将角色参考图+场景参考图+具体镜头Prompt融合
├── 使用ControlNet/IP-Adapter控制构图和姿态
└── 融合图通过质检后进入Level 3

Level 3: 视频片段生成
├── 以融合图为首帧/参考帧
├── 调用视频生成模型产出3-5秒片段
└── 视频片段提交质检
```

### Step 4: API调用管理
- 构建统一的API调用抽象层
- 处理不同模型的认证方式（API Key/OAuth/Token）
- 实现请求重试和超时处理
- 记录每次API调用的请求参数和响应结果（用于后续分析优化）

### Step 5: 降级策略执行
当主模型不可用时执行降级：
- 监测API可用性（心跳检测/错误率阈值）
- 触发降级条件：连续3次调用失败 或 错误率>20% 或 延迟>预期3倍
- 降级链路：Runway→可灵→Pika（视频）；SDXL→MJ API→DALL-E（图像）
- 降级后调整Prompt格式适配新模型
- 恢复检测：每5分钟尝试恢复主模型

### Step 6: 结果收集与元数据记录
- 收集生成结果文件（图像/视频/音频）
- 记录完整元数据（模型、参数、耗时、文件路径）
- 按照统一格式输出，便于下游质检和合成使用

## 输入规范
```json
{
  "task": {
    "task_id": "T-001",
    "type": "reference_image|fusion_image|video_clip",
    "prompt_positive": "正面提示词",
    "prompt_negative": "负面提示词",
    "reference_images": ["前置参考图路径"],
    "target_model": "preferred模型",
    "fallback_models": ["降级备选模型"],
    "params_override": {}
  }
}
```

## 输出规范
```json
{
  "task_id": "T-001",
  "status": "success|failed|degraded",
  "model_used": "实际使用的模型",
  "output_file": "/assets/T-001_output.mp4",
  "metadata": {
    "model": "runway_gen3",
    "generation_time_ms": 12500,
    "params_used": {},
    "api_response_id": "resp_xxx",
    "degraded_from": null
  }
}
```

## 最佳实践
1. **模型特长匹配**：不同模型有不同强项，人像用SDXL+FaceID，风景用MJ
2. **参数缓存**：成功的参数组合缓存为模板，减少试错
3. **预热请求**：批量任务开始前发送少量预热请求确认API可用
4. **成本优化**：非关键镜头可使用性价比更高的模型
5. **版本锁定**：生产环境锁定模型版本，避免API更新导致风格漂移

## 约束条件
- 严格遵守各模型API的速率限制
- 不修改上游传入的Prompt内容
- 所有API调用必须记录完整日志
- 降级切换时必须通知上游调度系统
- 生成文件必须按规范命名和存储
