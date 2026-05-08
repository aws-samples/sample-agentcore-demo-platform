# 多因子验证编排 (Multi-Factor Verification Orchestration)

## 概述

本技能负责根据操作风险等级编排多因子身份验证流程，组合声纹、口头密码、短信OTP等多种验证方式，在安全性和用户体验之间取得最优平衡。核心职责是决定"用哪些验证方式、以什么顺序执行、如何处理部分失败"。

## 适用场景

- 高风险操作（支付/转账）的双因子验证流程编排
- 声纹验证边界通过后的补充验证方式选择
- 验证失败后的升级策略执行
- 特殊场景下的验证降级（如声纹不可用时的替代方案）

## 执行步骤

### Step 1: 风险评估与验证策略确定
- 接收操作类型和风险等级信息
- 查询用户可用的验证方式（是否注册声纹、是否设置口头密码、绑定手机号）
- 确定验证策略：
  - 低风险：声纹静默 (single factor)
  - 中风险：声纹显式 + 口头密码 (two factors)
  - 高风险：声纹 + OTP (two factors, 其中一个为独立信道)
  - 极高风险：声纹 + OTP + 口头密码 (three factors)
- 考虑上下文因素调整策略：
  - 最近5分钟内已通过高级验证：降级为静默声纹即可
  - 设备/网络环境异常：无论操作级别强制升级

### Step 2: 验证流程执行
- 按确定的策略依次或并行执行验证：
  - 声纹验证：调用voiceprint-authentication技能
  - 口头密码：播放提示语→采集用户响应→ASR转写→哈希比对
  - OTP发送：调用短信服务发送验证码→等待用户口述→ASR转写→比对
- 每个验证因子独立计时（声纹3s、口头密码10s、OTP60s）

### Step 3: 组合结果判定
- 所有要求的因子都通过：整体PASS
- 部分通过部分失败：
  - 声纹通过但OTP失败：整体FAIL（OTP为强制因子）
  - 声纹边界通过+口头密码通过：整体PASS（互补验证）
- 策略降级处理：
  - 声纹不可用（环境太吵）：升级为OTP+口头密码
  - OTP收不到：提供备用验证方式（邮箱验证码/安全问题）

### Step 4: 重试与锁定管理
- 每个验证因子独立计算失败次数
- 整体重试策略：
  - 首次失败：提供友好提示+"请再试一次"
  - 第二次失败：更换验证方式或提供操作提示
  - 第三次失败：锁定当前操作权限+自动转人工
- 锁定后的解锁路径：人工客服验证身份后手动解锁

### Step 5: 验证会话管理
- 验证通过后生成统一的verification_token
- Token包含：验证时间、验证方式、验证级别、有效期
- Token有效期内的后续操作无需重新验证（同级别或更低级别）
- 验证会话超时管理（用户长时间无响应则验证作废）

## 输入规格

```json
{
  "operation": {
    "type": "payment",
    "risk_level": "high",
    "amount": 5000,
    "target": "转账目标描述"
  },
  "user_profile": {
    "user_id": "user-123",
    "registered_factors": ["voiceprint", "verbal_password", "sms_otp"],
    "phone_number": "138****1234",
    "recent_verifications": [
      {"time": "2024-03-15T09:50:00Z", "level": "medium", "result": "PASS"}
    ]
  },
  "environment": {
    "device_id": "device-abc",
    "is_known_device": true,
    "noise_level": "low",
    "network_quality": "good"
  }
}
```

## 输出规格

```json
{
  "verification_strategy": {
    "required_factors": ["voiceprint_explicit", "sms_otp"],
    "factor_order": ["voiceprint_explicit", "sms_otp"],
    "reason": "高风险资金操作，需声纹+独立信道OTP双因子"
  },
  "verification_result": {
    "overall": "PASS | FAIL | LOCKED",
    "factor_results": {
      "voiceprint_explicit": {"result": "PASS", "confidence": 97.2},
      "sms_otp": {"result": "PASS", "match": true}
    }
  },
  "verification_token": "VT-MFA-20240315-uuid",
  "token_metadata": {
    "verified_at": "2024-03-15T10:00:30Z",
    "expiry": "2024-03-15T10:05:30Z",
    "verification_level": "high",
    "factors_used": ["voiceprint", "sms_otp"]
  },
  "retry_info": {
    "attempts_used": 1,
    "attempts_remaining": 2,
    "lockout_at": 3
  }
}
```

## 最佳实践

1. **最小验证原则**：不要过度验证，风险级别决定验证强度，避免低风险操作也要OTP
2. **验证复用**：短时间内已完成高级别验证的，低级别操作无需重复验证
3. **自然过渡**：验证过程的话术应自然融入对话（"好的，为了安全，我需要确认一下是您本人"）
4. **备选方案**：每种验证方式都应有降级替代，不因单一渠道故障阻断用户
5. **隐私保护**：验证过程中不泄露用户注册了哪些验证方式（防社工攻击）

## 约束条件

- 整体验证流程耗时不超过30秒（不含等待OTP的时间）
- OTP有效期60秒，过期需重新发送
- OTP发送频率限制：同一手机号60秒内最多1次，24小时内最多10次
- 验证锁定后解锁必须通过人工，不允许自动解锁
- 验证方式选择策略必须与安全团队审批的策略表一致
- 任何验证环节不得记录用户口头密码明文
