# 增强尽职调查 (Enhanced Due Diligence - EDD)

## 概述
增强尽职调查（EDD）是对涉及高风险因素的跨境交易执行的深度合规审查，超越常规审核的范围和深度。适用于涉及敏感国家/地区（制裁国、避税天堂）、政治公众人物（PEP）、复杂交易结构或异常跨境模式的交易，确保充分了解交易的商业合理性和最终受益人。

## 适用场景
- 涉及制裁相关国家/地区的跨境交易
- 涉及避税天堂（BVI、开曼群岛、巴拿马等）的资金流动
- 政治公众人物（PEP）的跨境大额交易
- 多层嵌套结构的复杂跨境资金安排
- AML监测Agent或常规审核标记为需升级调查的案件
- 资金流向与声称用途明显不匹配的交易

## 执行步骤

### 步骤1：风险因素评估与EDD启动
- 确认EDD触发条件：
  - 目的国/来源国属于FATF高风险国家名单
  - 交易对手注册于避税天堂
  - 交易主体或实际控制人为PEP
  - 常规审核中发现无法合理解释的异常
- 制定EDD调查范围和重点关注维度
- 通知客户可能需要提供额外信息

### 步骤2：深度信息收集
- **最终受益人（UBO）穿透**：
  - 追溯交易对手的股权结构至自然人
  - 识别25%以上持股的实际控制人
  - 确认UBO是否涉及制裁名单或PEP身份
- **资金来源/去向调查**：
  - 要求客户说明资金来源的合法性
  - 核实资金最终用途的合理性
  - 追溯多层转账中的中间环节
- **商业合理性评估**：
  - 交易规模是否与客户业务体量匹配
  - 交易结构的复杂度是否有商业必要性
  - 是否存在合理的商业目的解释

### 步骤3：综合风险判定
- 汇总所有收集的信息进行综合评估：
  - UBO清晰且无风险 + 资金来源合法 + 商业合理 → 通过
  - 存在疑点但可解释 → 有条件通过（附加监控要求）
  - 无法穿透UBO 或 资金来源不明 或 商业不合理 → 拒绝
- 对通过的交易确定后续监控要求
- 对拒绝的交易判断是否需要上报可疑交易

### 步骤4：EDD报告与归档
- 生成标准化EDD调查报告：
  - 调查范围和方法
  - 收集的信息汇总
  - 风险分析和判定结论
  - 决策依据和后续要求
- 报告经合规官审批签署
- 归档EDD全套材料（保留期≥客户关系存续期+5年）

## 输入规格
```json
{
  "transaction_id": "string",
  "edd_trigger": "string - SANCTIONED_COUNTRY/TAX_HAVEN/PEP/ANOMALY/ESCALATION",
  "customer_id": "string",
  "counterparty_info": {
    "name": "string",
    "country": "string",
    "entity_type": "string - INDIVIDUAL/CORPORATE",
    "registration_details": "object"
  },
  "transaction_details": {
    "amount": "number",
    "currency": "string",
    "purpose": "string",
    "structure": "string - 交易结构描述"
  },
  "preliminary_findings": "string - 常规审核中的初步发现"
}
```

## 输出规格
```json
{
  "edd_result": "string - APPROVED/CONDITIONAL_APPROVAL/REJECTED",
  "risk_assessment": "string - 综合风险评估结论",
  "ubo_identified": "boolean",
  "ubo_details": "object - UBO信息（如已识别）",
  "source_of_funds_verified": "boolean",
  "commercial_rationale_confirmed": "boolean",
  "conditions": "array - 附加条件（如有条件通过）",
  "ongoing_monitoring_requirements": "string - 后续监控要求",
  "str_referral": "boolean - 是否需要上报STR",
  "report_id": "string - EDD报告编号"
}
```

## 最佳实践
- EDD应在合理时间内完成（目标5个工作日），避免无限期挂起客户交易
- 对PEP客户建立专门的档案管理机制，定期更新其政治身份状态
- 利用商业数据库（如World-Check、Dow Jones）辅助UBO穿透
- 与FATF高风险国家名单保持同步更新

## 约束条件
- 涉及敏感国家/地区的跨境交易100%执行EDD
- EDD决策必须经合规官签批，不得自动通过
- 无法完成UBO穿透的交易原则上不予通过
- EDD过程中客户拒绝配合提供信息，视为无法通过
- 所有EDD材料保留≥客户关系终止后5年
