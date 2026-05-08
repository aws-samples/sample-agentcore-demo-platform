# 交易限额管理 (Transaction Limit Management)

## 概述
交易限额管理负责维护和执行支付交易的多级额度体系，包括单笔限额、日累计限额和月累计限额的实时管控。通过精确的额度追踪和校验，在防范资金风险的同时避免对正常交易的不必要阻断。

## 适用场景
- 支付交易发起前的额度预检
- 交易成功后的额度扣减更新
- 客户限额提额/降额的动态调整
- 异常额度使用模式的预警
- 日终/月终额度重置

## 执行步骤

### 步骤1：额度体系初始化与查询
- 加载客户当前有效的限额配置：
  - 单笔限额：每笔交易的最大允许金额
  - 日累计限额：当日所有交易的累计上限
  - 月累计限额：当月所有交易的累计上限
- 查询客户当前已使用额度（日累计已用/月累计已用）
- 确认限额来源：系统默认限额 vs 客户自定义限额 vs 临时调额

### 步骤2：实时额度校验
- 校验当前交易金额是否超过单笔限额
- 校验（当日已用 + 当前交易金额）是否超过日累计限额
- 校验（当月已用 + 当前交易金额）是否超过月累计限额
- 输出校验结果：PASS / EXCEED_SINGLE / EXCEED_DAILY / EXCEED_MONTHLY

### 步骤3：额度扣减与更新
- 交易授权通过后，原子性更新已用额度：
  - 日累计已用 += 交易金额
  - 月累计已用 += 交易金额
- 支持交易撤销/退款时的额度回补
- 确保并发场景下的额度一致性（乐观锁/CAS机制）

### 步骤4：异常监控与预警
- 当日累计使用超过80%时生成预警
- 检测短时间内密集消耗额度的异常模式
- 记录每次额度校验的完整日志

## 输入规格
```json
{
  "customer_id": "string",
  "transaction_amount": "number - 当前交易金额",
  "transaction_type": "string - PAYMENT/TRANSFER/WITHDRAWAL",
  "operation": "string - CHECK/DEDUCT/REFUND"
}
```

## 输出规格
```json
{
  "check_result": "string - PASS/EXCEED_SINGLE/EXCEED_DAILY/EXCEED_MONTHLY",
  "single_limit": "number - 单笔限额",
  "daily_limit": "number - 日累计限额",
  "daily_used": "number - 当日已用",
  "daily_remaining": "number - 当日剩余",
  "monthly_limit": "number - 月累计限额",
  "monthly_used": "number - 当月已用",
  "monthly_remaining": "number - 当月剩余",
  "warning": "string - 预警信息（如有）"
}
```

## 最佳实践
- 使用Redis等内存存储维护实时额度，确保查询和更新的毫秒级性能
- 额度变更需要双写（内存+持久化），防止宕机丢失
- 支持批量额度查询接口，减少多次调用的网络开销
- 日终批量重置日累计额度，月初重置月累计额度

## 约束条件
- 额度校验延迟≤5ms
- 并发更新必须保证原子性，不得出现超额放行
- 额度数据与交易流水必须可对账
- 限额配置变更需留存审计日志
