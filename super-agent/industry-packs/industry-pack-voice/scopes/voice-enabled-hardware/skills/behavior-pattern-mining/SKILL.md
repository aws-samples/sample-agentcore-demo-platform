# 行为模式挖掘 (Behavior Pattern Mining)

## 概述

行为模式挖掘技能从用户的设备操作历史中自动发现重复性的行为模式，包括时间规律、操作序列、环境触发条件等。这些挖掘到的模式是个性化学习和场景自动建议的数据基础，使系统能够从被动响应指令向主动预测需求演进。

## 适用场景

- 时间规律发现：每天固定时间执行的操作（如每晚22:30关灯）
- 操作序列发现：经常连续执行的多个操作（如开灯→调亮度→调色温）
- 事件关联发现：特定事件后必然跟随的操作（如到家后开灯+开空调）
- 周期模式发现：工作日vs周末、季节性的行为差异
- 异常行为检测：偏离日常模式的操作（可能需要关注）

## 执行步骤

### Step 1: 数据采集与预处理
1. 从设备编排Agent获取操作历史记录（最近90天）
2. 数据结构：{timestamp, user_id, device_id, action, parameters, trigger_source, execution_result}
3. 过滤无效数据（执行失败的操作、系统自动重试、测试操作）
4. 按用户ID分组，确保多用户数据隔离

### Step 2: 时间模式分析
1. 对每种操作计算时间分布（按小时分桶统计频率）
2. 检测高频时间点（同一操作在±15分钟窗口内出现>=5次/月）
3. 区分工作日模式和周末模式（分别统计）
4. 输出时间模式候选：{operation, avg_time, std_deviation, confidence, weekday_flag}

### Step 3: 序列模式分析
1. 使用滑动窗口（5分钟）将时间相近的操作组成序列
2. 统计序列出现频率（相同操作序列出现>=5次认为是模式）
3. 计算序列内操作间的平均间隔
4. 判断序列是固定顺序还是集合型（顺序无关但同时出现）

### Step 4: 环境关联分析
1. 将操作记录与同时刻的环境传感器数据关联
2. 计算操作触发与环境变量的相关性（如温度上升→开空调的条件概率）
3. 发现环境阈值触发点（如光照<100lux时用户倾向开灯）
4. 区分真因果关系和时间巧合（需要>10次观察且条件概率>0.7）

### Step 5: 模式评估与输出
1. 对每个候选模式计算可靠度分数：
   - 重复次数：>=5次(基础)、>=10次(可靠)、>=20次(高度可靠)
   - 一致性：std_deviation越小越可靠
   - 最近性：最近30天内是否还在重复
2. 过滤掉可靠度<0.6的候选
3. 输出已确认模式列表，供偏好建模和场景推荐使用

## 输入规格

```json
{
  "user_id": "string",
  "time_range": {
    "start": "ISO8601",
    "end": "ISO8601"
  },
  "operation_logs": [
    {
      "timestamp": "ISO8601",
      "device_id": "string",
      "action": "string",
      "parameters": {},
      "trigger_source": "voice|manual|automation",
      "environment_snapshot": {}
    }
  ],
  "analysis_type": "time|sequence|environment|all"
}
```

## 输出规格

```json
{
  "discovered_patterns": [
    {
      "pattern_id": "string",
      "pattern_type": "time_regular|sequence|env_trigger|periodic",
      "description": "每个工作日22:30左右关闭客厅灯并拉上窗帘",
      "trigger_condition": {
        "time": "22:30±15min",
        "weekday": [1,2,3,4,5],
        "environment": null
      },
      "actions": [
        {"device_id": "light_01", "action": "power_off"},
        {"device_id": "curtain_01", "action": "close"}
      ],
      "statistics": {
        "occurrence_count": 18,
        "first_seen": "2024-01-01",
        "last_seen": "2024-01-28",
        "consistency_score": 0.89
      },
      "confidence": 0.85,
      "suggested_scene_name": "晚间关灯"
    }
  ],
  "anomalies": [
    {
      "timestamp": "ISO8601",
      "description": "用户在凌晨3:00操作空调，偏离日常模式",
      "severity": "low"
    }
  ]
}
```

## 最佳实践

- 模式发现采用保守策略，宁可漏发现不可误发现（避免将偶发行为误判为模式）
- 模式需要有"时效性"检查：超过30天未重复的历史模式应降低权重或标记为"疑似过期"
- 季节变化时（春→夏、秋→冬）模式可能自然变化，不应将季节性调整误判为异常
- 新用户冷启动期（前2周）不输出模式建议，仅静默积累数据
- 多用户家庭需要区分个人模式和家庭共同模式（如全家人都会在回家后开灯）

## 约束条件

- 模式分析每日执行一次（凌晨低峰时段），不实时计算
- 单用户最大保留模式数：50个（超出后按可靠度排序淘汰）
- 操作日志保留90天，超期自动清理（隐私合规）
- 模式数据仅在本地设备/账户内使用，不上传云端聚合分析
- 异常检测仅用于系统优化，不主动通知用户（避免隐私敏感）
