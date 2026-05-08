# Violation Classification（违规类型分类）

## 技能概述

本技能负责对检测到的违规内容进行精细化的多标签分类，输出标准化的违规类型标签体系。准确的违规分类是后续处置决策（删除/警告/限流/封号）、人工复核分配（不同类型分配不同专项审核员）和数据分析（违规趋势追踪）的基础。

## 适用场景

- 审核引擎检出违规后的精细分类
- 人工复核时的违规类型标注
- 违规趋势统计分析
- 处置策略匹配（不同违规类型对应不同处置等级）
- 监管报送数据的标准化整理

## 执行步骤

### Step 1: 一级分类（违规大类）
将违规内容分入以下一级类目：
- **涉政敏感**：政治相关违规内容
- **色情低俗**：涉及性相关的违规内容
- **暴力恐怖**：涉及暴力、恐怖主义的内容
- **违法犯罪**：涉及具体违法行为的内容
- **虚假有害**：虚假信息、误导性内容
- **侵权违规**：知识产权侵犯
- **广告违规**：违反广告法规的内容
- **未成年保护**：对未成年人有害的内容

### Step 2: 二级分类（具体类型）
在一级类目下进行细分：
```
涉政敏感
├── 领导人负面 (severity: critical)
├── 歪曲党史国史 (severity: critical)
├── 分裂国家 (severity: critical)
├── 颠覆国家政权 (severity: critical)
├── 境外势力渗透 (severity: high)
└── 政治谣言 (severity: high)

色情低俗
├── 硬色情 (severity: critical)
├── 软色情/擦边 (severity: high)
├── 低俗用语 (severity: medium)
├── 性暗示 (severity: medium)
└── 儿童色情 (severity: critical, 零容忍)

暴力恐怖
├── 恐怖主义宣传 (severity: critical)
├── 极端暴力 (severity: critical)
├── 自残自杀引导 (severity: critical)
├── 血腥暴力 (severity: high)
└── 动物虐待 (severity: high)

违法犯罪
├── 毒品信息 (severity: critical)
├── 赌博信息 (severity: high)
├── 枪支武器 (severity: critical)
├── 诈骗信息 (severity: high)
└── 违禁品交易 (severity: high)

虚假有害
├── 虚假新闻 (severity: high)
├── 伪科学/健康谣言 (severity: high)
├── 恶意营销 (severity: medium)
├── 数据造假 (severity: medium)
└── AI伪造内容 (severity: high)

侵权违规
├── 版权文本抄袭 (severity: medium)
├── 图片/视频盗用 (severity: medium)
├── 商标侵权 (severity: medium)
├── 肖像权侵犯 (severity: high)
└── 隐私泄露 (severity: high)

广告违规
├── 绝对化用语 (severity: medium)
├── 虚假宣传 (severity: high)
├── 违禁品广告 (severity: critical)
├── 未标注广告标识 (severity: low)
└── 医疗/金融违规广告 (severity: high)

未成年保护
├── 儿童色情 (severity: critical, 零容忍)
├── 诱导未成年 (severity: critical)
├── 校园暴力 (severity: high)
└── 不适宜未成年内容 (severity: medium)
```

### Step 3: 多标签判定
- 一条内容可能同时触发多个违规类型（如色情+侵权）
- 对每个可能的标签独立评估置信度
- 输出所有置信度>0.5的标签（多标签分类）
- 标注主要违规类型（置信度最高的标签）

### Step 4: 严重度判定
- 根据分类结果确定综合严重度：
  - **Critical（零容忍）**：涉及涉政核心/恐怖主义/儿童色情/毒品枪支
  - **High（高风险）**：硬色情/极端暴力/虚假新闻/赌博
  - **Medium（中风险）**：软色情/低俗/广告违规/轻度侵权
  - **Low（低风险）**：擦边/轻微用语不当
- 多标签时取最高严重度作为综合严重度

### Step 5: 处置建议输出
- 根据违规类型+严重度输出处置建议：
  - Critical：立即删除+封号+监管报送
  - High：删除+警告+限制功能
  - Medium：不予推荐+提示修改
  - Low：降权+标记观察

## 输入规格

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | object | 是 | 待分类的内容（含原始内容和审核分析结果） |
| review_result | object | 是 | 多模态审核引擎的分析结果 |
| evidence | array | 是 | 违规证据列表 |
| content_type | enum | 是 | 内容类型（text/image/audio/video/mixed） |

## 输出规格

| 字段 | 类型 | 说明 |
|------|------|------|
| primary_violation | object | 主要违规类型（最高置信度） |
| primary_violation.category | string | 一级类目 |
| primary_violation.subcategory | string | 二级类目 |
| primary_violation.confidence | float | 置信度 |
| all_violations | array | 所有检出的违规标签列表 |
| overall_severity | enum | critical/high/medium/low |
| disposition_suggestion | string | 处置建议 |
| regulatory_tags | string[] | 监管报送所需的标准化标签 |

## 最佳实践

1. **标签体系标准化**：严格遵循国家网信办发布的违规内容分类标准
2. **多标签优于单标签**：不要强行归入单一类别，如实输出所有触发的标签
3. **严重度从严**：多标签时取最高严重度，不对严重度取平均
4. **持续更新**：分类体系需跟随法规更新和违规模式演变不断完善
5. **与处置解耦**：分类只输出事实判定和建议，最终处置决策由业务系统执行

## 约束条件

- 分类延迟<100ms（在审核分析完成后的轻量推理）
- 标签体系须与国家相关标准保持兼容
- 零容忍类违规（Critical）的分类准确率>99%
- 新增二级类目需经过策略评审流程
- 分类结果需支持审计追溯（保留180天）
