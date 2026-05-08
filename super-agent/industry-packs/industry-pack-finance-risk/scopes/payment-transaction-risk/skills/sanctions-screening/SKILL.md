# 制裁名单筛查 (Sanctions Screening)

## 概述
制裁名单筛查是AML监测体系中的关键合规能力，对交易双方的名称实时比对多个国际制裁清单，识别与受制裁实体或个人相关的交易。筛查采用精确匹配与模糊匹配相结合的算法策略，有效处理姓名变体、音译差异和别名等情况，同时控制误报率。

## 适用场景
- 所有支付交易的收付款方名称实时筛查
- 跨境支付交易的增强制裁筛查
- 新客户开户时的制裁名单比对
- 制裁名单更新后的存量客户回扫
- 客户信息变更时的重新筛查

## 执行步骤

### 步骤1：名单库加载与维护
- 维护多源制裁名单数据库：
  - OFAC SDN List（美国财政部特别指定国民名单）
  - UN Security Council Consolidated List（联合国安理会综合名单）
  - EU Consolidated Financial Sanctions List（欧盟制裁名单）
  - 中国冻结恐怖主义资产名单
  - 国内反洗钱黑名单
- 名单更新机制：新名单发布后30分钟内完成全量加载生效
- 维护名单版本日志和变更记录

### 步骤2：名称预处理
- 对待筛查名称执行标准化处理：
  - 去除特殊字符和多余空格
  - 姓名顺序标准化（姓/名拆分）
  - 音译转换（拼音↔英文、阿拉伯文音译等）
  - 常见别名/简称展开
  - 企业名称中的法律实体后缀处理（Ltd/Inc/Co等）

### 步骤3：多算法匹配执行
- **精确匹配**：完全一致的字符串匹配（含标准化后的精确匹配）
- **模糊匹配**：
  - Jaro-Winkler相似度（阈值≥0.85）
  - Soundex/Metaphone语音编码匹配
  - Levenshtein编辑距离（≤2）
  - N-gram相似度
- **综合评分**：加权计算最终匹配得分（0-100）
  - ≥95分：精确匹配，高置信度命中
  - 80-94分：强模糊匹配，需人工确认
  - 65-79分：弱模糊匹配，建议复核
  - <65分：未命中

### 步骤4：命中结果分级处理
- **精确匹配（≥95分）**：
  - 立即冻结交易
  - 自动通知合规官
  - 生成监管报送材料
  - 禁止释放，必须经合规审批
- **模糊匹配（65-94分）**：
  - 暂挂交易
  - 生成人工确认工单（含匹配详情、比对分析）
  - 人工确认为真实命中→按精确匹配处理
  - 人工确认为误报→释放交易并记录白名单
- **未命中（<65分）**：
  - 放行交易
  - 记录筛查日志

## 输入规格
```json
{
  "screening_type": "string - TRANSACTION/ONBOARDING/BATCH_RESCAN",
  "names_to_screen": [
    {
      "role": "string - PAYER/PAYEE/BENEFICIARY",
      "name": "string - 原始名称",
      "country": "string - 国家/地区代码",
      "id_number": "string - 证件号码（如有）"
    }
  ],
  "transaction_id": "string - 关联交易ID（如有）"
}
```

## 输出规格
```json
{
  "screening_result": "string - CLEAR/EXACT_MATCH/FUZZY_MATCH",
  "matches": [
    {
      "list_source": "string - OFAC/UN/EU/CN_TERROR",
      "listed_name": "string - 名单中的名称",
      "match_score": "number - 匹配得分(0-100)",
      "match_type": "string - EXACT/FUZZY",
      "algorithm": "string - 匹配算法",
      "listed_reason": "string - 制裁原因",
      "list_date": "date - 列入日期"
    }
  ],
  "recommended_action": "string - FREEZE/HOLD/RELEASE",
  "screening_timestamp": "ISO8601"
}
```

## 最佳实践
- 制裁名单应存储在高性能内存数据库中，确保筛查延迟≤20ms
- 建立本机构的白名单机制，对反复误报的合法客户名称免除重复人工确认
- 模糊匹配阈值应定期校准（季度），平衡检出率和误报率
- 制裁名单更新应有紧急通道（如OFAC紧急新增），30分钟内全量生效

## 约束条件
- 筛查覆盖率100%，不得存在任何绕过路径
- 精确匹配命中后不得在未经合规官审批的情况下释放交易
- 制裁名单更新生效时间≤30分钟
- 所有筛查记录保留≥5年
- 名单更新后24小时内完成全量存量客户回扫
