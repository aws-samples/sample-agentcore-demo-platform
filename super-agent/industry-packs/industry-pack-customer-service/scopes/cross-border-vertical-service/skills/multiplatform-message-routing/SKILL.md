# 多平台消息路由 (Multiplatform Message Routing)

## 概述

多平台消息路由技能负责将来自不同跨境电商平台（Shopee、Lazada、TikTok Shop、Amazon、独立站）的客户消息进行统一接入、协议适配和智能路由分发。该技能是整个跨境客服系统的"入口网关"，确保所有平台消息被及时接收并正确分发到下游处理环节。

## 适用场景

- 客户通过任意平台发送咨询消息时的实时接入
- 多平台消息格式差异的协议转换与标准化
- 基于消息内容和客户属性的智能路由决策
- 消息队列积压时的负载均衡调度
- 平台API故障时的消息缓存与重试

## 详细执行步骤

### 步骤1：消息接收与协议适配
1. 通过各平台Webhook/长轮询接收原始消息
2. 解析平台特定消息格式：
   - Shopee: JSON格式，含shop_id、order_sn、msg_type字段
   - Lazada: XML/JSON混合格式，含seller_id、message_type字段
   - TikTok Shop: JSON格式，含conversation_id、message_content字段
   - Amazon: SP-API格式，含marketplaceId、amazonOrderId字段
   - 独立站: 自定义WebSocket/REST格式
3. 提取消息核心要素：发送者ID、平台标识、消息类型（文本/图片/视频/订单卡片）、时间戳、关联订单号

### 步骤2：消息标准化
1. 转换为统一内部消息格式（Standard Message Object）:
```json
{
  "message_id": "uuid",
  "platform": "shopee|lazada|tiktok_shop|amazon|website",
  "platform_message_id": "原始平台消息ID",
  "customer_id": "统一客户ID",
  "shop_id": "店铺ID",
  "session_id": "会话ID",
  "message_type": "text|image|video|order_card|system",
  "content": {
    "text": "原始文本内容",
    "media_urls": [],
    "order_ref": "关联订单号"
  },
  "language_code": "检测到的语言代码",
  "timestamp": "UTC+8时间戳",
  "sla_deadline": "该平台要求的最晚响应时间",
  "priority": "normal|high|urgent"
}
```

### 步骤3：SLA时限计算与优先级判定
1. 根据平台规则计算SLA截止时间：
   - Shopee: 首响12小时
   - Amazon: 首响24小时
   - Lazada: 首响24小时
   - TikTok Shop: 首响24小时
   - 独立站: 首响4小时（自定义）
2. 结合客户VIP等级、订单金额、历史投诉记录判定优先级
3. 对距SLA截止时间<20%的消息标记为urgent

### 步骤4：路由决策
1. 判断当前时段（工作时段/夜间/节假日）
2. 查询目标处理Agent的可用状态和队列深度
3. 执行路由规则：
   - 标准业务查询 → 垂直业务处理Agent
   - 含商机信号的咨询 → 同时发送至垂直业务处理Agent + 商机识别Agent
   - 投诉/复杂问题 → 转人工或推送至工单处理Scope
4. 输出routing_decision并将消息推送至目标队列

### 步骤5：异常处理
1. 平台API连接超时 → 启动消息缓存队列，5分钟间隔重试，最多3次
2. 消息格式解析失败 → 记录原始消息到dead_letter_queue，通知运维
3. 队列积压超阈值（单平台>50条/全平台>200条）→ 触发负载均衡预警

## 输入规格

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| raw_message | object | 是 | 平台原始消息体 |
| platform | string | 是 | 来源平台标识 |
| shop_config | object | 是 | 店铺配置（API密钥、SLA规则等） |
| current_queue_depth | integer | 否 | 当前队列深度 |

## 输出规格

| 字段 | 类型 | 说明 |
|------|------|------|
| standard_message | object | 标准化后的消息体 |
| routing_decision | object | 路由决策（target_agent, priority, sla_deadline） |
| alerts | array | 异常预警列表（如有） |

## 最佳实践

1. **幂等性设计**：使用platform_message_id做去重，防止平台重复推送导致消息重复处理
2. **优雅降级**：当某平台API完全不可用时，通过邮件/备用渠道通知客户，而非静默丢失
3. **流量削峰**：大促期间预估消息量峰值，提前扩容消息队列和处理能力
4. **监控告警**：对消息接入延迟>3秒的情况实时告警，便于快速定位瓶颈

## 约束条件

- 消息接入延迟必须<3秒（从平台推送到系统确认接收）
- 不在日志中明文存储客户个人敏感信息（手机号、地址等需脱敏）
- 各平台API调用频率需遵守平台Rate Limit限制
- 消息缓存队列最大容量10000条，超过需人工介入
