# 指令冲突解决 (Conflict Resolution)

## 概述

指令冲突解决技能处理智能硬件环境中同一设备或关联设备收到矛盾指令时的仲裁逻辑。在多用户、多自动化规则共存的环境中，冲突是常态而非异常，系统必须有明确的优先级规则和透明的冲突通知机制，确保用户始终对设备状态有掌控感。

## 适用场景

- 用户语音指令与自动化规则冲突（如用户说"开灯"但自动化规则刚触发"关灯"）
- 多用户同时对同一设备发出矛盾指令
- 场景执行过程中收到与场景目标状态相反的新指令
- 安全规则与用户操作冲突（如用户要开窗但系统检测到室外PM2.5超标）
- 设备物理限制冲突（如空调同时收到制热和制冷指令）

## 执行步骤

### Step 1: 冲突检测
1. 接收新控制指令时，检查目标设备当前是否有正在执行的操作
2. 对比新指令与正在执行/队列中的指令是否存在矛盾
3. 矛盾定义：同一设备的互斥操作（开vs关）、同一参数的不同目标值（温度26°vs20°）、关联设备的逻辑矛盾（开空调制冷+开窗）
4. 如检测到冲突，进入仲裁流程

### Step 2: 优先级判定
按以下优先级从高到低仲裁（数字越小优先级越高）：
1. **P0 安全指令**：烟雾报警触发关闭燃气、CO超标触发开窗通风
2. **P1 用户主动语音指令**：用户当前说出的明确控制指令
3. **P2 用户主动手动操作**：通过物理按钮或APP操作的指令
4. **P3 场景执行中的指令**：正在执行的场景中的子操作
5. **P4 自动化规则**：定时任务或传感器触发的自动化
6. **P5 系统建议**：个性化学习Agent的主动建议

### Step 3: 冲突仲裁执行
1. 确定获胜指令（高优先级方）
2. 取消/中止失败指令（低优先级方）
3. 如果低优先级方已部分执行，评估是否需要回滚
4. 执行获胜指令

### Step 4: 用户通知
1. 生成冲突说明文本（简要告知用户发生了什么冲突、执行了哪个操作）
2. 通知方式根据冲突类型决定：
   - 安全冲突→强制播报告知（"检测到燃气泄漏风险，已自动关闭燃气阀"）
   - 用户指令覆盖自动化→简短播报（"好的，已为您开灯，已暂停自动关灯规则"）
   - 多用户冲突→通知两方（"客厅灯已按XX的指令关闭"）

### Step 5: 冲突记录与规则优化
1. 记录冲突事件详情（时间、冲突双方、仲裁结果、用户反应）
2. 高频冲突（同一组合每周>3次）标记为需要规则优化
3. 建议用户调整自动化规则或创建例外条件

## 输入规格

```json
{
  "new_command": {
    "device_id": "string",
    "action": "string",
    "parameters": {},
    "source": "voice|manual|scene|automation|system",
    "user_id": "string",
    "timestamp": "ISO8601"
  },
  "conflicting_command": {
    "device_id": "string",
    "action": "string",
    "parameters": {},
    "source": "string",
    "user_id": "string",
    "timestamp": "ISO8601",
    "execution_status": "pending|executing"
  }
}
```

## 输出规格

```json
{
  "conflict_detected": true,
  "conflict_type": "mutual_exclusion|parameter_conflict|logical_conflict|safety_override",
  "resolution": {
    "winning_command": {},
    "winning_priority": "P1",
    "rejected_command": {},
    "rejected_priority": "P4",
    "action_taken": "execute_winner|rollback_and_execute|queue_for_later"
  },
  "user_notification": {
    "should_notify": true,
    "notification_type": "voice_announce|silent_log|force_announce",
    "message": "已为您开灯，自动关灯规则已暂停30分钟"
  },
  "rule_optimization_suggestion": null
}
```

## 最佳实践

- 安全类冲突永远不可被用户覆盖（即使用户说"我知道了还是要开"，涉及生命安全的操作不执行）
- 用户主动操作覆盖自动化后，被覆盖的自动化规则暂停一个周期（而非永久禁用）
- 多用户冲突场景中，如果无法通过优先级区分（同级别用户），采用"后到优先"原则（最新指令生效）
- 冲突通知话术要简洁且有信息量，避免技术术语（说"已暂停定时关灯"而非"P4自动化规则被P1指令覆盖"）
- 频繁冲突是规则设计不合理的信号，应主动建议用户优化自动化配置

## 约束条件

- 冲突检测和仲裁总耗时<50ms（不能增加指令执行延迟）
- 安全类冲突的响应时间<10ms（硬实时要求）
- 冲突记录保留30天，用于模式分析
- 同一设备在1秒内收到的重复指令自动去重（防止用户重复说导致的抖动）
