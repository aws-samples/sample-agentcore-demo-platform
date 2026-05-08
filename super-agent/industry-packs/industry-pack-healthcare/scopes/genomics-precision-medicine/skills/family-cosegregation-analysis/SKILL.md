# 家系共分离分析 (Family Cosegregation Analysis)

## 概述
分析基因变异在家系中的遗传分离模式，评估变异与疾病表型的共分离证据强度（LOD评分），为ACMG分类提供分离分析证据（PP1/BS4）。

## 适用场景
- 家族性遗传病的变异-疾病共分离验证
- De novo变异的确认（需验证父母样本）
- 复合杂合变异的相位确认（顺式vs反式）
- 不完全外显率疾病的渗透率评估

## 执行步骤

### 1. 家系信息采集与构建
- 收集家系成员关系信息（至少三代）
- 绘制标准化家系图谱（受累/未受累/未检测标注）
- 收集各成员的表型信息和检测状态
- 识别家系结构的信息量（可提供的分离证据强度）

### 2. 基因型数据整合
- 收集已检测家系成员的变异基因型
- 确认样本间亲缘关系（身份验证/IBD分析）
- 标注缺失数据（未检测成员）
- 验证基因型数据质量

### 3. 分离分析计算
- 计算LOD评分（logarithm of odds）
- 考虑疾病外显率模型（完全/不完全外显）
- 纳入表型拷贝数（phenocopy率）
- LOD≥3 → 强分离证据（PP1_Strong）
- LOD 1.5-3 → 中等证据（PP1_Moderate）
- LOD 0.6-1.5 → 支持性证据（PP1_Supporting）

### 4. De novo分析
- 确认先证者携带变异
- 验证父母双方均不携带该变异
- 确认亲子关系真实性（排除非亲生）
- 确认de novo → PS2（强致病证据）
- 无法完全确认 → PM6（中等证据）

### 5. 相位分析（复合杂合）
- AR疾病需确认双等位基因变异位于不同拷贝（反式）
- 通过父母基因型推断相位
- 无父母样本时尝试长读长测序/连锁分析
- 确认反式 → 支持致病性评估

## 输入规范
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| pedigreeStructure | object | 是 | 家系结构信息 |
| affectedMembers | array | 是 | 受累成员列表 |
| genotypedMembers | array | 是 | 已基因型检测成员 |
| targetVariant | object | 是 | 待分析的目标变异 |
| diseaseModel | object | 否 | 疾病遗传模型参数 |

## 输出规范
| 字段 | 类型 | 说明 |
|------|------|------|
| lodScore | number | LOD评分 |
| segregationStrength | enum | Strong/Moderate/Supporting/Against |
| acmgCode | string | 对应ACMG证据代码 |
| deNovoStatus | enum | confirmed/assumed/not_applicable |
| phaseAnalysis | object | 相位分析结果 |
| limitations | array | 分析局限性说明 |

## 最佳实践
- 尽可能检测更多家系成员以提高统计效力
- 对小家系（<5人）的分离证据谨慎使用
- 不完全外显率需纳入模型避免假阴性结论
- 记录未检测成员对结果可靠性的影响

## 约束条件
- 家系成员需知情同意参与基因检测
- 亲缘关系验证发现的意外发现需伦理审查后处理
- LOD评分计算需透明化（模型参数公开）
- 小家系的分离证据权重不应过高
