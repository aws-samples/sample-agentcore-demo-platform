# 客户生命周期分层 (Customer Lifecycle Segmentation)

## 技能概述

客户生命周期分层技能负责将私域客户池中的所有客户按照生命周期阶段进行动态分类，基于客户行为数据（购买频率、互动活跃度、最近一次互动时间等）实时计算客户所处的生命周期阶段，并监控客户在各层之间的流动趋势。该技能是私域精细化运营的基础，为差异化触达策略提供目标人群定义。

## 适用场景

- 新转化客户入池时的初始分层
- 定期（每日）客户池全量重新分层
- 客户行为触发实时分层更新
- 月度客户池健康度分析（各层占比及趋势）
- 流失预警模型输入数据准备

## 详细执行步骤

### 步骤1：客户数据采集
1. 汇总客户多维度行为数据：
   - 购买记录：最近购买日期(Recency)、购买频次(Frequency)、购买金额(Monetary)
   - 互动数据：App/小程序打开、公众号阅读、社群发言、客服咨询
   - 渠道偏好：主要互动渠道（微信/App/邮件/短信）
   - 会员状态：等级、积分、权益使用情况
2. 计算RFM关键指标

### 步骤2：分层规则计算
基于RFM模型和业务规则，将客户分为四个核心层级：

**新客层（New Customer）：**
- 定义：首次购买≤30天
- 特征：画像不完整、偏好未明确、尚未形成复购习惯
- 关键指标：首购完成率、注册完整度、引导路径完成率

**活跃层（Active Customer）：**
- 定义：近30天有购买或近7天有高频互动（≥3次/周）
- 特征：高价值贡献、品牌认同度高、有复购习惯
- 关键指标：客单价、复购间隔、交叉购买率

**沉默层（Silent Customer）：**
- 定义：30-60天无购买且近14天无互动
- 特征：兴趣下降、对推送无响应、可能被竞品吸引
- 关键指标：沉默天数、最后一次互动渠道、历史LTV

**流失风险层（Churn Risk Customer）：**
- 定义：>60天无购买且>30天无任何互动，或流失预测模型输出高风险
- 特征：完全不活跃、退订行为、历史高价值但急剧下降
- 关键指标：流失风险评分、预计流失时间、挽回成功概率

### 步骤3：分层动态更新
1. 实时触发更新：购买事件、App活跃事件、退订事件
2. 每日批量更新：全量客户重新计算分层
3. 层间流动记录：新客→活跃、活跃→沉默、沉默→流失风险、任意层→活跃（回流）
4. 异常检测：大批量客户同时降级（可能是系统问题或活动结束效应）

### 步骤4：分层报告输出
1. 各层客户数量和占比
2. 层间流动Sankey图数据
3. 各层核心指标均值和趋势
4. 预警信号：流失风险层增长过快、新客转活跃率下降等
5. 与上期对比变化分析

## 输入规格

```json
{
  "segmentation_trigger": "scheduled_daily|event_triggered|manual_request",
  "customer_data": [
    {
      "customer_id": "string",
      "first_purchase_date": "date",
      "last_purchase_date": "date",
      "purchase_count_30d": "number",
      "purchase_amount_total": "number",
      "last_interaction_date": "date",
      "interaction_count_7d": "number",
      "interaction_count_30d": "number",
      "channels_used": ["string"],
      "membership_level": "string",
      "unsubscribed": "boolean"
    }
  ],
  "current_segments": "object - 当前分层状态（用于对比）",
  "business_rules_override": "object (optional) - 特殊分层规则覆盖"
}
```

## 输出规格

```json
{
  "segmentation_date": "datetime",
  "total_customers": "number",
  "segments": {
    "new_customer": {
      "count": "number",
      "percentage": "percentage",
      "avg_days_since_first_purchase": "number",
      "customer_ids": ["string"]
    },
    "active": {
      "count": "number",
      "percentage": "percentage",
      "avg_purchase_frequency": "number",
      "avg_ltv": "number",
      "customer_ids": ["string"]
    },
    "silent": {
      "count": "number",
      "percentage": "percentage",
      "avg_silent_days": "number",
      "customer_ids": ["string"]
    },
    "churn_risk": {
      "count": "number",
      "percentage": "percentage",
      "avg_risk_score": "number",
      "customer_ids": ["string"]
    }
  },
  "transitions": {
    "new_to_active": "number",
    "active_to_silent": "number",
    "silent_to_churn_risk": "number",
    "reactivated": "number (任意→活跃)"
  },
  "alerts": ["string - 需要关注的异常趋势"]
}
```

## 最佳实践

1. **分层不是标签**：分层是动态的，需要每日更新而非贴一次永久标签
2. **业务语境适配**：不同行业的沉默定义不同（快消品7天不买可能就算沉默，B2B可能3个月才算）
3. **避免分层过细**：4个核心层已经足够驱动差异化策略，过多分层会增加运营复杂度
4. **关注层间流动**：健康的客户池应该是"新客→活跃"流动大于"活跃→沉默"流动
5. **数据完整性**：分层质量依赖于数据采集的完整性，缺少数据的客户应标记为"待补充"

## 约束条件

- 每日批量分层在凌晨2:00-5:00执行，不影响日间系统性能
- 实时触发更新延迟≤1分钟
- 分层历史数据保留≥12个月
- 客户隐私信息（手机号/地址）在分层过程中仅使用脱敏ID
- 分层结果需支持按渠道、地域、会员等级等维度交叉筛选
