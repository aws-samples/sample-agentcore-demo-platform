# 对话状态管理 (Dialogue State Management)

## 概述
管理智能语音客服系统中每通通话的完整对话状态机，跟踪对话从建立到结束的全生命周期状态转换，确保对话流程的有序性和可追溯性。

## 适用场景
- 新通话接入时初始化对话状态
- 对话过程中的状态转换判定
- 异常场景（超时、识别失败、用户挂断）的状态降级处理
- 跨会话上下文恢复时的状态重建

## 执行步骤

### 1. 会话初始化
- 接收来电信号，创建新会话实例，分配唯一session_id
- 查询用户24小时内的历史会话，若存在则加载上下文快照
- 初始化状态为 `SESSION_INIT`，启动超时计时器

### 2. 状态机转换
维护以下核心状态节点：
```
SESSION_INIT → GREETING → INTENT_LISTENING → INTENT_CONFIRMED →
TASK_EXECUTING → RESPONSE_DELIVERING → SATISFACTION_CHECK → SESSION_END
```
异常分支状态：
```
INTENT_UNCLEAR（追问中）→ 最多3次 → TRANSFER_HUMAN
EMOTION_ESCALATION（情绪升级）→ TRANSFER_HUMAN
TIMEOUT（超时）→ SESSION_END
BARGE_IN（打断）→ INTENT_LISTENING（回退）
```

### 3. 上下文栈管理
- 维护一个LIFO上下文栈，记录每轮对话的意图、实体、回复
- 支持上下文回溯（用户说"不对，我刚才说的是..."时回退到之前状态）
- 栈深度限制为20轮，超过则压缩早期上下文为摘要

### 4. 会话持久化
- 通话结束时生成会话摘要（关键意图+解决方案+未解决问题）
- 将摘要写入24小时有效的上下文缓存
- 记录最终状态标签用于后续统计分析

## 输入规格
| 字段 | 类型 | 说明 |
|------|------|------|
| session_id | string | 会话唯一标识 |
| event_type | enum | CALL_IN/USER_SPEECH/SYSTEM_RESPONSE/TIMEOUT/HANGUP |
| payload | object | 事件相关数据（转写文本、意图标签等） |
| timestamp | int64 | 事件时间戳（毫秒） |

## 输出规格
| 字段 | 类型 | 说明 |
|------|------|------|
| current_state | enum | 当前对话状态标签 |
| state_history | array | 状态转换历史记录 |
| context_stack | array | 当前上下文栈内容 |
| next_action | string | 下一步建议动作 |
| timeout_remaining | int | 当前状态剩余超时时间(ms) |

## 最佳实践
- 状态转换必须有明确的触发条件和前置校验，禁止跳跃式状态转换
- 每次状态变更都要记录转换原因和时间戳，便于事后审计
- 超时时间按状态差异化设置：意图等待30秒、任务执行60秒、满意度确认15秒
- 打断事件优先级最高，收到打断信号时无论当前状态均立即回退到INTENT_LISTENING

## 约束
- 单次状态转换处理时间<10ms
- 上下文栈序列化大小不超过64KB
- 历史上下文加载延迟<200ms
