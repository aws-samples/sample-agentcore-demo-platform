# 质量趋势分析（Quality Trend Analysis）

## 技能概述

本技能负责对历史质量评估数据进行统计分析，识别质量趋势变化、定位系统性问题根因，并输出数据驱动的优化建议。是持续改进质量闭环的关键分析能力，确保系统质量水平不断提升而非停滞或退化。

## 适用场景

- 每日/每周质量汇总报告输出
- 周均质量分低于7.5时的深度分析
- 新模型/新模板上线后的效果跟踪
- 异常质量波动的根因定位
- 季度性流程复盘的数据支撑

## 执行步骤

### Step 1: 数据聚合与统计

按以下维度聚合质量数据：

```json
{
  "period": "2024-01-01 ~ 2024-01-07",
  "summary": {
    "total_assessed": 1250,
    "pass_rate": 0.78,
    "first_pass_rate": 0.72,
    "avg_technical_score": 7.8,
    "avg_creative_score": 7.3,
    "avg_composite_score": 7.5,
    "safety_reject_count": 3,
    "human_escalation_count": 15,
    "regeneration_count": 280
  },
  "by_model": {
    "flux-pro": { "count": 500, "avg_score": 7.9, "pass_rate": 0.82 },
    "dall-e-3": { "count": 300, "avg_score": 7.4, "pass_rate": 0.75 },
    "midjourney-v6": { "count": 250, "avg_score": 7.6, "pass_rate": 0.78 },
    "nova-canvas": { "count": 200, "avg_score": 7.3, "pass_rate": 0.71 }
  },
  "by_task_type": {
    "product_photo": { "count": 600, "avg_score": 7.7 },
    "marketing_poster": { "count": 300, "avg_score": 7.2 },
    "virtual_tryon": { "count": 150, "avg_score": 6.9 },
    "social_media": { "count": 200, "avg_score": 7.8 }
  }
}
```

### Step 2: 趋势识别

分析关键指标的时间序列变化：
- **整体质量分趋势**：是上升/稳定/下降？
- **首次通过率变化**：提示词优化是否有效果？
- **模型间质量差异**：哪个模型质量在提升/下降？
- **任务类型质量差异**：哪类任务是质量短板？
- **重生成成功率**：重生成是否有效改善质量？

告警阈值：
- 周均质量分 < 7.5 → 触发流程复盘
- 首次通过率连续3天 < 65% → 提示词模板需审视
- 某模型通过率突降10% → 检查模型服务是否有变更
- 人工介入率 > 15% → 系统能力需要升级

### Step 3: 失败模式分析

对不通过的素材进行失败原因分类：

| 失败类别 | 占比 | 典型表现 | 根因 |
|----------|------|----------|------|
| AI伪影 | 35% | 手指变形/面部扭曲 | 提示词缺少负向约束 |
| 风格偏差 | 25% | 与需求风格不匹配 | 风格锚定词不够精准 |
| 构图问题 | 20% | 主体截断/比例失调 | 构图指导不足 |
| 色彩异常 | 10% | 色偏/过饱和 | 未指定色彩约束 |
| 内容缺失 | 10% | 缺少要求的元素 | 需求理解偏差 |

### Step 4: 优化建议输出

```json
{
  "analysis_period": "2024-W01",
  "key_findings": [
    "虚拟试穿任务通过率(65%)显著低于整体(78%)，主要失败原因是人物一致性不达标",
    "Nova Canvas在商品图场景的质量分(7.3)低于Flux Pro(7.9)，建议高质量商品图优先使用Flux",
    "周三的批次失败率异常高(35%)，经排查为Flux API临时故障导致大量超时"
  ],
  "recommendations": [
    {
      "priority": "P0",
      "action": "虚拟试穿任务增加面部一致性ControlNet引导",
      "expected_impact": "通过率提升10-15%",
      "owner": "prompt-engineer"
    },
    {
      "priority": "P1",
      "action": "更新模型路由规则：商品图场景首选模型从Nova Canvas调整为Flux Pro",
      "expected_impact": "商品图质量分提升0.5",
      "owner": "creative-planner"
    },
    {
      "priority": "P2",
      "action": "提示词模板库增加'人物手部'专项负向提示词",
      "expected_impact": "AI伪影类失败减少20%",
      "owner": "prompt-engineer"
    }
  ],
  "next_review_date": "2024-01-14"
}
```

### Step 5: 知识沉淀

- 成功模式归档：哪些改进措施验证有效
- 失败教训记录：哪些尝试没有效果或产生了负面影响
- 基线更新：质量基线随系统能力提升而动态调整

## 输入规格

| 输入项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| assessment_data | array | 是 | 评估记录数据集 |
| time_range | object | 是 | 分析时间范围 |
| comparison_baseline | object | 否 | 对比基线（如上周数据） |
| focus_dimensions | array | 否 | 重点关注维度 |

## 输出规格

| 输出项 | 类型 | 说明 |
|--------|------|------|
| trend_report | object | 趋势分析报告 |
| anomaly_alerts | array | 异常告警列表 |
| optimization_recommendations | array | 优化建议 |
| baseline_update | object | 基线更新建议 |

## 最佳实践

1. **数据驱动决策**：所有优化建议必须有数据支撑，不凭感觉
2. **控制变量分析**：同时有多个变更时，分离各因素的影响
3. **短期+长期视角**：既关注日常波动，也跟踪月度/季度趋势
4. **闭环验证**：每个优化建议实施后需跟踪验证效果
5. **定期基线校准**：随着系统能力提升，质量基线也应适当提高

## 常见陷阱

- 数据量不足时轻易下结论（某模型只跑了5张就判定"质量差"）
- 忽略了外部因素（模型服务方更新/节假日需求特征变化）
- 过度优化单一指标而忽略全局（提升通过率但增加了成本）
- 只看平均值不看分布（平均7.5但方差很大说明稳定性差）
- 建议过于笼统无法执行（"提升质量"→应该具体到"在X模型的Y场景增加Z类负向提示词"）
