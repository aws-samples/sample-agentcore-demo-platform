# 行为模式识别 (Behavior Pattern Recognition)

## 概述

本技能负责从用户的历史设备操作记录中识别出重复性行为模式（作息规律、习惯偏好、条件反应），将零散的操作日志转化为结构化的行为模式描述。这是偏好模型构建的核心数据挖掘环节，识别出的模式直接用于预测用户在特定条件下的期望行为。

## 适用场景

- 从操作日志中提取用户作息时间模式（起床/出门/回家/睡觉）
- 识别条件-行为关联模式（如"天黑了→开客厅灯"）
- 发现周期性行为模式（工作日 vs 周末差异）
- 检测行为模式变化（习惯改变的早期信号）

## 执行步骤

### 1. 操作日志预处理
- 收集原始操作日志：时间戳 + 操作者身份 + 目标设备 + 操作动作 + 参数值
- 过滤系统自动操作（标记为system_triggered的操作不计入用户行为）
- 过滤误操作（操作后30秒内反向操作视为误触发，不纳入模式分析）
- 按用户身份分组（基于声纹/人脸/手机标识）
- 补充环境上下文标注：每条操作附加当时的环境状态快照

### 2. 时间模式挖掘
- **作息时间识别**：
  - 起床时间：首次开灯/关闹钟/开窗帘的时间聚类
  - 出门时间：连续关灯+门锁关闭的时间模式
  - 回家时间：门锁开启+开灯的时间模式
  - 睡觉时间：最后关灯/开启睡眠模式的时间聚类
- **模式稳定性评估**：用变异系数(CV)评估时间模式的稳定程度
  - CV < 0.1：高度规律，可高置信度预测
  - CV 0.1-0.3：较规律，中等置信度
  - CV > 0.3：不规律，低置信度

### 3. 条件-行为关联挖掘
- 使用关联规则挖掘（支持度>5%，置信度>70%）发现：
  - 环境触发模式："当室外温度>30°C 且 回到家 → 开空调制冷26°C"
  - 时间触发模式："每天22:00±15min → 关闭客厅灯 + 开卧室小夜灯"
  - 事件触发模式："有人进入书房 → 开书房灯 + 开书房空调"
- 计算每条规则的支持度（发生频率）和置信度（条件满足时执行的概率）

### 4. 周期性差异分析
- 区分工作日模式和周末模式（通过日历标记或自动检测）
- 识别季节性模式差异（夏季空调使用 vs 冬季暖气使用）
- 检测特殊日期模式（如节假日模式可能接近周末但有独特偏好）

### 5. 模式变化检测
- 使用CUSUM（累积和）或Page-Hinkley测试检测行为模式的突变点
- 突变可能原因：家庭成员变化/季节更替/设备更换/生活方式改变
- 检测到突变后：标记旧模式为"可能过时"，增加新数据的权重

## 输入规格

```json
{
  "user_id": "user_001",
  "operation_logs": [
    {
      "timestamp": "2024-01-15T07:02:00+08:00",
      "device": "bedroom_curtain",
      "action": "open",
      "params": {"percentage": 100},
      "trigger_source": "manual",
      "environment_snapshot": {
        "outdoor_light": "dawn",
        "temperature": 5,
        "day_type": "workday"
      }
    }
  ],
  "analysis_window": "30days",
  "min_support": 0.05,
  "min_confidence": 0.7
}
```

## 输出规格

```json
{
  "user_id": "user_001",
  "patterns": {
    "routine": {
      "wakeup": {"time_mean": "07:05", "time_std": "12min", "stability": "high", "confidence": 0.92},
      "leave_home": {"time_mean": "08:30", "time_std": "20min", "stability": "medium", "confidence": 0.78},
      "arrive_home": {"time_mean": "18:45", "time_std": "35min", "stability": "medium", "confidence": 0.72},
      "sleep": {"time_mean": "23:15", "time_std": "25min", "stability": "medium", "confidence": 0.80}
    },
    "conditional_rules": [
      {
        "condition": {"outdoor_temp": ">30", "event": "arrive_home"},
        "action": {"device": "living_room_ac", "operation": "cool", "temp": 26},
        "support": 0.15,
        "confidence": 0.88,
        "sample_count": 18
      }
    ],
    "weekday_weekend_diff": {
      "wakeup_diff": "+95min_on_weekend",
      "activity_level_diff": "weekend_30%_less_device_ops"
    }
  },
  "pattern_stability": "stable",
  "last_change_detected": null
}
```

## 最佳实践

- 至少累积7天完整数据才开始模式挖掘，14天以上结果更可靠
- 对于新发现的模式，不立即应用于预测，需观察3次以上重复才确认
- 优先识别高频率+高规律性的模式（这些模式对用户体验影响最大）
- 保留模式的时间演化历史，支持季节性模式的年度回溯

## 约束条件

- 模式挖掘在本地执行，操作日志不上传云端
- 分析结果仅输出抽象的模式描述，不暴露具体操作时间戳（隐私保护）
- 单次模式分析计算时间<30秒（30天数据窗口）
- 存储限制：每用户保留最多90天原始操作日志
