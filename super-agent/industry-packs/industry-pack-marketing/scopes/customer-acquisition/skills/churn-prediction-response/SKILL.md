# 流失预警响应 (Churn Prediction & Response)

## 技能概述

流失预警响应技能负责运行客户流失预测模型，提前7天识别高流失风险客户，并快速启动挽留流程。该技能将预测性分析与即时响应结合，从"客户已流失再挽回"的被动模式转变为"提前预判并干预"的主动模式，是提升客户留存率和LTV的关键防线。

## 适用场景

- 每日运行流失预测模型识别高风险客户
- 流失预警触发后24小时内的方案制定
- 48小时内的首次挽留触达执行
- 挽留效果追踪和策略调整
- 流失原因分析和预防策略优化

## 详细执行步骤

### 步骤1：流失风险预测
1. 每日凌晨运行流失预测模型，输入特征：
   - 活跃度变化趋势（近7天vs近30天vs近90天对比）
   - 购买频率衰减率
   - 互动深度下降（从浏览多品类→仅看少数→不浏览）
   - 退订/取关行为
   - 投诉/差评历史
   - 客服咨询频率变化（可能在寻求替代方案前最后咨询）
   - 优惠券/积分使用率下降
   - 竞品互动信号（如果可获取）
2. 输出每个客户的流失概率（0-100%）和预计流失时间
3. 流失概率>70%的客户标记为"高风险"

### 步骤2：风险分级与优先排序
1. 高风险客户按价值排序：
   - P0（最高优先）：高LTV + 高流失风险（历史消费Top 20%且流失概率>80%）
   - P1：高LTV + 中高流失风险 或 中LTV + 高流失风险
   - P2：中低LTV + 高流失风险
2. 每日P0客户数量控制在可操作范围内（建议≤50人/天）
3. 标注流失驱动因子TOP3（如：价格敏感+竞品吸引+服务体验下降）

### 步骤3：挽留方案快速制定（24小时内）
根据流失原因和客户特征制定个性化方案：

**价格敏感型流失：**
- 专属折扣券（比常规力度+10%以上）
- 会员等级保级/升级权益
- 消费返现方案

**体验不满型流失：**
- 1v1客服关怀电话
- 服务补偿（优先配送/延保/增值服务）
- 问题解决承诺+跟进

**竞品吸引型流失：**
- 竞品对比优势强调
- 独家权益/专属内容
- 迁移成本提醒（积分/等级/数据）

**自然衰退型流失：**
- 新品/新功能推荐（重新激发兴趣）
- 社群互动邀请
- 老客户专属活动

### 步骤4：挽留执行（48小时内首次触达）
1. 按照方案确定的渠道+内容+时机执行触达
2. P0客户：企微1v1 + 电话外呼（协调智能外呼Agent）
3. P1客户：定向Push + 短信 + 专属页面
4. P2客户：Push通知 + 公众号模板消息
5. 记录触达结果和客户响应

### 步骤5：效果追踪与策略迭代
1. 监控挽留后7天/14天/30天的客户行为
2. 定义挽回成功：触达后30天内产生新的购买或高频互动
3. 统计挽回成功率（按风险级别、流失原因、挽留策略分维度）
4. 识别高效策略和无效策略，优化后续方案模板
5. 回流客户重新进入活跃层运营

## 输入规格

```json
{
  "prediction_date": "date",
  "customer_features": [
    {
      "customer_id": "string",
      "ltv_total": "number",
      "ltv_last_90d": "number",
      "purchase_frequency_trend": "increasing|stable|decreasing|sharp_decline",
      "last_purchase_date": "date",
      "last_interaction_date": "date",
      "interaction_trend_7d_vs_30d": "number (ratio)",
      "unsubscribe_actions": "number",
      "complaint_count_90d": "number",
      "coupon_usage_rate_trend": "number",
      "membership_level": "string",
      "customer_tenure_months": "number"
    }
  ],
  "model_version": "string",
  "threshold_config": {
    "high_risk_threshold": "number (default: 70)",
    "prediction_horizon_days": "number (default: 7)"
  }
}
```

## 输出规格

```json
{
  "prediction_date": "date",
  "total_customers_analyzed": "number",
  "high_risk_customers": [
    {
      "customer_id": "string",
      "churn_probability": "percentage",
      "predicted_churn_date": "date",
      "priority_level": "P0|P1|P2",
      "ltv_at_risk": "number",
      "top_churn_drivers": [
        {"factor": "string", "impact_weight": "number"}
      ],
      "recommended_retention_strategy": {
        "strategy_type": "price|experience|competition|engagement",
        "channels": ["string"],
        "incentive_suggestion": "string",
        "urgency": "immediate|within_24h|within_48h"
      }
    }
  ],
  "summary_stats": {
    "total_high_risk": "number",
    "total_ltv_at_risk": "number",
    "p0_count": "number",
    "p1_count": "number",
    "p2_count": "number"
  },
  "retention_execution_plan": {
    "phone_outreach_list": ["customer_id - P0客户需电话关怀"],
    "digital_campaign_list": ["customer_id - P1/P2客户数字化触达"],
    "deadline_first_contact": "datetime"
  }
}
```

## 最佳实践

1. **提前量是关键**：7天预警窗口为黄金干预期，客户一旦实际流失（卸载/退会），挽回成本增加5-10倍
2. **高价值优先**：有限的挽留资源（尤其电话关怀）集中在P0客户，不要平均分配
3. **原因决定策略**：同样是高风险客户，因价格流失和因体验流失的挽留方式完全不同
4. **避免过度打扰**：一个客户的挽留触达不超过3次，3次无响应后降级为低频维护
5. **成本收益评估**：挽留一个客户的成本不超过其未来6个月预期贡献的30%

## 约束条件

- 流失预测模型每日运行，结果在当日9:00前输出
- 预警触发后24小时内必须完成方案制定
- 48小时内必须执行首次触达
- P0客户挽留成功率目标>25%
- 整体模型预测准确率（AUC）目标>0.75
- 挽留触达总次数≤3次/客户/预警周期
- 已成功挽回的客户30天内不再进入预警池
