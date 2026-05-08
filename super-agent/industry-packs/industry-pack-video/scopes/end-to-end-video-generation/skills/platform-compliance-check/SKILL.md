# 平台合规检查 (Platform Compliance Check)

## 概述
对生成的剧本内容进行目标平台的合规性审核，确保内容符合各短视频平台（抖音/快手/YouTube Shorts）的内容审核标准、社区规范和推荐算法偏好。该技能在剧本生成后立即执行，是内容进入下游生产环节前的必要门禁。

## 适用场景
- 新生成剧本的合规预审
- 剧本修改后的重新合规检查
- 跨平台适配时的差异化合规验证
- 敏感题材的风险评估

## 执行步骤

### Step 1: 平台规范加载
- 加载目标平台的最新内容审核规范
- 识别平台特有的敏感词库和禁忌规则
- 加载行业监管政策（如广电总局相关规定）

### Step 2: 内容安全扫描
- 政治敏感：涉及国家领导人、重大政治事件、领土争议等
- 暴力血腥：过度暴力描写、血腥画面暗示、自残/自杀引导
- 色情低俗：性暗示、裸露描写、低俗擦边
- 未成年人保护：涉及未成年人的不当内容
- 违法违规：涉及毒品/赌博/诈骗等违法行为的美化

### Step 3: 平台差异化检查
- **抖音特有规则**：不得出现竞品品牌；不得引导关注站外；字幕必须为简体中文
- **快手特有规则**：注重正能量导向；避免炫富内容；方言需配字幕
- **YouTube Shorts特有规则**：符合COPPA儿童保护法；避免misleading内容；尊重版权声明

### Step 4: 结构合规验证
- 视频时长是否符合平台限制（抖音≤3分钟，YouTube Shorts≤60秒等）
- 是否包含必要的合规声明（如虚构故事声明）
- 是否存在诱导性内容（诱导点赞/关注/消费）

### Step 5: 风险评级与输出
- 为每个发现的问题分配风险等级（高危/中危/低危）
- 高危问题：必须修改，否则不可进入下游流程
- 中危问题：建议修改，可能影响推荐但不会被下架
- 低危问题：可选修改，轻微影响推荐权重

## 输入规范
```json
{
  "script": "结构化剧本JSON对象",
  "target_platform": "douyin|kuaishou|youtube_shorts",
  "content_category": "drama|comedy|education|advertisement",
  "target_audience": "general|youth|adult"
}
```

## 输出规范
```json
{
  "compliance_result": "pass|conditional_pass|fail",
  "overall_risk_level": "low|medium|high|critical",
  "issues": [
    {
      "issue_id": "C001",
      "severity": "high|medium|low",
      "category": "violence|sexual|political|minor_protection|illegal|platform_specific",
      "location": "scene_id或dialogue具体位置",
      "description": "具体问题描述",
      "suggestion": "修改建议"
    }
  ],
  "platform_specific_notes": "平台特殊注意事项",
  "recommendation": "通过/修改后重新提交/建议更换题材"
}
```

## 最佳实践
1. **宁严勿松**：合规检查应偏保守，宁可误判为风险也不要放过潜在违规
2. **上下文理解**：同一句台词在不同上下文中的合规性可能不同，需结合情节判断
3. **持续更新**：平台规则经常变化，需要定期同步最新审核标准
4. **分平台输出**：同一内容在不同平台的合规结果可能不同，需分别出具报告

## 约束条件
- 合规检查延迟<30秒（不应成为流程瓶颈）
- 高危问题的检出率>99%（零容忍漏放）
- 误报率<10%（避免过度拦截导致效率下降）
- 检查结果必须附带可操作的修改建议
