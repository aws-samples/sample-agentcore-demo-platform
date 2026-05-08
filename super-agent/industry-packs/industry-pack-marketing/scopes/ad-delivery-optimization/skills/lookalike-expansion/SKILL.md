# Lookalike受众扩展 (Lookalike Expansion)

## 技能概述

该技能用于基于高价值种子受众构建Lookalike相似受众，通过平台算法找到与种子用户特征相似的新用户群体，实现在保持受众质量的前提下规模化扩展广告触达范围。覆盖种子选择、扩展比例设定、效果验证全流程。

## 适用场景

- 现有受众池消耗趋近饱和时的扩量需求
- 新产品/新市场缺少历史数据时的冷启动
- 高价值客户特征回传后的相似人群挖掘
- 跨平台的Lookalike策略统一部署
- 不同扩展比例的效果对比测试

## 执行步骤

### Step 1: 种子受众选择
- 从CRM/转化数据中筛选高价值种子用户
- 种子质量优先级：高LTV客户 > 多次复购客户 > 首次高客单转化 > 一般转化
- 种子规模推荐：1000-50000人（过少则模型不准，过多则特征被稀释）
- 排除近期流失/退款客户，保证种子纯净度
- 按业务线/产品线区分不同种子包

### Step 2: 扩展策略设计
- 确定目标平台的Lookalike机制：
  - Meta：1%-10%扩展比例，基于Value-based Lookalike
  - Google：Similar Audiences（即将弃用）→ 转向First-party audience signals
  - TikTok：Custom Audience Lookalike，支持Narrow/Balanced/Broad
- 推荐扩展比例策略：
  - 精准层（1-3%）：最相似人群，CPA最优但规模有限
  - 平衡层（3-5%）：规模与质量平衡，适合主力投放
  - 规模层（5-10%）：最大覆盖，CPA偏高但适合品牌曝光

### Step 3: 多种子包组合
- 避免使用单一种子包（特征偏差风险）
- 推荐组合策略：
  - 种子A：近30天高价值转化用户
  - 种子B：近90天多次互动用户
  - 种子C：客户LTV Top20%用户
- 不同种子包的Lookalike之间需检查重叠度
- 重叠度>50%的包合并或择优使用

### Step 4: 测试验证方案
- 为每个Lookalike受众设置小预算测试（总预算5-10%）
- 测试期：至少5-7天（积累足够转化数据）
- 核心评估指标：CPA vs 现有受众CPA、CVR对比、规模可持续性
- 通过标准：CPA在现有受众CPA的120%以内可视为有效扩展

### Step 5: 扩量与维护
- 验证通过的Lookalike逐步增加预算（每次+30%，间隔3天）
- 每2周刷新种子数据（新增转化用户纳入种子）
- 监控Lookalike效果衰减趋势（随时间效果逐步下降是正常的）
- 效果衰减>30%时需更新种子重新建模

## 输入规格

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| seed_audience | object | 是 | 种子受众信息（来源、规模、质量标签） |
| target_platform | string | 是 | 目标平台 |
| expansion_objective | string | 是 | 扩展目标（precision/balance/scale） |
| budget_for_testing | number | 否 | 测试预算 |
| current_audience_cpa | number | 否 | 现有受众CPA基准 |

## 输出规格

```json
{
  "lookalike_plan": [
    {
      "seed_name": "30天高价值转化",
      "seed_size": 5000,
      "platform": "Meta",
      "expansion_ratio": "3%",
      "estimated_reach": 1200000,
      "expected_cpa_range": "45-60元",
      "test_budget": 2000,
      "test_duration": "7天"
    }
  ],
  "overlap_check": {"seed_A_vs_B": "23%", "seed_A_vs_C": "45%"},
  "recommendation": "种子A和C重叠度高，建议合并使用",
  "success_criteria": "CPA≤现有受众CPA×120%",
  "refresh_schedule": "每2周更新种子数据"
}
```

## 最佳实践

1. **种子质量>数量**：宁选500个高价值客户，不选5万个低价值用户
2. **分层扩展**：从精准层开始测试，验证有效后再拓展到平衡层
3. **定期刷新**：种子数据每2周更新一次，保持时效性
4. **排除当前受众**：Lookalike投放时排除现有受众和种子用户本身
5. **跨平台差异化**：各平台Lookalike效果差异大，需独立评估

## 约束条件

- 种子规模：1000-50000人
- 种子纯净度：排除退款/投诉/虚假用户
- 测试期：至少5天，积累≥30个转化
- 扩量节奏：验证通过后每次+30%，间隔3天
- 扩展比例起步：新种子从1-3%开始，不一上来就10%
