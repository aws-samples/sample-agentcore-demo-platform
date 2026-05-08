# 线索评分模型 (Lead Scoring Model)

## 技能概述

线索评分模型技能负责对潜在客户进行多维度价值评估，基于用户行为数据、对话信号和用户画像三大维度综合计算得分，输出ABCD四级评分结果。该技能是整个获客体系的"智能大脑"，通过量化评估将有限的销售资源精准配置到最高价值的潜在客户上。

## 适用场景

- 新线索入库时的初始评分
- 客户新行为触发后的实时评分更新
- 外呼通话结束后基于对话信号的评分调整
- 定期批量重评（针对长期无新交互的线索）
- 评分模型效果回溯分析

## 详细执行步骤

### 步骤1：数据采集与标准化
1. 从CRM/CDP系统接收客户多维度数据
2. 行为数据标准化：将原始行为转化为评分信号
   - 页面浏览：产品页(+5)、价格页(+8)、案例页(+6)、一般页(+1)
   - 表单提交：报价请求(+15)、试用申请(+12)、资料下载(+8)、普通注册(+3)
   - 邮件互动：打开(+2)、点击(+4)、回复(+10)
   - 频率权重：近7天行为×2.0，近30天×1.0，30天前×0.5
3. 对话信号量化：
   - 外呼意向标签：感兴趣(+20)、犹豫(+10)、拒绝(-10)、投诉(-20)
   - 在线咨询深度：询问价格(+15)、讨论方案(+12)、一般性咨询(+5)
4. 画像特征赋分：
   - 企业规模：大型(+10)、中型(+8)、小型(+5)、个人(+2)
   - 目标行业匹配：高度匹配(+10)、相关(+5)、不匹配(0)
   - 决策者级别：C-level(+15)、VP/Director(+10)、Manager(+5)、Staff(+2)

### 步骤2：综合评分计算
1. 将三个维度的原始分数加权汇总
   - 行为数据权重：40%
   - 对话信号权重：35%
   - 用户画像权重：25%
2. 应用衰减函数：距离最近一次互动越远，总分适当衰减
3. 应用负向信号惩罚：投诉(-30)、退订(-15)、明确拒绝(-20)
4. 分数映射到100分制

### 步骤3：等级划分与输出
- **A级（≥80分）**：高意向即将成交 → 触发1小时内CRM分配
- **B级（60-79分）**：有明确需求待培育 → 进入nurturing序列
- **C级（40-59分）**：初步兴趣需验证 → 安排外呼触达
- **D级（<40分）**：低意向或无效线索 → 进入低频维护池

### 步骤4：评分变更事件处理
1. 升级事件：C→B、B→A时立即触发对应流转动作
2. 降级事件：A→B需确认是否召回已分配的销售跟进
3. 评分历史记录：保存每次评分变更的时间戳和触发原因
4. 异常检测：单次评分变动>30分触发人工审核

## 输入规格

```json
{
  "customer_id": "string",
  "scoring_trigger": "new_lead|behavior_update|call_result|periodic_rescore",
  "behavior_data": {
    "page_views": [{"page_type": "string", "timestamp": "datetime", "duration_seconds": "number"}],
    "form_submissions": [{"form_type": "string", "timestamp": "datetime"}],
    "email_interactions": [{"action": "open|click|reply", "timestamp": "datetime"}],
    "content_downloads": [{"content_type": "string", "timestamp": "datetime"}]
  },
  "conversation_signals": {
    "outbound_call_intent": "interested|hesitant|rejected|complaint|null",
    "online_chat_depth": "price_inquiry|solution_discussion|general|null",
    "last_interaction_date": "datetime"
  },
  "profile_data": {
    "company_size": "enterprise|mid_market|small|individual",
    "industry": "string",
    "job_title": "string",
    "budget_range": "string (optional)"
  }
}
```

## 输出规格

```json
{
  "customer_id": "string",
  "total_score": "number (0-100)",
  "grade": "A|B|C|D",
  "previous_grade": "A|B|C|D|null",
  "grade_changed": "boolean",
  "dimension_scores": {
    "behavior_score": "number",
    "conversation_score": "number",
    "profile_score": "number"
  },
  "top_scoring_factors": [
    {"factor": "string", "contribution": "number"}
  ],
  "routing_action": {
    "action_type": "assign_to_crm|enter_nurturing|schedule_outbound|low_priority_pool",
    "priority": "urgent|high|medium|low",
    "sla_deadline": "datetime (for A-grade)"
  },
  "scoring_timestamp": "datetime",
  "next_rescore_trigger": "string - 建议下次重评条件"
}
```

## 最佳实践

1. **实时性与准确性平衡**：新行为触发时立即更新分数，但A级升级判定需至少2个维度同时达标
2. **避免单信号误判**：单次高分行为（如误点）不应直接升至A级，需交叉验证
3. **时间衰减合理性**：B2B场景决策周期长，衰减系数应比B2C更温和
4. **负向信号及时处理**：客户投诉后应立即降分并暂停所有自动触达
5. **模型透明度**：每次评分输出需附带主要得分因子说明，便于销售理解线索质量

## 约束条件

- 评分计算延迟≤5秒（实时触发场景）
- 批量重评支持10万+线索/小时的处理能力
- A级评分必须有至少2个维度贡献，防止单因子误判
- 评分历史保留≥12个月，支持模型回溯验证
- 评分模型参数调整需有变更记录和AB测试验证
