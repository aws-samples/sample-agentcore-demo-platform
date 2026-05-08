# A/B测试设计与评估 (A/B Test Design & Evaluation)

## 概述
A/B测试设计与评估是策略调优Agent验证风控参数调整效果的科学方法论技能。通过严谨的实验设计、样本分流、效果观测和统计检验，确保每一次策略变更都有可靠的数据支撑，避免"凭直觉调参"带来的风险。

## 适用场景
- 风险阈值调整的效果验证（如免验阈值从30调至35）
- 新规则上线前的灰度验证
- 验证策略变更的增量效果评估（如新增人脸识别对通过率的影响）
- 模型版本切换的对比评估
- 不同验证方式的转化率对比

## 执行步骤

### 步骤1：实验设计
- **明确实验假设**：
  - H0（原假设）：新策略与旧策略无显著差异
  - H1（备选假设）：新策略在目标指标上优于旧策略
- **确定评估指标**：
  - 主要指标（Primary Metric）：实验的核心目标（如欺诈率）
  - 次要指标（Secondary Metrics）：需监控的附带影响（如通过率、放弃率）
  - 护栏指标（Guardrail Metrics）：不可恶化的底线指标
- **样本量计算**：
  - 基于期望检测到的最小效应量（MDE）
  - 设定显著性水平α=0.05和统计功效β=0.80
  - 计算所需最小样本量
- **分流策略**：
  - 确定分流维度（客户维度/交易维度）
  - 确保对照组和实验组在关键特征上均衡
  - 避免溢出效应（Spillover Effect）

### 步骤2：实验执行与监控
- 按设计配置实验参数并启动分流
- 设定观察期（最短72小时，推荐7天以覆盖周末效应）
- 实时监控护栏指标：
  - 如护栏指标恶化超过阈值，自动停止实验
  - 如出现严重安全事件，立即回滚
- 记录实验期间的外部干扰因素（如大促、系统变更）

### 步骤3：结果统计与分析
- 实验结束后进行统计检验：
  - 计算各指标的实验组vs对照组差异
  - 执行假设检验（Z检验/T检验/卡方检验）
  - 计算p值和置信区间
  - 判断是否达到统计显著性（p<0.05）
- 细分维度分析：
  - 不同客群的效果差异
  - 不同渠道的效果差异
  - 是否存在辛普森悖论
- 实际效果评估：
  - 统计显著 ≠ 业务显著，评估实际影响大小
  - 计算ROI（预期收益 vs 实施成本）

### 步骤4：结论输出与决策建议
- 生成实验报告：
  - 实验目标和设计参数
  - 样本量和实验时长
  - 各指标结果（含置信区间）
  - 细分维度分析结果
  - 明确的决策建议（全量推广/继续观察/放弃/调整后重试）
- 全量推广建议需包含：
  - 预期全量效果（基于实验结果外推）
  - 推广风险评估
  - 回滚预案

## 输入规格
```json
{
  "experiment_phase": "string - DESIGN/EXECUTE/ANALYZE/REPORT",
  "hypothesis": "string - 实验假设描述",
  "treatment": "object - 实验组策略配置",
  "control": "object - 对照组策略配置",
  "primary_metric": "string - 主要评估指标",
  "secondary_metrics": "array - 次要指标",
  "guardrail_metrics": "array - 护栏指标",
  "min_duration_hours": "number - 最短观察期(默认72)",
  "traffic_split": "number - 实验组流量比例(默认5%)"
}
```

## 输出规格
```json
{
  "experiment_id": "string",
  "status": "string - DESIGNED/RUNNING/COMPLETED/STOPPED",
  "duration": "string - 实验持续时间",
  "sample_size": {"treatment": "number", "control": "number"},
  "results": {
    "primary_metric": {
      "treatment_value": "number",
      "control_value": "number",
      "relative_change": "number - 相对变化百分比",
      "p_value": "number",
      "confidence_interval": "array - [lower, upper]",
      "significant": "boolean"
    },
    "secondary_metrics": "array - 同样结构",
    "guardrail_check": "string - PASS/FAIL"
  },
  "recommendation": "string - ROLLOUT/CONTINUE/ABANDON/ITERATE",
  "recommendation_rationale": "string"
}
```

## 最佳实践
- 每次只测试一个变量，避免多因素混淆
- 灰度比例初始建议5%，确认安全后可逐步扩大（5%→20%→50%→100%）
- 观察期应覆盖完整的业务周期（至少包含工作日和周末）
- 实验结论应包含"不建议推广"的勇气——数据不支持就不做

## 约束条件
- A/B测试最短观察期72小时，不得提前下结论
- 护栏指标恶化超阈值时必须自动停止实验
- 统计结论必须达到95%置信水平
- 实验设计和结果需留存归档，支持事后审计
