# API事务管理 (API Transaction Management)

## 概述

本技能负责管理语音驱动业务操作中的API调用生命周期，确保每一笔业务事务的原子性、幂等性和状态可追踪性。涵盖从事务初始化、预检验证、API调用执行到结果处理的完整链路。

## 适用场景

- 用户通过语音发起的订单创建/修改/取消操作
- 支付、退款、转账等资金类API调用
- 航班改签、酒店预订、医疗挂号等第三方系统集成调用
- 多步骤业务操作中的单步API执行

## 执行步骤

### Step 1: 事务初始化
- 生成全局唯一事务ID（UUID v4 + 时间戳 + 业务类型前缀）
- 创建事务记录（状态：INITIALIZED）
- 记录请求来源（flow-guide agent的会话ID）
- 校验执行前置条件（verification_token有效性、double_confirm标记）

### Step 2: 业务预检（Pre-flight Check）
- **余额/额度检查**：资金类操作前验证账户余额或信用额度是否充足
- **库存/资源检查**：下单/预约类操作前验证库存或时间槽可用性
- **业务规则校验**：检查操作是否符合业务约束（如改签时间限制、退款期限）
- **频率限制检查**：防止短时间内重复操作（幂等性保护）
- 预检失败：立即返回失败原因，不进入执行阶段

### Step 3: API调用执行
- 组装API请求（Headers: 事务ID、幂等键、认证Token）
- 设置超时阈值（资金类：30s，非资金类：15s，查询类：5s）
- 发起调用并启动超时计时器
- 记录请求发送时间戳

### Step 4: 响应处理与状态更新
- **成功响应（2xx）**：更新事务状态为SUCCESS，提取业务结果字段
- **客户端错误（4xx）**：分析错误码，归类为不可重试错误，生成用户友好提示
- **服务端错误（5xx）**：归类为可重试错误，进入重试逻辑
- **超时无响应**：标记为TIMEOUT，启动异步状态查询
- **网络异常**：记录异常详情，判断是否安全重试

### Step 5: 结果封装与通知
- 生成结构化执行结果（transaction_id, status, result_summary）
- 构造语音播报文本（自然语言描述操作结果）
- 构造确认通知内容（短信/APP推送模板填充）
- 返回结果给flow-guide agent

## 输入规格

```json
{
  "transaction_type": "order_create | order_modify | payment | refund | booking | transfer",
  "verification_token": "身份验证通过后的有效令牌",
  "double_confirm": true,
  "business_params": {
    "具体业务参数，因操作类型而异"
  },
  "session_context": {
    "session_id": "会话标识",
    "user_id": "用户标识",
    "flow_id": "流程实例标识"
  }
}
```

## 输出规格

```json
{
  "transaction_id": "TXN-ORDER-20240315-uuid",
  "status": "SUCCESS | FAILED | TIMEOUT | PENDING_CONFIRM",
  "result_summary": "用于语音播报的自然语言结果描述",
  "notification_payload": {
    "sms_template": "短信模板及填充内容",
    "push_content": "APP推送内容"
  },
  "error_classification": "RETRYABLE | NON_RETRYABLE | NEEDS_MANUAL",
  "alternative_suggestions": ["替代方案1", "替代方案2"],
  "execution_metrics": {
    "total_duration_ms": 1200,
    "api_response_time_ms": 800,
    "retry_count": 0
  }
}
```

## 最佳实践

1. **幂等性保证**：每个事务请求必须携带唯一的幂等键，后端系统据此去重
2. **超时分级**：不同业务类型采用不同超时阈值，避免一刀切
3. **熔断保护**：同一API连续失败5次触发熔断，30秒后进入半开状态探测恢复
4. **日志完整性**：每个事务的完整生命周期（含所有重试）必须有审计日志
5. **资金操作零容忍**：涉及资金变动的操作在任何不确定情况下选择不执行而非冒险执行

## 约束条件

- 绝不接受无有效verification_token的执行请求
- 资金类操作必须确认double_confirm=true
- 单个事务最大执行时间不超过60秒（含重试）
- 事务状态一旦到达终态（SUCCESS/FAILED），不可再变更
- 并发事务数限制：同一用户同时进行中的事务不超过3个
