# 跨境身份信息验证 (Cross-Border Identity Verification)

## 概述
跨境身份信息验证是跨境合规审核的第一道关卡，确保跨境支付报文（SWIFT MT103/MT202等）中的汇款人和收款人身份信息完整、准确且符合国际监管要求。不合规的报文将导致被中间行退回、资金滞留甚至被监管处罚。

## 适用场景
- 跨境汇出汇款的发起方信息校验
- 跨境汇入汇款的收款方信息校验
- SWIFT报文格式合规性检查
- 代理行/中间行信息完整性校验
- 收款方与实际受益人一致性确认

## 执行步骤

### 步骤1：报文字段完整性校验
- **汇款人（Ordering Customer）字段检查**：
  - Field 50K/50F：姓名/名称（必填，不得为空或仅含缩写）
  - 地址信息（街道+城市+国家代码，不得使用PO Box作为唯一地址）
  - 账号或唯一识别码
  - 证件类型及号码（个人客户必填）
- **收款人（Beneficiary Customer）字段检查**：
  - Field 59/59F：姓名/名称完整性
  - 账号格式正确性（IBAN格式校验/当地账号格式）
  - 收款行BIC代码有效性
- **标记缺失或格式异常的字段**

### 步骤2：身份信息交叉核验
- 汇款人信息与本机构KYC档案比对：
  - 姓名一致性
  - 证件号码一致性
  - 地址相符性
- 收款人信息与历史交易记录比对：
  - 是否为首次交易对手（首次需额外关注）
  - 历史交易中的信息一致性
- 检测异常模式：
  - 同一收款人频繁出现不同姓名拼写
  - 收款人地址与资金流向国家不一致

### 步骤3：合规判定与处理
- **完整合规**：标记为通过，允许继续后续审核环节
- **信息不完整**：
  - 生成补正要求（明确列出需补充的字段和格式要求）
  - 暂挂交易等待补正
  - 设置48小时补正时限
- **信息矛盾/异常**：
  - 标记风险点
  - 升级至人工复核
  - 可能触发增强尽职调查

## 输入规格
```json
{
  "transaction_id": "string",
  "swift_message_type": "string - MT103/MT202/MT700等",
  "ordering_customer": {
    "name": "string",
    "address": "array of string",
    "account": "string",
    "id_type": "string",
    "id_number": "string",
    "country": "string"
  },
  "beneficiary_customer": {
    "name": "string",
    "account": "string",
    "bank_bic": "string",
    "country": "string"
  },
  "intermediary_bank": "string - 中间行BIC（如有）"
}
```

## 输出规格
```json
{
  "verification_result": "string - PASS/INCOMPLETE/MISMATCH/SUSPICIOUS",
  "completeness_score": "number - 信息完整度百分比",
  "issues_found": [
    {"field": "string", "issue_type": "string", "description": "string", "severity": "string"}
  ],
  "remediation_required": "array - 需补正的字段清单",
  "cross_check_result": "string - KYC比对结果",
  "risk_flags": "array - 识别的风险标记"
}
```

## 最佳实践
- 维护各国/地区的报文格式要求差异表，避免因地区差异产生误判
- 对高频收款方建立信息缓存，减少重复校验开销
- 补正通知应包含明确的示例格式，减少客户返工次数
- 与SWIFT Alliance系统对接实现自动化报文解析

## 约束条件
- 身份验证结果不单独作为交易拒绝依据（需结合其他维度综合判断）
- 补正等待期间不计入合规审核时限
- 所有校验记录保留≥5年
- 不得将客户身份信息泄露给无关第三方
