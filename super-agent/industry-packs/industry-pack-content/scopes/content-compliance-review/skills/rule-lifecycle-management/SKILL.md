# Rule Lifecycle Management（审核规则生命周期管理）

## 技能概述

本技能负责审核规则从创建、测试、发布到下线的全生命周期管理。支持低代码方式配置审核规则，确保规则的结构化存储、版本控制、依赖追踪和合规审计。目标是让新场景的审核规则能在1天内完成从需求到上线的完整流程。

## 适用场景

- 新增审核规则（应对新法规/新违规模式/社会热点）
- 更新已有规则（调整阈值/扩展覆盖范围/修复误判）
- 下线过时规则（法规废止/场景不再适用）
- 规则效果评估和优化迭代
- 紧急规则应急发布

## 执行步骤

### Step 1: 规则需求分析
- 明确规则触发源（新法规/监管要求/安全事件/数据驱动发现）
- 定义规则目标（要拦截什么/保护什么/覆盖什么场景）
- 评估影响范围（预估触发频率/影响内容量/潜在FP率）
- 确认规则优先级和期望上线时间

### Step 2: 规则设计与配置
- 选择规则类型：关键词匹配/正则表达式/语义模型/多模态模型/组合规则
- 配置规则结构：
  ```json
  {
    "rule_id": "唯一标识",
    "rule_name": "规则名称",
    "rule_type": "keyword|regex|semantic|multimodal|composite",
    "trigger_condition": "触发条件表达式",
    "judgment_logic": "判定逻辑",
    "severity": "critical|high|medium|low",
    "applicable_scenes": ["适用场景列表"],
    "effective_scope": "全量|指定渠道|指定用户群",
    "version": "版本号",
    "dependencies": ["依赖的其他规则ID"]
  }
  ```
- 配置规则的正反例测试用例（≥20条正例+20条反例）

### Step 3: 规则评审
- 发起评审流程：策略中枢（技术合理性）+ 业务方（业务适用性）+ 法务（合规性）
- 审查规则是否存在过度拦截风险
- 验证规则与现有规则库的兼容性（无冲突/无重复）
- 评审通过后标记为"待发布"状态

### Step 4: 灰度发布（调用grayscale-release-control技能）
- 将规则提交灰度发布流程
- 监控各阶段的效果指标
- 满足推进条件后逐步提升生效范围

### Step 5: 运行监控与迭代
- 规则上线后持续监控FP/FN指标
- 收集边缘案例（false positive/false negative样本）
- 根据数据反馈调整规则参数
- 变更记录写入版本管理系统

### Step 6: 规则下线
- 评估规则下线影响（是否有其他规则依赖）
- 执行灰度下线（Prod→Shadow→NoOp→Offline）
- 保留规则历史记录（不物理删除），标记为归档状态
- 下线后监控30天，确认无遗留影响

## 输入规格

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| action | enum | 是 | create/update/deprecate/archive |
| rule_definition | object | 是 | 规则完整定义（见Step 2结构） |
| test_cases | array | 是 | 测试用例集（正例+反例各≥20条） |
| justification | string | 是 | 规则创建/变更的理由说明 |
| urgency | enum | 否 | normal/urgent/emergency |
| reviewers | string[] | 否 | 指定评审人列表 |

## 输出规格

| 字段 | 类型 | 说明 |
|------|------|------|
| rule_id | string | 规则唯一标识 |
| status | enum | 规则当前状态（draft/reviewing/approved/deploying/active/deprecated/archived） |
| version | string | 当前版本号 |
| test_results | object | 测试用例执行结果（通过率/失败案例） |
| review_status | object | 评审状态和意见 |
| deployment_plan | object | 发布计划（灰度阶段/时间线） |
| changelog | array | 变更历史记录 |

## 最佳实践

1. **测试先行**：任何规则上线前必须通过≥40条测试用例验证（正反例各≥20）
2. **版本管理**：每次变更递增版本号，保留完整变更历史，支持一键回滚
3. **依赖管理**：组合规则须明确声明依赖关系，被依赖规则下线时需级联评估
4. **文档化**：每条规则须包含清晰的描述（为什么要有这条规则/覆盖什么场景/已知局限）
5. **定期审查**：所有活跃规则每月review，清理长期零命中的规则

## 约束条件

- 规则库总容量上限：5000条活跃规则
- 单条规则的正则表达式长度<1000字符（防止ReDoS）
- 规则评审须三方（技术+业务+法务）全部通过方可发布
- 紧急规则可跳过NoOp阶段但不可跳过Shadow验证
- 所有规则变更记录保留3年
