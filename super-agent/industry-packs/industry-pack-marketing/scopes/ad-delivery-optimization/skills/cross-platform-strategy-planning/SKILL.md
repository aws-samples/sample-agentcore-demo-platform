# 跨平台投放策略制定 (Cross-Platform Strategy Planning)

## 技能概述

该技能用于制定跨多个广告平台（Google Ads、Meta Ads、TikTok Ads、Amazon Ads等）的统一投放策略。根据营销目标类型（品牌曝光/线索获取/电商转化）、总预算规模、行业特性和历史效果数据，输出科学的平台组合方案、预算分配比例和出价策略基线。

## 适用场景

- 新Campaign启动时的全局投放规划
- 季度/月度营销计划的跨渠道预算分配
- 营销目标变更时的策略调整（如从品牌曝光转向效果转化）
- 新平台接入评估和测试预算规划

## 执行步骤

### Step 1: 营销目标解析
- 确认营销目标类型：品牌曝光（以CPM/Reach为核心）、线索获取（以CPL/表单提交为核心）、电商转化（以ROAS/CPA为核心）
- 明确KPI指标和目标值（如ROAS>3:1、CPA<50元）
- 确认投放周期、总预算和日预算上限
- 了解行业限制（医疗/金融类特殊政策）

### Step 2: 平台选择与组合
- 评估各平台对当前营销目标的适配度
  - Google Ads：高意图搜索流量，适合线索获取和电商转化
  - Meta Ads：强社交属性，适合品牌曝光和兴趣人群转化
  - TikTok Ads：年轻用户+短视频场景，适合品牌种草和冲动消费品
  - Amazon Ads：购物意图明确，适合电商直接转化
- 根据目标受众在各平台的分布确定平台组合
- 考虑各平台最低预算要求和起量门槛

### Step 3: 预算分配方案
- 基于历史ROAS数据确定各平台预算比例
- 新平台/新策略预留5-10%测试预算
- 设置预算安全余量（总预算的5%作为应急调配池）
- 输出每日各平台预算分配表

### Step 4: 出价策略设计
- 选择出价模式：
  - 目标CPA（适合稳定转化目标）
  - 目标ROAS（适合电商收益优化）
  - 最大化转化量（适合起量阶段，需设CPA上限）
  - 手动CPC（适合精细控制的搜索广告）
- 设定各平台的出价基线（参考行业均值×系数）
- 定义出价调整的边界条件（单次调幅≤20%）

### Step 5: 策略文档输出
- 生成完整投放策略方案（含平台、预算、出价、受众框架）
- 附带风险评估和应急预案
- 设定效果评估时间节点（学习期3天→首次优化→周度回顾）

## 输入规格

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| marketing_objective | string | 是 | 营销目标类型（brand_awareness/lead_generation/ecommerce_conversion） |
| total_budget | number | 是 | 总预算金额（元） |
| campaign_duration | string | 是 | 投放周期（起止日期） |
| target_kpi | object | 是 | 目标KPI（如{roas: 3, cpa: 50}） |
| industry | string | 是 | 行业类别 |
| historical_data | object | 否 | 历史投放效果数据 |
| platform_preferences | array | 否 | 平台偏好或限制 |

## 输出规格

```json
{
  "strategy_name": "策略名称",
  "platform_mix": [
    {"platform": "Google Ads", "budget_ratio": 0.35, "objective": "搜索转化", "bid_strategy": "target_cpa"},
    {"platform": "Meta Ads", "budget_ratio": 0.30, "objective": "兴趣转化", "bid_strategy": "target_roas"}
  ],
  "daily_budget_allocation": {...},
  "bid_baselines": {...},
  "risk_assessment": "...",
  "evaluation_milestones": [...]
}
```

## 最佳实践

1. **不要平均分配**：预算分配应基于数据，而非拍脑袋平分
2. **预留测试预算**：始终保留5-10%用于新渠道/新策略测试
3. **尊重学习期**：新计划前3天不频繁调整，给平台算法探索空间
4. **考虑季节性**：大促/节假日前需提前2周调整策略和预算
5. **避免过度集中**：单一平台占比不超过60%，分散风险

## 约束条件

- 单次出价调幅不超过20%
- 新计划学习期（3天）内不做大幅调整
- 医疗/金融类广告需确认平台审核政策后再制定策略
- 平台API调用频率需在限额范围内
- 预算分配需考虑各平台最低日预算门槛
