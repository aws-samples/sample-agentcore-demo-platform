# 药物基因组学用药指导 (Pharmacogenomics Guidance)

## 概述
基于患者药物代谢相关基因的基因型信息，参照PharmGKB/CPIC/DPWG指南生成个体化用药建议，包括剂量调整、替代药物推荐和禁忌预警。

## 适用场景
- 处方前药物基因组学预检测结果解读
- 已知基因型患者的新处方个体化建议
- 药物不良反应发生后的基因型回溯分析
- 高风险基因型（如HLA-B*5801）的禁忌用药预警

## 执行步骤

### 1. 基因型信息接收与验证
- 接收药物相关基因检测结果（CYP2C19、CYP2D6、DPYD、UGT1A1、HLA-B等）
- 验证基因型标注格式标准性（星号命名法/*allele）
- 确认检测方法和覆盖的等位基因范围
- 标记未检测的重要等位基因

### 2. 代谢表型判定
- 根据基因型组合判定代谢表型
- 超快代谢（Ultrarapid Metabolizer）
- 正常代谢（Normal/Extensive Metabolizer）
- 中间代谢（Intermediate Metabolizer）
- 慢代谢（Poor Metabolizer）
- 特殊：HLA基因为阳性/阴性判定

### 3. 指南匹配与建议生成
- 查询CPIC（Clinical Pharmacogenetics Implementation Consortium）指南
- 查询DPWG（Dutch Pharmacogenetics Working Group）指南
- 查询PharmGKB药物-基因关联注释
- 标注证据等级：Level 1A/1B/2A/2B

### 4. 临床行动建议输出
- Level 1A/1B：生成明确临床行动建议（剂量调整比例/替代药物）
- Level 2A/2B：标注为参考信息，不独立决策
- 高风险基因型：触发即时禁忌预警
- 所有建议附带原始指南引用和证据摘要

### 5. 协同通知
- 高置信度建议推送至主管医生和临床药师
- 与用药审核Agent的传统药学审核形成互补
- 更新患者药物基因组学档案

## 输入规范
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| patientId | string | 是 | 患者标识 |
| genotypes | array | 是 | 基因型结果列表（基因+等位基因） |
| currentMedications | array | 否 | 当前用药列表 |
| plannedMedication | string | 否 | 计划处方药物 |
| clinicalContext | string | 否 | 临床背景信息 |

## 输出规范
| 字段 | 类型 | 说明 |
|------|------|------|
| metabolizerStatus | object | 各基因代谢表型判定 |
| actionableRecommendations | array | 临床行动建议（Level 1A/1B） |
| informationalNotes | array | 参考信息（Level 2A/2B） |
| contraindications | array | 禁忌预警列表 |
| evidenceLevel | enum | PharmGKB证据等级 |
| guidelineReferences | array | 引用的指南来源 |

## 最佳实践
- 优先关注已有CPIC指南的基因-药物对
- HLA高风险基因型检测应在首次用药前完成
- 代谢表型判定需考虑药物相互作用的影响
- 定期更新指南数据库（CPIC指南年度更新）

## 约束条件
- 不替代临床判断，建议需经医生确认
- Level 2A/2B证据不应作为独立决策依据
- 基因型不能解释所有药物反应个体差异
- 检测未覆盖的等位基因需明确声明局限性
