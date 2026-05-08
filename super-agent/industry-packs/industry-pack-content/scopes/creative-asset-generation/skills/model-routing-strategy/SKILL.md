# 多模型动态路由策略（Model Routing Strategy）

## 技能概述

本技能负责根据任务特征（类型/质量要求/预算/时效）自动选择最优的AI生成模型。在多模型生态下（Flux、DALL-E 3、Midjourney、Nova Canvas、Stable Diffusion、Runway、Kling等），不同模型在不同场景下的表现差异显著，精准的模型路由直接影响生成质量和成本效率。

## 适用场景

- 新任务到达时的初始模型选择
- 主模型失败后的备用模型切换
- 成本优化场景下的模型降级决策
- A/B测试中的多模型对比配置

## 执行步骤

### Step 1: 任务特征提取
从任务描述中提取路由决策的关键特征：
- **内容类型**：写实人像/商品实拍/创意插画/3D渲染/抽象艺术/视频
- **质量等级**：旗舰级（品牌主KV）/标准级（日常运营）/草稿级（内部参考）
- **特殊需求**：虚拟试穿/文字渲染/多主体合成/特定风格迁移
- **预算约束**：高预算（不限模型）/中预算（择优平衡）/低预算（成本优先）
- **时效要求**：紧急（选最快模型）/正常/非紧急（可排队）

### Step 2: 模型能力匹配矩阵

| 场景 | 首选模型 | 备选模型 | 原因 |
|------|----------|----------|------|
| 写实人像 | Flux Pro | DALL-E 3 | Flux在人物比例/皮肤质感上领先 |
| 商品主图 | Nova Canvas | Flux Pro | Nova针对电商场景优化，背景合成能力强 |
| 创意插画 | Midjourney V6 | DALL-E 3 | MJ的艺术表现力和风格化能力最强 |
| 3D渲染风格 | Midjourney V6 | Flux Pro | MJ的3D质感模拟最自然 |
| 文字渲染 | DALL-E 3 | Flux Pro | DALL-E对文本理解和渲染最准确 |
| 视频生成 | Runway Gen-3 | Kling | Runway在运动一致性和画面质量上领先 |
| 虚拟试穿 | 专用试穿模型 | Flux + ControlNet | 试穿需要人物一致性保障 |
| 图片编辑 | DALL-E 3 (Edit) | SD Inpainting | DALL-E编辑模式对指令理解最准确 |
| 大批量低成本 | SDXL | Nova Canvas | SDXL成本最低，质量可接受 |

### Step 3: 成本-质量-速度三角评估

```
模型选择评分 = w1 × 质量预期分 + w2 × (1/成本) + w3 × (1/延迟)

权重配置：
- 旗舰级任务：w1=0.7, w2=0.1, w3=0.2
- 标准级任务：w1=0.5, w2=0.3, w3=0.2
- 批量级任务：w1=0.3, w2=0.5, w3=0.2
- 紧急任务：  w1=0.3, w2=0.2, w3=0.5
```

### Step 4: 降级策略配置
为每个任务配置模型降级链：
```
主模型 → 备用模型1 → 备用模型2 → 人工介入
```
降级触发条件：
- 模型API返回5xx错误连续3次
- 响应超时（单次>60s）
- 配额耗尽（quota exhausted）
- 内容安全拦截（需分析原因后可能换模型或修改提示词）

### Step 5: 路由决策输出

```json
{
  "primary_model": "flux-pro",
  "primary_reason": "写实人像任务，Flux Pro质量最优",
  "fallback_chain": ["dall-e-3", "sdxl-turbo"],
  "parameters": {
    "steps": 30,
    "cfg_scale": 7.5,
    "size": "1024x1024",
    "sampler": "euler_ancestral"
  },
  "cost_estimate": "$0.08/image",
  "latency_estimate": "12s",
  "quality_confidence": 0.85
}
```

## 输入规格

| 输入项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| task_type | string | 是 | 任务类型标识 |
| quality_tier | enum | 是 | 质量等级(flagship/standard/draft) |
| budget_constraint | number | 否 | 单张预算上限（美元） |
| time_constraint | enum | 否 | 时效等级(urgent/normal/relaxed) |
| special_requirements | array | 否 | 特殊需求标签 |

## 输出规格

| 输出项 | 类型 | 说明 |
|--------|------|------|
| routing_decision | object | 模型选择决策（含理由） |
| fallback_chain | array | 降级模型链 |
| parameter_config | object | 推荐参数配置 |
| cost_estimate | number | 预估成本 |
| confidence | number | 路由置信度(0-1) |

## 最佳实践

1. **不要盲目选最贵的模型**：标准运营素材用SDXL可能就够用，节约成本
2. **新模型上线灰度验证**：新模型加入路由表前须经过≥50个样本的质量验证
3. **定期更新能力矩阵**：模型能力随版本更新变化，每月review一次路由规则
4. **考虑模型一致性**：同一系列/campaign的素材尽量使用同一模型以保持风格统一
5. **配额预分配**：大批量任务提前确认模型配额是否充足

## 常见陷阱

- Midjourney不支持API直接调用（需通过Discord Bot或第三方代理）
- 不同模型的尺寸支持不同（DALL-E 3只支持固定几种尺寸）
- 某些模型在特定主题上有内容安全过滤偏严的问题
- 模型价格可能随时调整，需要动态获取最新计价
