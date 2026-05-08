# 通话摘要生成 (Call Summary Generation)

## 技能概述

通话摘要生成技能负责在每通外呼结束后，自动从通话记录中提取关键信息，生成结构化的通话摘要报告。摘要需涵盖客户意向评级、核心需求点、异议点、情感评分和建议下一步动作，为线索评分更新和后续跟进提供数据支撑。

## 适用场景

- 每通外呼完成后自动生成通话记录摘要
- 批量外呼任务完成后生成整体执行报告
- 客户历史通话记录的结构化整理
- 为线索评分Agent提供对话信号输入

## 详细执行步骤

### 步骤1：通话内容结构化解析
1. 接收完整通话转写文本
2. 识别对话阶段划分（开场→需求探测→产品介绍→意向确认→收尾）
3. 提取客户发言中的关键信息片段
4. 标注话术执行的完整性（是否按流程走完所有关键环节）

### 步骤2：关键信息提取
1. **客户需求点**：从客户描述中提取明确需求（"我们需要XX功能"）和隐含需求（"现在的系统太慢了"→性能需求）
2. **异议和顾虑**：提取客户表达的担忧（价格、实施周期、效果保障等）
3. **竞品提及**：记录客户提到的竞品名称和对比维度
4. **决策链信息**：识别决策者角色、决策流程、预算周期等关键商务信号
5. **时间线索**：客户提及的时间节点（"下个季度"、"月底前"）

### 步骤3：意向评级输出
基于对话内容综合判断，输出四级意向标签：
- **A-高意向**：明确表达购买意愿、询问合同/付款方式、主动约见面
- **B-中高意向**：表达需求认可、请求方案/报价、计划内部讨论
- **C-中低意向**：有初步兴趣但无明确时间表、需要进一步了解
- **D-低/无意向**：明确拒绝、完全无需求、要求不再联系

### 步骤4：下一步行动建议生成
根据通话结果和客户状态，输出具体的跟进建议：
- 建议跟进时间（基于客户提及的时间线索）
- 建议跟进方式（电话/邮件/微信/面访）
- 建议跟进内容（针对性方案/报价/案例/试用）
- 升级建议（是否需要更高级别销售介入）

## 输入规格

```json
{
  "call_id": "string",
  "customer_id": "string",
  "call_transcript": "string - 完整通话转写文本",
  "call_duration_seconds": "number",
  "call_start_time": "datetime",
  "call_end_time": "datetime",
  "script_template_used": "string",
  "agent_notes": "string (optional) - 外呼执行中的实时标注"
}
```

## 输出规格

```json
{
  "call_id": "string",
  "customer_id": "string",
  "duration_seconds": "number",
  "intent_grade": "A|B|C|D",
  "sentiment_score": "number (1-10, 10为最积极)",
  "key_needs": [
    {
      "need_description": "string",
      "urgency": "high|medium|low",
      "explicit": "boolean - 显式需求还是隐含需求"
    }
  ],
  "objections": [
    {
      "objection_type": "price|timing|competition|authority|need",
      "detail": "string",
      "addressed": "boolean - 是否在通话中已解决"
    }
  ],
  "competitor_mentions": ["string"],
  "decision_chain_info": {
    "decision_maker": "string (if identified)",
    "budget_cycle": "string (if mentioned)",
    "timeline": "string (if mentioned)"
  },
  "next_action": {
    "recommended_action": "string",
    "follow_up_time": "datetime",
    "follow_up_channel": "phone|email|wechat|meeting",
    "content_suggestion": "string",
    "escalation_needed": "boolean"
  },
  "summary_text": "string - 50字以内的纯文本摘要"
}
```

## 最佳实践

1. **客观性**：摘要应基于客户实际表述，不加入主观推测；区分"客户说的"和"推断的"
2. **可操作性**：下一步建议必须具体到时间、方式、内容，而非泛泛的"继续跟进"
3. **信号完整性**：即使通话很短或客户快速拒绝，也要提取可用信号（拒绝原因本身是有价值的信息）
4. **时效性**：摘要应在通话结束后10秒内生成，确保实时性
5. **一致性**：同一客户多次通话的摘要格式一致，便于纵向对比分析意向变化趋势

## 约束条件

- 摘要生成延迟≤10秒
- 关键信息提取准确率≥90%
- 不得在摘要中包含客户敏感个人信息（如身份证号、银行卡号）
- 摘要保存期限与通话录音一致（≥6个月）
- 需支持中英文混合对话的摘要生成
