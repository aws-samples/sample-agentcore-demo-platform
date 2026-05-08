# 模型健康度评估 (Model Health Assessment)

## 概述
模型健康度评估负责持续监控支付风控体系中各类机器学习模型（风险评分模型、AML检测模型等）的性能指标，及时发现模型退化（Model Degradation），在模型失效之前触发重训或替换流程，确保模型始终维持在可接受的性能水平。

## 适用场景
- 风险评分模型的周度/月度性能监控
- 模型上线后的持续跟踪评估
- 新模型上线前的对比基准评估
- 季度模型全面审查
- 模型性能异常时的诊断分析

## 执行步骤

### 步骤1：性能指标采集
- 采集模型核心性能指标：
  - **区分度指标**：AUC、KS值、Gini系数
  - **准确性指标**：Precision、Recall、F1-Score
  - **稳定性指标**：PSI（Population Stability Index）
  - **排序性指标**：各分段的违约率排序一致性
- 采集模型输入特征的健康指标：
  - 特征缺失率变化
  - 特征分布漂移（Feature Drift）
  - 特征重要性变化
- 采集模型输出的分布情况：
  - 评分分布的整体偏移
  - 各分段的样本占比变化

### 步骤2：健康状态判定
- 建立模型健康度等级：
  - **健康（Green）**：所有指标在正常范围内
    - AUC ≥ 0.75, KS ≥ 0.30, PSI < 0.1
  - **关注（Yellow）**：部分指标出现轻微退化
    - AUC下降0.01-0.02 或 KS下降0.02-0.05 或 PSI 0.1-0.25
  - **预警（Orange）**：明显退化，需启动重训准备
    - AUC下降>0.02 或 KS<0.25 或 PSI>0.25
  - **危险（Red）**：模型严重失效，需紧急处理
    - AUC<0.65 或 排序性逆转 或 特征大面积缺失

### 步骤3：退化原因诊断
- 当模型进入Yellow或更低状态时启动诊断：
  - **数据漂移（Data Drift）**：客群结构变化、新型交易模式出现
  - **概念漂移（Concept Drift）**：欺诈模式演变、风险定义变化
  - **特征质量问题**：数据源异常、接口变更、缺失率上升
  - **样本时效性**：训练数据过旧，不再代表当前分布
- 输出诊断结论和建议行动

### 步骤4：行动建议与触发
- 根据健康状态和诊断结论输出建议：
  - **Green**：无需行动，继续常规监控
  - **Yellow**：密切关注，准备重训数据
  - **Orange**：启动模型重训流程，准备新模型
    - 明确重训范围（全量重训/增量学习/局部微调）
    - 估计重训周期和资源需求
  - **Red**：紧急切换至备用模型/规则引擎
    - 同时启动紧急重训
- 重训完成后需通过回测和A/B测试验证后方可上线

## 输入规格
```json
{
  "model_id": "string - 模型标识",
  "model_type": "string - RISK_SCORE/AML_DETECTION/FRAUD_DETECTION",
  "assessment_period": {"start": "date", "end": "date"},
  "assessment_type": "string - ROUTINE/DEEP_DIAGNOSIS/PRE_LAUNCH",
  "baseline_metrics": "object - 模型上线时的基准指标"
}
```

## 输出规格
```json
{
  "model_id": "string",
  "health_status": "string - GREEN/YELLOW/ORANGE/RED",
  "metrics": {
    "auc": {"current": "number", "baseline": "number", "change": "number"},
    "ks": {"current": "number", "baseline": "number", "change": "number"},
    "psi": "number",
    "feature_drift_count": "integer - 漂移特征数量"
  },
  "degradation_detected": "boolean",
  "degradation_cause": "string - DATA_DRIFT/CONCEPT_DRIFT/FEATURE_QUALITY/SAMPLE_STALENESS",
  "recommended_action": "string - MONITOR/PREPARE_RETRAIN/RETRAIN/EMERGENCY_SWITCH",
  "estimated_retrain_effort": "string - 预计重训工作量",
  "next_assessment_date": "date"
}
```

## 最佳实践
- 建立模型注册表（Model Registry），统一管理所有在用模型的元信息
- PSI监控应细化到特征级别，及时发现单个特征的异常
- 模型重训不应等到Red状态才启动，Orange阶段即应开始准备
- 保持备用模型/规则引擎始终可用，确保紧急切换的可行性

## 约束条件
- 模型性能监控频率：AUC/KS周度，PSI日度
- 模型重训周期不超过季度（即使指标正常也需定期刷新）
- 新模型上线前必须通过回测和≥72小时A/B测试
- 模型变更记录保留≥5年（满足监管模型审查要求）
- Red状态模型不得在无备用方案情况下继续服务
