# 线索流转管理 (Lead Routing Management)

## 技能概述

线索流转管理技能负责根据线索评分结果执行不同级别线索的自动化流转，确保高价值线索在规定时效内到达合适的跟进人员，中低意向线索进入对应的培育或验证流程。该技能是连接营销获客和销售成交之间的"调度中心"，直接影响线索响应速度和转化效率。

## 适用场景

- A级线索实时分配到销售CRM
- B级线索进入nurturing培育序列
- C/D级线索回到外呼池安排意向验证
- 线索升降级后的流转路径调整
- 销售人员工作量均衡分配
- 超时未处理线索的升级告警

## 详细执行步骤

### 步骤1：接收评分结果与确定流转路径
1. 接收线索评分Agent输出的评分结果和级别
2. 根据级别确定目标系统和动作：
   - A级 → CRM销售分配（1小时SLA）
   - B级 → Marketing Automation nurturing序列
   - C级 → 外呼池（7天内安排触达）
   - D级 → 低频维护池（30天后重评）
3. 检查是否有特殊路由规则（如指定行业线索归特定销售团队）

### 步骤2：A级线索急速分配
1. 触发CRM集成接口，推送线索完整信息
2. 匹配销售人员规则：
   - 行业匹配：线索所在行业对应的专业销售
   - 地域匹配：线索地理位置对应的区域销售
   - 负载均衡：选择当前跟进量最少的匹配销售
   - 专属关系：已有过沟通历史的优先分配原销售
3. 发送分配通知（CRM系统通知+短信/企微提醒）
4. 等待系统回执确认分配成功
5. 启动SLA计时器：1小时内需销售首次响应

### 步骤3：SLA监控与升级
1. 分配后15分钟：检查销售是否已查看线索
2. 分配后30分钟：若未查看，发送第二次提醒
3. 分配后45分钟：若仍未响应，升级通知销售主管
4. 分配后60分钟：SLA超时，自动转分配给备选销售+告警
5. 记录每条A级线索的实际响应时间

### 步骤4：培育序列管理（B级线索）
1. 将B级线索加入预设的nurturing邮件/内容序列
2. 设置培育周期检查点（每2周评估是否升级）
3. 监控培育内容互动数据（打开/点击/回复）
4. 触发重新评分条件：培育互动累计达到阈值

### 步骤5：异常处理
1. CRM系统不可用 → 本地队列缓存 + 系统恢复后批量推送 + 告警
2. 目标销售已离职/休假 → 自动路由到团队备选人员
3. 线索信息不完整 → 标记需补充 + 仍按时效分配 + 提醒销售确认
4. 重复线索 → 检测到已存在CRM中 → 更新而非新建 + 通知原跟进人

## 输入规格

```json
{
  "customer_id": "string",
  "lead_grade": "A|B|C|D",
  "previous_grade": "A|B|C|D|null",
  "grade_change_direction": "upgrade|downgrade|new|unchanged",
  "scoring_details": {
    "total_score": "number",
    "top_factors": ["string"]
  },
  "customer_info": {
    "name": "string",
    "company": "string",
    "industry": "string",
    "location": "string",
    "contact_info": "object"
  },
  "routing_preferences": {
    "preferred_sales_rep": "string (optional)",
    "team_assignment": "string (optional)",
    "priority_override": "string (optional)"
  }
}
```

## 输出规格

```json
{
  "routing_id": "string",
  "customer_id": "string",
  "routing_action": "crm_assign|nurturing_enroll|outbound_pool|low_priority_pool",
  "target_system": "string",
  "assigned_to": {
    "sales_rep_id": "string (for A-grade)",
    "sales_rep_name": "string",
    "team": "string"
  },
  "sla_deadline": "datetime",
  "routing_status": "completed|pending_confirmation|failed_retry",
  "confirmation_received": "boolean",
  "notifications_sent": [
    {"channel": "string", "recipient": "string", "timestamp": "datetime"}
  ],
  "escalation_triggered": "boolean"
}
```

## 最佳实践

1. **速度为王**：A级线索从评分完成到CRM分配完成应控制在5分钟以内
2. **分配透明**：销售人员能看到分配原因和线索热度来源，提高跟进积极性
3. **避免频繁转手**：同一线索尽量不超过2次重新分配，每次转手都降低转化概率
4. **数据完整性**：即使是急速分配，也要确保核心字段完整（姓名、公司、联系方式、评分明细）
5. **反馈闭环**：销售跟进结果（成交/未成交/无效）必须回流到评分模型进行验证

## 约束条件

- A级线索分配完成时间≤5分钟（从评分输出到CRM确认）
- SLA超时率目标<5%
- 单销售人员同时跟进A级线索不超过20条（防止过载）
- 所有路由操作需有完整审计日志
- 非工作时间的A级线索在次日9:00前完成分配（特殊紧急情况除外）
