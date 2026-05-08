# 跌倒检测与响应

## 概述
本技能通过融合多源传感器数据（AI视觉分析、加速度传感器、人体红外感应、环境声音分析）实现高灵敏度低误报的跌倒检测，并在确认跌倒后立即启动紧急响应流程。这是适老化服务中最关键的安全技能，直接关系老人的生命安全。

## 适用场景
- 老人在家中发生跌倒事件
- 老人长时间保持异常姿态（如趴在地上）
- 突然失去活动信号（可能晕倒）
- 老人自主触发紧急求助

## 执行步骤

### 步骤1：多源信号采集
- AI摄像头：骨骼关键点检测→跌倒姿态判定（置信度评分）
- 加速度传感器（穿戴设备）：检测急剧加速度变化→自由落体特征匹配
- 人体红外传感器：检测到突然从站立高度消失的活动信号
- 环境声音：检测到冲击声/呼救声特征

### 步骤2：多源融合判定
- 单源触发（仅一个传感器报警）：置信度 = 单源置信度 × 0.7
- 双源触发（两个传感器同时报警）：置信度 = max(置信度) + 0.2
- 三源及以上触发：置信度直接设为 >= 0.95
- 考虑环境因素修正（如老人正在做体操/瑜伽，降低误报）

### 步骤3：语音确认（防误报）
- 检测触发后立即语音询问："请问您还好吗？如果没事请说一声"
- 等待10秒，监听任何语音/动作响应
- 收到明确回应（"没事"/"我自己起来"）→记录事件+取消告警
- 无回应或回应为求助→进入紧急响应

### 步骤4：紧急响应启动
- 立即拨打预设紧急联系人（5秒内发起呼叫）
- 同时拨打120急救电话（如配置启用）
- 开启摄像头实时记录（供急救人员参考）
- 通知所有已配置家属（电话+短信双通道）
- 持续语音安慰老人："别着急，已经帮您联系家人了，请保持不动"

### 步骤5：持续监护
- 无人接听时每2分钟重试
- 记录事件全过程（时间戳/传感器数据/响应记录）
- 生成事件报告供后续分析

## 输入规格
```json
{
  "sensor_data": {
    "camera_ai": {"fall_detected": true, "confidence": 0.88, "body_position": "prone"},
    "accelerometer": {"free_fall_detected": true, "impact_g": 3.2},
    "pir_sensor": {"activity_lost": true, "last_activity_height": "standing"},
    "audio": {"impact_sound": true, "cry_for_help": false}
  },
  "context": {
    "time": "2024-01-15T14:30:00",
    "room": "living_room",
    "scheduled_activity": null,
    "user_profile": {"age": 78, "fall_history": 1, "mobility": "moderate"}
  }
}
```

## 输出规格
```json
{
  "fall_confirmed": true,
  "confidence": 0.93,
  "severity": "emergency",
  "response_actions": [
    {"action": "voice_check", "status": "no_response", "timestamp": "..."},
    {"action": "call_emergency_contact", "target": "李女士(女儿)", "status": "calling"},
    {"action": "call_120", "status": "initiated"},
    {"action": "camera_recording", "status": "active"},
    {"action": "notify_all_family", "status": "sent"}
  ],
  "event_report": {
    "location": "客厅沙发旁",
    "detection_sources": ["camera_ai", "accelerometer", "pir"],
    "response_time_seconds": 12
  }
}
```

## 最佳实践
- 检测灵敏度 >= 95%是刚性要求，宁可误报也不可漏报
- 通过语音确认环节控制误报对家属的影响（真误报不会通知家属）
- 对有跌倒历史的老人提高灵敏度系数
- 定期检查传感器健康状态，确保关键时刻可用
- 误报事件需记录并用于优化检测算法

## 约束条件
- 检测灵敏度 >= 95%（不漏报）
- 误报率 < 10%（含语音确认环节后的最终误报）
- 从检测到发起呼叫 < 15秒（含10秒语音确认等待）
- 紧急呼叫发起成功率必须为100%
- 不可因传感器单点故障导致整体检测失效（需多源冗余）
