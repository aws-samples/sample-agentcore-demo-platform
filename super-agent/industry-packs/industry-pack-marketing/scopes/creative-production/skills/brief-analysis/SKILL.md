# 创意Brief解析与需求拆解

## 技能概述
本技能用于接收和解析客户或营销团队提交的创意需求Brief，验证其完整性，并将其拆解为可执行的素材生产任务清单。这是创意生产流程的起点，直接决定后续所有素材的方向和质量。

## 适用场景
- 收到新的创意需求Brief时
- 需要验证Brief信息完整性时
- 将大型批量需求拆解为可并行执行的子任务时
- 需要明确创意方向和风格指引时

## 执行步骤

### Step 1: Brief完整性验证
检查Brief是否包含以下必要信息：
- **品牌指南**：Logo文件、品牌色彩体系（主色/辅色/禁用色）、授权字体列表、品牌调性关键词
- **受众画像**：目标人群特征（年龄/性别/地域/兴趣）、消费场景、痛点与需求
- **渠道规格**：目标投放平台、广告位类型、尺寸要求列表
- **语言要求**：目标市场语言列表、是否需要文化适配
- **数量与优先级**：素材总数量、变体数量、交付时间要求

### Step 2: 缺失信息处理
- 标记所有缺失字段
- 在30分钟内反馈补充请求，附带缺失信息的影响说明
- 对可推断信息给出默认值建议（标注"建议确认"）

### Step 3: 任务拆解与分配
将Brief拆解为结构化任务清单：
```json
{
  "brief_id": "BR-20240101-001",
  "tasks": [
    {
      "task_id": "T-001",
      "task_type": "visual_generation | content_writing | layout_composition",
      "priority": "P0 | P1 | P2 | P3",
      "assigned_agent": "visual-generation | content-editor",
      "style_guide": {},
      "dimensions": ["1080x1080", "1200x628"],
      "language_list": ["zh-CN", "en-US"],
      "variant_count": 3,
      "deadline": "2024-01-02T18:00:00Z"
    }
  ]
}
```

### Step 4: 批次规划
- 按优先级和依赖关系规划执行批次
- 无依赖任务设置为并行执行
- 图文合成任务依赖视觉和文案两者完成

## 输入规格
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| brand_guidelines | Object | ✓ | 品牌指南（logo/色彩/字体） |
| audience_profile | Object | ✓ | 目标受众画像 |
| channel_specs | Array | ✓ | 渠道规格列表 |
| language_requirements | Array | ✓ | 语言列表 |
| quantity | Object | ✓ | 数量要求 |
| reference_materials | Array | × | 参考素材 |

## 输出规格
| 字段 | 类型 | 说明 |
|------|------|------|
| brief_validation_result | Object | 完整性验证结果 |
| task_list | Array | 结构化任务清单 |
| batch_plan | Object | 批次执行计划 |
| style_direction | Object | 创意风格方向指引 |
| estimated_timeline | String | 预估完成时间 |

## 最佳实践
1. 宁可多问也不假设——模糊的Brief会导致大量返工
2. 每个任务的style_guide必须足够具体，避免歧义
3. 优先级设定考虑投放时间紧迫度和商业价值
4. 批量任务控制单批次不超过50个素材，避免队列拥堵
5. 为每个任务预留10%的buffer时间应对质量不合格重做

## 约束与限制
- Brief缺失关键信息时不得自行假设并开始生产
- 单次拆解的任务总数不超过500个
- 每个子任务必须是可独立评估质量的最小单元
