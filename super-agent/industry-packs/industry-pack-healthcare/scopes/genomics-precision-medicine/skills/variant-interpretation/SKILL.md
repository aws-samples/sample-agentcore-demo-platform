# 基因变异致病性解读 (Variant Interpretation)

## 概述
对高通量测序发现的基因变异进行系统化致病性评估，严格遵循ACMG/AMP五级分类标准，汇总多维度证据链生成标准化分类结论。

## 适用场景
- 临床全外显子/全基因组测序数据中变异的致病性判定
- ClinVar新提交变异的独立验证评估
- 已有分类变异的定期重评估（新证据触发）
- 产前诊断中胎儿变异的紧急致病性判定

## 执行步骤

### 1. 变异信息标准化
- 接收VCF格式变异数据，标准化为HGVS命名
- 确认变异位置（基因组坐标GRCh37/GRCh38）、转录本、蛋白质变化
- 验证变异质量（测序深度≥20x、变异等位基因频率≥30%）

### 2. 群体频率评估（BA1/BS1/PM2）
- 查询gnomAD v4数据库（全球和亚群体频率）
- MAF>5% → BA1（独立良性证据）
- MAF>预设阈值（疾病特异性）→ BS1
- 所有亚群体均不存在 → PM2

### 3. 计算预测评估（PP3/BP4）
- 整合多个预测工具：REVEL（≥0.7支持致病）、CADD（≥20）、SpliceAI（≥0.5影响剪接）
- 多数工具一致预测有害 → PP3
- 多数工具一致预测良性 → BP4

### 4. 功能与文献证据（PS3/BS3/PP5/BP6）
- 检索ClinVar注释（review status和分类）
- 检索HGMD Professional数据库
- PubMed文献检索（功能实验、临床报告）
- 有可靠功能实验证明致病 → PS3
- 有可靠功能实验证明无影响 → BS3

### 5. 分离与de novo分析（PS2/PM6/PP1/BS4）
- 家系共分离数据评估（LOD评分）
- De novo确认（父母样本验证）→ PS2（强）/PM6（中）
- 与疾病在家系中共分离 → PP1

### 6. ACMG规则组合判定
- 汇总所有证据条目
- 按ACMG组合规则判定最终分类
- 例：PVS1+PM2 = Likely Pathogenic
- 例：BA1 = Benign（独立判定）
- 输出分类结论和完整证据链

## 输入规范
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| variantId | string | 是 | 变异唯一标识（chr-pos-ref-alt） |
| gene | string | 是 | 基因符号（HGNC标准） |
| transcript | string | 是 | 参考转录本（NM_开头） |
| hgvsC | string | 是 | cDNA层面HGVS命名 |
| hgvsP | string | 否 | 蛋白层面HGVS命名 |
| phenotype | array | 否 | 患者表型HPO术语列表 |
| familyData | object | 否 | 家系分离数据 |

## 输出规范
| 字段 | 类型 | 说明 |
|------|------|------|
| classification | enum | Pathogenic/Likely_Pathogenic/VUS/Likely_Benign/Benign |
| evidenceCodes | array | 使用的ACMG证据代码列表 |
| evidenceDetails | object | 每项证据的详细说明和来源 |
| clinvarComparison | object | 与ClinVar注释的一致性比对 |
| confidence | number | 分类置信度（0-1） |
| reviewRequired | boolean | 是否需要专家审核 |

## 最佳实践
- 致病/可能致病变异100%需专家审核签发
- VUS不应用于临床决策，报告中需明确声明
- 所有注释数据库需记录查询版本和日期
- 与ClinVar不一致的分类结果需详细记录差异原因
- 每季度对VUS进行重评估（新证据可能改变分类）

## 约束条件
- 不得在无专家审核的情况下发布致病性变异最终报告
- 证据不足时必须分类为VUS，不可降低标准
- 患者基因数据访问需双重授权
- 紧急病例7个工作日、常规21个工作日内完成
