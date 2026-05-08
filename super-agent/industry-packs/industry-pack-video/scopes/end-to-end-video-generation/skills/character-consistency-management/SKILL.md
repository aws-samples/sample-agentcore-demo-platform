# 人物一致性管理 (Character Consistency Management)

## 概述
建立和维护角色视觉参数库，确保同一角色在不同分镜、不同场景中的外貌特征保持高度一致。人物一致性是AI短剧生产中最大的技术挑战之一，跨分镜一致性评分需达到>=0.85才算合格。该技能通过参数锁定、锚点设计和一致性验证三重机制实现目标。

## 适用场景
- 新角色的参数库初始化建立
- 跨分镜一致性评分不达标时的参数优化
- 角色换装/换发型等有意变化的参数更新
- 多角色同时出现时的区分度维护

## 执行步骤

### Step 1: 角色基础参数定义
为每个角色建立完整的视觉参数档案：
- **面部特征**：脸型（鹅蛋/方脸/圆脸/心形）、五官描述（眼型/鼻型/唇型）、面部标志性特征（痣/疤/酒窝）
- **发型发色**：长度、卷直、颜色（精确到色号描述）、分线方式
- **肤色**：精确的肤色描述（不使用笼统词汇，使用如"warm ivory"/"golden tan"等精确描述）
- **体型**：身高比例、体型（纤瘦/匀称/壮实）、肩宽比例
- **标志性服装**：默认着装风格和具体款式描述

### Step 2: 一致性锚点设计（>=5个/角色）
选择最具辨识度的特征作为锚点，每个角色至少5个：
- 锚点1：面部最独特特征（如"右眼下方小痣"）
- 锚点2：发型核心特征（如"齐肩直发，中分，深棕色"）
- 锚点3：体型关键参数（如"身材修长，肩窄腰细"）
- 锚点4：服装标志元素（如"总是戴银色圆形耳环"）
- 锚点5：整体气质描述（如"温柔知性气质，微笑时露出浅浅酒窝"）

### Step 3: Prompt模板构建
为每个角色构建标准化的Prompt模板：
- 正面描述模板（必须在每个涉及该角色的Prompt中使用）
- 负面描述模板（排除容易偏离的特征）
- 不同景别下的描述侧重（特写→面部细节；全景→体型服装）
- 不同情绪下的表情参数变体

### Step 4: 跨分镜一致性验证规则
- 定义一致性评分的权重分配（面部50% + 发型20% + 服装15% + 体型15%）
- 设置评分阈值：>=0.85通过，0.75-0.85标记为边缘需复查，<0.75不通过
- 建立不一致问题的常见原因清单和对应修复策略

### Step 5: 参数库版本管理
- 支持角色参数的有意更新（如剧情需要换装）
- 区分"固定参数"（面部/体型，不应变化）和"可变参数"（服装/配饰，可随剧情变化）
- 记录每次参数变更的原因和影响范围

## 输入规范
```json
{
  "character_name": "角色名称",
  "character_description": "剧本中的角色描述文本",
  "reference_images": ["参考图URL（如有）"],
  "story_context": "角色在故事中的定位",
  "style": "real_person|anime|3d_render"
}
```

## 输出规范
```json
{
  "character_id": "CHAR-001",
  "name": "林悦",
  "face_description": "oval face, delicate features, slightly upturned nose, full lips, small beauty mark below right eye",
  "hair": "shoulder-length straight hair, center-parted, deep chestnut brown, silky texture",
  "skin_tone": "fair with warm ivory undertone, smooth and clear complexion",
  "body_type": "slender, 165cm proportions, narrow shoulders, graceful posture",
  "default_outfit": "cream cashmere sweater, high-waisted light gray wide-leg pants, silver round earrings",
  "distinctive_features": ["beauty mark below right eye", "dimples when smiling", "silver round earrings"],
  "consistency_anchors": [
    "beauty mark below right eye - MUST always be present",
    "shoulder-length straight chestnut brown hair, center-parted",
    "slender build with graceful posture",
    "silver round earrings as signature accessory",
    "warm ivory skin tone with clear complexion"
  ],
  "prompt_template": {
    "positive_base": "a young Chinese woman, oval face, beauty mark below right eye, shoulder-length straight chestnut brown hair center-parted, warm ivory skin, slender graceful figure, silver round earrings",
    "negative_base": "curly hair, short hair, blonde hair, dark skin, muscular build, no earrings, tattoos",
    "close_up_additions": "detailed facial features, dimples, clear skin texture",
    "full_body_additions": "165cm proportions, narrow shoulders, cream sweater, gray wide-leg pants"
  },
  "fixed_params": ["face_description", "hair_color", "skin_tone", "body_type", "distinctive_features"],
  "variable_params": ["outfit", "expression", "pose"]
}
```

## 最佳实践
1. **描述用英文**：AI模型对英文描述的理解更精确，参数库统一使用英文
2. **具体胜于抽象**：用"shoulder-length straight chestnut brown hair"而非"好看的头发"
3. **锚点互斥**：确保不同角色的锚点特征有明显差异，避免AI模型混淆
4. **参考图优先**：如果有角色参考图，以参考图为准建立参数库
5. **渐进锁定**：首次生成后确认最终形象，再将参数库锁定

## 约束条件
- 每个角色必须有>=5个一致性锚点
- 参数库建立后，固定参数不允许无理由修改
- 描述文本中不使用主观或模糊词汇（如"漂亮的"/"一般的"）
- 不同角色之间的关键锚点不得重复
