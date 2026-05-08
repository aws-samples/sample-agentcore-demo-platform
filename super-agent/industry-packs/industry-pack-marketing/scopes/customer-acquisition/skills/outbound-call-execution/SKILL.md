# 智能外呼执行 (Outbound Call Execution)

## 技能概述

智能外呼执行技能负责管理和执行自动化电话外呼的全流程，包括外呼任务调度、拨打执行、话术模板匹配、重呼策略管理和通话质量监控。该技能是用户获客体系中规模化触达客户的核心执行能力，支持日处理10000+通话的高并发场景。

## 适用场景

- 新线索批量外呼触达（B/C级线索意向验证）
- 活动邀约和促销通知电话
- 流失客户挽留外呼
- 老客户回访和满意度调查
- 预约确认和提醒通话

## 详细执行步骤

### 步骤1：外呼任务初始化
1. 接收外呼名单（含客户ID、电话号码、线索等级、历史交互记录）
2. 验证名单数据有效性（号码格式校验、黑名单过滤、DNC列表排除）
3. 根据线索优先级排序（B级优先于C级，高活跃度优先于低活跃度）
4. 匹配话术模板（根据外呼目的选择：初筛话术/深度沟通话术/挽留话术）

### 步骤2：拨打执行
1. 按照时间窗口规则发起呼叫（工作日9:00-12:00, 14:00-18:00, 19:00-21:00）
2. 呼叫接通后播放开场白，等待客户响应
3. 根据客户回复进入对应话术分支
4. 执行多轮对话（需求探测→产品介绍→意向确认）
5. 通话时长控制：初筛≤3分钟，深度沟通≤8分钟

### 步骤3：重呼策略执行
1. 未接通/拒接 → 标记第1次未接通，2小时后安排重呼
2. 第2次未接通 → 6小时后安排重呼
3. 第3次未接通 → 24小时后安排最后一次重呼
4. 3次均未接通 → 标记为"无法触达"，回到线索池等待其他渠道触达

### 步骤4：异常处理
1. 客户投诉 → 立即进入安抚模式，记录投诉内容，标记为"需人工跟进"
2. 投诉率监控 → 实时追踪，超过0.1%阈值自动暂停该批次外呼
3. 系统故障 → 记录中断点，自动恢复后从断点继续
4. 号码异常（空号/停机）→ 标记无效号码，从名单移除

## 输入规格

```json
{
  "task_id": "string - 外呼任务ID",
  "call_list": [
    {
      "customer_id": "string",
      "phone_number": "string",
      "lead_grade": "A|B|C|D",
      "previous_interactions": "array",
      "preferred_time_slot": "string (optional)"
    }
  ],
  "script_template_id": "string - 话术模板ID",
  "campaign_type": "screening|deep_conversation|retention|survey",
  "priority": "high|medium|low",
  "max_attempts": "number (default: 3)"
}
```

## 输出规格

```json
{
  "task_id": "string",
  "execution_summary": {
    "total_calls": "number",
    "connected": "number",
    "effective_conversations": "number",
    "not_reached": "number",
    "complaints": "number",
    "completion_rate": "percentage"
  },
  "call_results": [
    {
      "customer_id": "string",
      "call_status": "connected|busy|no_answer|invalid_number",
      "duration_seconds": "number",
      "intent_label": "interested|hesitant|rejected|complaint",
      "retry_scheduled": "boolean",
      "next_retry_time": "datetime (if applicable)"
    }
  ],
  "alerts": ["string - 任何需要关注的异常"]
}
```

## 最佳实践

1. **时间敏感性**：优先在客户最可能接听的时段拨打（历史数据显示上午10-11点和下午15-16点接通率最高）
2. **话术自然度**：开场白避免机械感，结合客户已知信息个性化切入（如"看到您最近浏览了我们的XX产品"）
3. **节奏控制**：避免在短时间内对同一客户高频拨打，最小间隔不低于2小时
4. **合规性**：严格遵守通信管理规定，不在休息时间（21:00-9:00）拨打，DNC名单实时更新
5. **并发管理**：根据系统容量动态调整并发呼叫数，确保通话质量不因过载下降

## 约束条件

- 单日单客户最多拨打1次（重呼除外）
- 投诉率红线：0.1%，触发即暂停
- 通话录音必须完整保存至少6个月
- 不得在法定节假日和非工作时段（21:00-9:00）执行外呼
- 黑名单客户绝对不可拨打
