# 协议适配 (Protocol Adaptation)

## 概述

本技能负责处理智能家居生态中多种通信协议的适配转换，将统一的控制语义映射到不同协议栈的具体实现。当前智能家居设备使用的主流协议包括WiFi、Zigbee 3.0、BLE Mesh、Matter/Thread，以及各厂商私有协议。本技能确保上层控制逻辑无需关心底层通信细节。

### 适用场景
- WiFi直连设备的HTTP/MQTT指令封装
- Zigbee设备通过网关的ZCL命令转发
- BLE设备的GATT特征值写入
- Matter协议设备的Cluster操作
- 厂商私有云API的调用适配

## 执行步骤

### Step 1: 协议识别与通道选择
1. 根据设备注册信息确定主通信协议
2. 检查协议通道可达性（网关在线/WiFi连通/BLE范围内）
3. 确定通信路径：
   - WiFi设备：设备IP直连 或 云端中转
   - Zigbee设备：Zigbee网关 → 设备短地址
   - BLE设备：BLE代理（手机/网关）→ 设备MAC
   - Matter设备：Matter Controller → Fabric内寻址
4. 不可达时选择备选通道（如WiFi设备断网时尝试本地AP直连）

### Step 2: 消息格式封装
1. **WiFi-MQTT协议**：
   - Topic格式：`home/{home_id}/device/{device_id}/command`
   - Payload：JSON格式 `{"cmd": "set", "params": {"temp": 26}}`
   - QoS级别：控制指令使用QoS 1（至少一次送达）
2. **Zigbee ZCL协议**：
   - Cluster选择（如Thermostat Cluster 0x0201）
   - Attribute写入或Command发送
   - 帧格式：Frame Control + Sequence + Command + Payload
3. **BLE GATT协议**：
   - Service UUID定位
   - Characteristic UUID定位
   - Value编码（字节序、数据类型）
   - Write Request / Write Without Response选择
4. **Matter协议**：
   - Cluster ID + Command ID
   - TLV编码参数
   - Interaction Model（Write/Invoke/Subscribe）

### Step 3: 安全层处理
1. 协议级加密：TLS/DTLS/AES-CCM（按协议要求）
2. 身份认证：Token/Certificate/Network Key
3. 消息完整性：HMAC/MIC校验
4. 防重放：序列号/时间戳/Nonce

### Step 4: 响应解析与标准化
1. 接收设备响应（ACK/Status/Error）
2. 协议特定响应解码为统一格式：
   - `success`：设备确认执行
   - `busy`：设备繁忙，可稍后重试
   - `unsupported`：设备不支持该操作
   - `error`：执行失败 + 错误码
3. 响应时间统计（用于通道质量评估）

## 输入规范

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| device_protocol | enum | 是 | wifi/zigbee/ble/matter/proprietary |
| gateway_info | object | 否 | 网关信息（Zigbee/BLE设备必填） |
| command_semantic | object | 是 | 统一语义格式的控制命令 |
| security_context | object | 是 | 安全上下文（密钥/Token/证书） |

## 输出规范

| 字段 | 类型 | 说明 |
|------|------|------|
| protocol_message | bytes | 实际发送的协议消息 |
| channel_used | string | 使用的通信通道 |
| response | object | 标准化的设备响应 |
| channel_latency_ms | integer | 通道往返延迟 |

## 最佳实践

1. **协议抽象层**：上层业务代码只操作统一语义接口，协议细节完全封装在适配层内
2. **连接复用**：MQTT保持长连接、Zigbee利用网关路由缓存、BLE保持已配对设备连接
3. **降级策略**：云端不可达时自动切换本地直连模式（LAN fallback）
4. **协议版本兼容**：同一协议不同版本（如Zigbee HA/3.0）做向下兼容处理
5. **通道监控**：持续统计各通道的延迟/丢包率，主动切换低质量通道

## 约束条件

- 协议转换处理时间 < 20ms
- 支持至少5种主流通信协议
- 安全层不可跳过或降级
- 连接超时 3秒，发送超时 500ms
- 所有协议消息必须有序列号用于追踪
