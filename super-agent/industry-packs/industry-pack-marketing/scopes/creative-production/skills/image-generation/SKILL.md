# AI图像生成与产品摄影

## 技能概述
本技能使用AI图像生成技术（Stable Diffusion、DALL-E、Midjourney等）根据创意Brief生成产品摄影图、场景图、广告主图等静态视觉素材。涵盖从prompt构建、参数设置、生成执行到结果自检的完整流程。

## 适用场景
- 产品白底棚拍图生成
- 产品场景化摆拍图（生活方式Lifestyle）
- 广告主图（信息流/Banner/详情页）
- A/B测试视觉变体批量生成
- 不同风格（简约/奢华/活力/科技感）的产品展示图

## 执行步骤

### Step 1: Prompt工程构建
根据创意Brief构建结构化Prompt：
```
Prompt结构 = [主体描述] + [场景/背景] + [光影风格] + [构图指导] + [品质参数]

示例：
"Professional product photography of [产品], placed on [场景描述],
 [光影风格: soft natural lighting / studio lighting / golden hour],
 [构图: centered composition / rule of thirds / diagonal],
 [品质: 8K, ultra detailed, commercial photography, sharp focus]"
```

### Step 2: 参数配置
| 参数 | 说明 | 推荐值 |
|------|------|--------|
| resolution | 输出分辨率 | 2048×2048 或目标尺寸的2x |
| guidance_scale | 提示词遵循度 | 7.5-12（产品图建议10+） |
| steps | 生成步数 | 30-50（品质vs速度平衡） |
| negative_prompt | 排除元素 | AI伪影、模糊、低质量等 |
| seed | 随机种子 | 记录用于复现 |

### Step 3: 品牌色彩控制
- 提取品牌色彩体系（主色调HEX值）
- 在prompt中明确色彩指导
- 使用ControlNet/IP-Adapter等技术控制色彩输出
- 生成后验证色彩偏差（Delta E<5）

### Step 4: 多尺寸适配生成
从一个核心创意生成多尺寸版本：
- 1:1（1080×1080）：社交媒体信息流
- 16:9（1920×1080）：YouTube/横版Banner
- 9:16（1080×1920）：短视频/Story
- 4:5（1080×1350）：Instagram Feed
- 自定义尺寸：根据渠道需求

### Step 5: 生成结果自检
生成后立即进行初步自检：
- [ ] 产品主体清晰、无变形
- [ ] 无明显AI伪影（多余手指、文字乱码等）
- [ ] 背景干净、不抢主体
- [ ] 色彩自然、与品牌调性一致
- [ ] 分辨率达标

不通过则自动调整prompt并重新生成（最多2次自我迭代）。

## 输入规格
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| product_description | String | ✓ | 产品描述 |
| style_direction | String | ✓ | 风格方向 |
| target_dimensions | Array | ✓ | 目标尺寸列表 |
| brand_colors | Object | ✓ | 品牌色彩体系 |
| reference_images | Array | × | 参考图片 |
| variant_config | Object | × | 变体配置 |

## 输出规格
| 字段 | 类型 | 说明 |
|------|------|------|
| generated_image | File | 生成的图片文件 |
| generation_prompt | String | 使用的完整prompt |
| seed_value | Number | 随机种子值 |
| metadata | Object | 元数据（尺寸/格式/生成时间） |
| self_check_result | Object | 自检结果 |

## 最佳实践
1. Negative prompt必须包含：blurry, low quality, distorted, extra fingers, watermark, text artifacts
2. 产品图优先使用真实产品照片作为IP-Adapter参考，提高真实度
3. 背景尽量简洁，留出文案叠加空间
4. 批量生成时保持同一seed基础+微调，确保系列一致性
5. 高端产品使用低饱和度、高级感光影；快消品使用高饱和度、活力感

## 约束与限制
- 单张图片生成时间≤30秒
- 不生成含真人面部的素材（肖像权风险），使用抽象人物或产品特写
- 不使用竞品品牌元素
- 生成图必须是原创的，不得直接复制已有素材
- 分辨率下限2048×2048px
