# 提示词优化（Prompt Optimization）

## 技能概述

本技能负责将创意需求转化为高质量的AI生成模型提示词，并针对目标模型的特性进行精准优化。提示词质量直接决定生成效果——优秀的提示词可以将首次生成通过率从40%提升至80%以上。本技能是创意意图与模型执行之间的核心翻译层。

## 适用场景

- 将结构化需求转化为模型可执行的提示词
- 对生成效果不佳的提示词进行迭代优化
- 针对新模型进行提示词语法适配
- 批量任务的提示词模板化和变量化处理

## 执行步骤

### Step 1: 提示词结构构建（四模块框架）

每条提示词必须包含以下四个核心模块：

**1. 主体描述（Subject/What）**
- 清晰描述画面主体：人物/物体/场景
- 关键细节指定：材质/纹理/颜色/数量/状态
- 空间关系描述：位置/比例/前后关系

**2. 风格定义（Style）**
- 艺术风格锚定：photography/illustration/3d render/watercolor等
- 参考艺术家/作品风格（仅用于风格方向，非抄袭）
- 画面质感：cinematic/editorial/product photography等
- 光照条件：natural light/studio lighting/golden hour等

**3. 构图指导（Composition）**
- 视角：eye level/bird's eye/low angle/close-up/full body
- 构图法则：rule of thirds/centered/symmetrical/dynamic
- 景深：shallow DOF/deep focus/bokeh background
- 画面留白和信息区域规划

**4. 负向约束（Negative Prompt）**
- 通用排除：blurry, low quality, distorted, deformed, watermark, text
- 人物相关：extra fingers, mutated hands, bad anatomy, cross-eyed
- 场景相关：oversaturated, unrealistic shadows, floating objects
- 风格排除：与目标风格冲突的元素

### Step 2: 模型特性适配

**Flux Pro 适配要点：**
- 支持自然语言长描述，可以写完整句子
- 对构图和光照描述响应良好
- 负向提示词通过参数传递而非提示词内

**DALL-E 3 适配要点：**
- 接受自然语言描述，不需要关键词堆砌
- 文字渲染需要明确用引号标注要渲染的文本
- 有较强的安全过滤，某些描述需要委婉表达

**Midjourney V6 适配要点：**
- 关键词式描述效果更好，避免过长句子
- 使用 `--ar` 指定宽高比，`--s` 指定风格化程度
- `--v 6` 指定版本，`--q` 指定质量等级
- 使用 `::` 进行权重分配

**Nova Canvas 适配要点：**
- 针对电商场景优化，强调产品描述准确性
- 支持背景替换和产品合成的专用参数
- 对商品属性（材质/光泽/透明度）的描述要精确

### Step 3: 质量增强技巧

- **权重强调**：对关键元素增加权重（不同模型语法不同）
- **细节锚定**：添加具体的细节描述提升真实感（如"morning dew on petals"）
- **负面排除精准化**：根据任务类型动态调整负向提示词
- **Seed锁定**：系列图保持风格一致时使用固定seed
- **ControlNet/IP-Adapter**：需要精确控制构图或风格时使用引导模型

### Step 4: 输出格式化

```json
{
  "prompt_id": "PRM-001",
  "target_model": "flux-pro",
  "positive_prompt": "A professional product photograph of a sleek wireless headphone in matte black, placed on a minimalist white marble surface, soft studio lighting from the left creating gentle shadows, shallow depth of field with bokeh background, ultra-high detail, 8K resolution, commercial photography style",
  "negative_prompt": "blurry, low quality, distorted, text, watermark, oversaturated, unrealistic reflections",
  "parameters": {
    "width": 1024,
    "height": 1024,
    "steps": 30,
    "cfg_scale": 7.0,
    "sampler": "euler",
    "seed": -1
  },
  "expected_outcome": "高端电子产品商拍风格，产品清晰锐利，背景简约有质感",
  "confidence": "high",
  "version": 1
}
```

## 输入规格

| 输入项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| creative_brief | object | 是 | 结构化创意需求 |
| target_model | string | 是 | 目标生成模型 |
| reference_images | array | 否 | 风格参考图 |
| historical_prompts | array | 否 | 同类型历史优质提示词 |
| failure_feedback | object | 否 | 上次生成失败的原因分析 |

## 输出规格

| 输出项 | 类型 | 说明 |
|--------|------|------|
| optimized_prompt | object | 完整提示词（正向+负向+参数） |
| confidence_level | enum | 置信度(high/medium/low) |
| risk_notes | array | 风险说明（如有） |
| alternative_versions | array | A/B测试备选版本（如适用） |

## 最佳实践

1. **英文提示词为主**：绝大多数模型对英文提示词的理解最准确
2. **关键词按重要性排序**：最重要的描述放最前面
3. **避免矛盾描述**：如同时写"close-up"和"full body"
4. **负向提示词不要过多**：通常10-15个关键词足够，过多可能产生反效果
5. **迭代而非重写**：在上一版基础上微调而非每次从头开始
6. **记录有效模式**：成功的提示词模式沉淀为模板库

## 常见陷阱

- 提示词过长导致模型注意力分散，核心元素被忽略
- 直接翻译中文描述到英文，未考虑模型理解的习惯用法
- 忽略模型版本差异（同一模型不同版本的提示词最佳实践不同）
- 负向提示词中写了想要的东西（双重否定反而会生成该元素）
- 过度依赖单一模板而不根据具体需求调整
