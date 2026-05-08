# 评分模型验证 (Scoring Model Validation)

## 技能概述

评分模型验证技能负责定期评估线索评分模型的准确性和健康度，通过对比预测评分与实际转化结果来发现模型漂移，并在偏差超过阈值时触发模型调优流程。该技能确保评分系统持续保持高精度，防止因市场变化、客户行为变化或数据分布偏移导致的评分失准。

## 适用场景

- 每两周定期模型准确率统计
- 检测到转化率异常波动时的紧急验证
- 新数据源接入后的模型影响评估
- 模型调优后的效果对比验证
- 月度模型健康度报告生成

## 详细执行步骤

### 步骤1：验证数据准备
1. 提取验证周期内（默认14天）的所有已评分线索
2. 关联实际转化结果数据（是否成交、成交金额、转化周期）
3. 按评分级别分组统计：
   - A级线索数量 & 实际转化数
   - B级线索数量 & 实际转化数
   - C级线索数量 & 实际转化数
   - D级线索数量 & 实际转化数
4. 计算各级别的实际转化率

### 步骤2：准确率计算与对标
1. **A级准确率**：A级线索实际转化率（目标>30%）
2. **D级准确率**：D级线索实际转化率（目标<5%）
3. **排序精度**：A级转化率 >> B级 >> C级 >> D级（级差检验）
4. **覆盖率**：A级线索占全部成交客户的比例（目标>50%）
5. 计算综合AUC分数

### 步骤3：漂移检测
1. 与上一个验证周期对比各指标变化
2. 偏差判定规则：
   - A级转化率偏差>10% → 触发模型调优
   - D级转化率偏差>10% → 触发模型调优
   - AUC下降>5% → 触发模型调优
   - 各级别分布比例异常变化>20% → 触发特征分析
3. 分析漂移原因假设：
   - 市场环境变化（节假日、行业事件）
   - 数据源质量变化（新渠道线索特征不同）
   - 用户行为模式变化（季节性波动）
   - 评分阈值不再适配当前分布

### 步骤4：调优建议生成
1. 基于漂移分析生成调优方向建议：
   - 特征权重调整（哪些特征的预测力下降了）
   - 阈值调整（分级边界是否需要移动）
   - 新特征引入（是否有新的强预测信号）
   - 数据清洗（是否有脏数据影响模型表现）
2. 生成AB测试方案：新旧模型并行跑一周对比
3. 输出模型健康度报告

### 步骤5：验证报告生成
1. 汇总所有指标形成结构化报告
2. 标注关键发现和风险提示
3. 生成趋势图数据（连续多期对比）
4. 输出具体可执行的优化建议

## 输入规格

```json
{
  "validation_period": {
    "start_date": "date",
    "end_date": "date"
  },
  "scored_leads": [
    {
      "customer_id": "string",
      "score_at_grading": "number",
      "grade_at_grading": "A|B|C|D",
      "scoring_date": "datetime"
    }
  ],
  "conversion_results": [
    {
      "customer_id": "string",
      "converted": "boolean",
      "conversion_date": "datetime (if converted)",
      "deal_value": "number (if converted)",
      "conversion_cycle_days": "number"
    }
  ],
  "previous_validation_results": "object (上一周期的验证结果，用于趋势对比)"
}
```

## 输出规格

```json
{
  "validation_id": "string",
  "validation_period": "string",
  "accuracy_metrics": {
    "a_grade_conversion_rate": "percentage",
    "b_grade_conversion_rate": "percentage",
    "c_grade_conversion_rate": "percentage",
    "d_grade_conversion_rate": "percentage",
    "auc_score": "number (0-1)",
    "coverage_rate": "percentage - A级占全部成交的比例"
  },
  "drift_detection": {
    "drift_detected": "boolean",
    "drift_severity": "none|mild|moderate|severe",
    "drifted_metrics": ["string"],
    "hypothesized_causes": ["string"]
  },
  "comparison_with_previous": {
    "a_conversion_change": "number (百分点变化)",
    "d_conversion_change": "number",
    "auc_change": "number"
  },
  "recommendations": {
    "tuning_needed": "boolean",
    "priority": "urgent|normal|low",
    "suggested_actions": [
      {
        "action": "string",
        "rationale": "string",
        "expected_impact": "string"
      }
    ],
    "ab_test_proposal": "object (if tuning recommended)"
  },
  "grade_distribution": {
    "A": "percentage",
    "B": "percentage",
    "C": "percentage",
    "D": "percentage"
  },
  "report_generated_at": "datetime"
}
```

## 最佳实践

1. **充分转化周期**：验证时需考虑B2B的长转化周期（30-90天），不宜在线索进入后过早下结论
2. **样本量保证**：单次验证中各级别样本量需>50条，否则统计结果不可靠
3. **排除异常值**：超大单/特殊渠道等异常样本单独分析，不应影响模型整体评估
4. **持续追踪趋势**：单期偏差可能是波动，连续3期偏差才确认为真正漂移
5. **调优谨慎性**：模型调整后需AB测试至少1周确认效果，不可直接全量切换

## 约束条件

- 验证周期固定为每两周一次，不可跳过
- 模型调优需有完整的变更记录和回滚方案
- AB测试期间两个模型需同时运行且流量分配合理（建议70/30）
- 验证报告需保存至少12个月供审计
- 重大模型变更（AUC变动>10%）需人工审批后方可上线
