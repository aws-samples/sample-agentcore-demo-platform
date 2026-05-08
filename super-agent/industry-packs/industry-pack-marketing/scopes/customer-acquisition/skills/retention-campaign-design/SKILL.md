# 挽留活动设计 (Retention Campaign Design)

## 技能概述

挽留活动设计技能负责为不同分层的私域客户设计差异化的营销触达方案，包括内容策略、渠道选择、发送时机、优惠力度和AB测试方案。该技能将"客户应该被怎样触达"的策略思维转化为可执行的具体运营计划，是私域运营从粗放到精细化的关键能力。

## 适用场景

- 流失风险客户的专属挽留方案设计
- 沉默客户激活campaign设计
- 新客引导序列设计
- 活跃客户价值提升策略（交叉推荐/升级）
- 节日/大促的分层触达方案
- 客户回流后的重新培育计划

## 详细执行步骤

### 步骤1：目标客户群分析
1. 接收目标客户分层信息和触发原因
2. 分析目标群体特征：
   - 群体规模和价值分布
   - 历史响应率（不同渠道/内容类型）
   - 偏好标签（品类偏好、价格敏感度、渠道偏好）
   - 上次互动距今时长和场景
3. 确定campaign目标（挽回/激活/升级/复购）

### 步骤2：策略制定
根据客户分层和campaign目标制定四维策略：

**内容策略：**
- 流失挽回：高价值优惠（专属折扣≥20%）+ 情感连接（"我们想您了"）+ 新品/功能推荐
- 沉默激活：限时权益 + 个性化商品推荐（基于历史购买）+ 新内容引导
- 新客引导：首购礼 + 操作教程 + 社群邀请 + 会员权益说明
- 价值提升：VIP专属 + 交叉推荐（买了A的人也买了B）+ 积分翻倍活动

**渠道策略：**
- 高价值流失客户：企微1v1 > 电话关怀 > 短信
- 沉默客户：Push通知 > 公众号模板消息 > 短信
- 新客：公众号欢迎序列 > 小程序弹窗 > 短信
- 活跃客户：社群 > App Push > 小程序服务通知

**时机策略：**
- 最佳发送时段：10:00-11:00（阅读高峰）、20:00-21:00（晚间活跃）
- 序列间隔：首次触达后3天→7天→14天递增
- 避开：法定节假日前后、大型活动期间（避免信息淹没）

**力度策略：**
- 流失风险高+历史LTV高 → 最大力度（30%折扣/大额优惠券）
- 流失风险高+历史LTV中 → 中等力度（15%折扣）
- 沉默客户 → 小力度+趣味互动（积分小游戏/抽奖）
- 成本红线：单客挽留成本≤该客户3个月预期贡献

### 步骤3：AB测试方案设计
1. 确定测试变量（内容文案/优惠力度/发送时间/渠道选择）
2. 设计对照组和实验组（至少2组，建议3组）
3. 确定样本量和测试周期
4. 定义成功指标（打开率/点击率/转化率/ROI）
5. 设定统计显著性阈值（p<0.05）

### 步骤4：执行计划编排
1. 制定详细的执行时间线
2. 准备所需素材清单（文案/图片/落地页/优惠券）
3. 设置自动化触发规则
4. 配置效果追踪埋点
5. 设定中止条件（退订率>2%/投诉>0.1%时暂停）

## 输入规格

```json
{
  "campaign_trigger": "churn_warning|silent_activation|new_customer_onboarding|value_upgrade|seasonal_promotion",
  "target_segment": {
    "segment_type": "new|active|silent|churn_risk",
    "customer_count": "number",
    "avg_ltv": "number",
    "avg_silent_days": "number (if applicable)",
    "top_preferences": ["string"],
    "historical_response_rates": {
      "sms": "percentage",
      "push": "percentage",
      "email": "percentage",
      "wechat": "percentage"
    }
  },
  "campaign_objective": "reactivate|retain|upgrade|cross_sell|first_purchase",
  "budget_constraint": "number - 总预算",
  "timeline": {
    "start_date": "date",
    "end_date": "date"
  }
}
```

## 输出规格

```json
{
  "campaign_id": "string",
  "campaign_name": "string",
  "target_segment_size": "number",
  "strategy": {
    "content_plan": {
      "primary_message": "string",
      "supporting_content": ["string"],
      "cta": "string",
      "personalization_rules": ["string"]
    },
    "channel_sequence": [
      {
        "step": "number",
        "channel": "string",
        "timing": "string",
        "content_variant": "string"
      }
    ],
    "incentive": {
      "type": "discount|coupon|points|gift|trial",
      "value": "string",
      "expiry": "string",
      "conditions": "string"
    }
  },
  "ab_test_design": {
    "test_variable": "string",
    "variants": [
      {"name": "string", "description": "string", "traffic_allocation": "percentage"}
    ],
    "success_metrics": ["string"],
    "test_duration_days": "number",
    "minimum_sample_size": "number"
  },
  "execution_timeline": [
    {"date": "date", "action": "string", "responsible": "string"}
  ],
  "expected_outcomes": {
    "target_response_rate": "percentage",
    "target_conversion_rate": "percentage",
    "estimated_roi": "number",
    "estimated_cost_per_customer": "number"
  },
  "stop_conditions": ["string - 触发暂停的条件"]
}
```

## 最佳实践

1. **个性化优先**：同一campaign中不同客户看到的内容应基于其偏好差异化，而非一刀切
2. **渐进式触达**：先低成本渠道（Push/公众号），无响应再升级高成本渠道（短信/电话）
3. **控制频率**：单个客户每周接收营销触达不超过3次（含所有渠道总和）
4. **优惠递减法则**：首次触达给出中等力度优惠，仅对无响应客户追加更大力度
5. **闭环追踪**：每个campaign需追踪30天内的延迟转化效果，不仅看即时响应

## 约束条件

- 单客挽留成本不超过其3个月预期贡献值
- 短信触达频率≤2条/周/客户
- Push通知频率≤1次/天/客户
- 退订率>2%时必须暂停campaign
- 所有优惠券/折扣需有明确有效期和使用条件
- 合规要求：已退订客户不可再发送营销内容
