> 历史说明：可能包含旧路径、旧参数和旧版指标；当前安装、启动与目录以根 README 为准。

# 慧眼视觉安全监测系统

> HuiYan Vision Safety Monitoring System  
> 基于 YOLO + tiled YOLO + RTMO 的视觉安全监测、跌倒识别与告警留存系统

---

## 1. 项目简介

慧眼视觉安全监测系统是一个面向公共安全场景的计算机视觉原型系统，主要用于校园、商场、养老看护、公共区域、施工现场等场景下的异常姿态识别、跌倒检测与安全告警。

系统以 **YOLO 目标检测** 作为主检测分支，负责快速识别画面中的 `fall / standing / other` 等目标类别；针对远景监控、小目标倒地、普通整图检测容易漏检的问题，引入 **tiled YOLO 切片复检机制**；当系统检测到疑似跌倒目标后，根据真实检测框裁剪 ROI，并送入 **RTMO 姿态估计分支** 进行人体关键点分析，最后通过融合模块输出最终风险结果。

当前系统已经完成从命令行检测脚本到云端后端 API 的接入改造，支持前端上传图片，由云端后端调用完整检测流程，并返回检测状态、风险等级、结果图片、告警截图和结构化 JSON 结果。

---

## 2. 项目目标

本项目旨在构建一个完整的视觉安全监测闭环：

```text
视频 / 图片输入
        ↓
视觉感知
        ↓
异常识别
        ↓
风险判断
        ↓
告警输出
        ↓
结果留存
```

系统主要解决以下问题：

1. 传统监控依赖人工查看，容易出现漏看、漏判和响应滞后。
2. 普通目标检测模型对远景、小目标、低分辨率倒地目标容易漏检。
3. 单纯检测框缺少姿态结构解释，难以说明人体姿态风险来源。
4. 安全事件不仅需要识别，还需要保存截图、日志和结构化记录，便于后续追溯。

---

## 3. 系统核心能力

当前系统已实现以下功能：

- 图片跌倒检测
- 视频逐帧检测
- YOLO 主检测
- tiled YOLO 小目标切片复检
- RTMO 姿态估计
- 基于 YOLO 检测框的 ROI 裁剪
- RTMO 姿态结果坐标映射回原图
- YOLO 与 RTMO 结果融合
- `FALL_ALERT / POSE_WARNING / NORMAL` 风险输出
- 告警截图保存
- 检测结果图片保存
- CSV 日志保存
- JSON 事件输出
- FastAPI 云端后端接口
- 前端上传图片并展示检测结果

---

## 4. 技术路线

系统整体流程如下：

```text
图片 / 视频输入
        ↓
普通 YOLO 检测
        ↓
是否检测到 fall？
        ↓
是 ───────────────→ 生成 YOLO 事件
        ↓ 否
tiled YOLO 切片复检
        ↓
生成真实检测框 bbox
        ↓
根据 bbox 裁剪 ROI
        ↓
RTMO 姿态估计
        ↓
姿态事件转换
        ↓
YOLO + RTMO 融合判断
        ↓
FALL_ALERT / POSE_WARNING / NORMAL
        ↓
结果图 / 告警截图 / JSON / CSV 日志
```

---

## 5. 模型分支说明

### 5.1 YOLO 主检测分支

YOLO 是系统的主检测模型，负责对输入图片或视频帧进行目标检测，输出：

- 目标类别
- 检测框 bbox
- 置信度 confidence
- 检测状态

当前类别包括：

```text
0: fall
1: standing
2: other
```

YOLO 分支主要负责快速判断画面中是否存在明显跌倒目标。

---

### 5.2 tiled YOLO 小目标增强分支

在远景监控场景中，人体目标在整张图中的占比很小，普通 YOLO 在整图缩放后容易漏检。为解决该问题，系统引入 tiled YOLO 切片复检机制。

其基本流程为：

```text
普通 YOLO 未触发 FALL_ALERT
        ↓
将原图按照网格切片
        ↓
对每个局部切片重新进行 YOLO 检测
        ↓
将切片内检测框映射回原图坐标
        ↓
通过 NMS 合并重复框
        ↓
输出小目标 fall 候选框
```

tiled YOLO 主要用于增强：

- 远景倒地目标
- 小尺寸人体目标
- 商场 / 校园大厅等大视野监控画面
- 普通 YOLO 首轮漏检的图片样本

---

### 5.3 RTMO 姿态估计分支

RTMO 是人体姿态估计模型，负责输出人体关键点和骨架结构。

需要注意：

> RTMO 本身不是跌倒分类模型，不直接输出“跌倒”类别。  
> 在本项目中，RTMO 用于姿态辅助解释和结果补充。

系统使用 YOLO 或 tiled YOLO 产生的真实检测框裁剪 ROI，然后将 ROI 输入 RTMO。RTMO 输出姿态结果后，再通过坐标偏移映射回原图坐标系。

RTMO 分支主要提供：

- 人体关键点
- 姿态质量
- 是否存在水平姿态
- 人体骨架结构辅助解释
- ROI 坐标映射结果

---

### 5.4 融合判断分支

融合模块负责整合 YOLO 检测事件与 RTMO 姿态事件，输出最终风险判断。

输出结果包括：

```text
FALL_ALERT    高风险跌倒告警
POSE_WARNING  姿态风险提示
NORMAL        正常状态
```

当前系统中，YOLO / tiled YOLO 是主要告警依据，RTMO 用于姿态辅助和可解释性补充。

---

## 6. 项目目录结构

```text
huiyan_system/
│
├── backend/                         # 云端后端 API 服务
│   └── api_server.py                 # FastAPI 接口入口
│
├── configs/                         # 模型与系统配置
│   ├── rtmo/
│   │   └── rtmo_config.py            # RTMO 配置文件
│   └── system_paths.json             # 系统路径配置文件
│
├── datasets/                        # 数据集目录
│   ├── camera_fall_v2/               # 原始标注数据集
│   └── camera_fall_v2_yolo/          # YOLO 格式数据集
│
├── docs/                            # 项目文档
│   ├── SYSTEM.md                     # 系统设计说明
│   └── PROJECT_STRUCTURE.md          # 项目结构说明
│
├── outputs/                         # 运行输出目录
│   ├── api_results/                  # API 每次检测生成的任务结果
│   ├── alerts/                       # 告警截图
│   ├── crop_temp/                    # ROI 临时裁剪图
│   ├── images/                       # 图片检测结果
│   ├── logs/                         # 运行日志
│   ├── rtmo_current_vis/             # RTMO 可视化结果
│   ├── videos/                       # 视频检测结果
│   └── yolo_finetune/                # YOLO 训练结果和权重
│
├── rtmo_pose_events/                 # 旧流程 RTMO 姿态事件缓存
├── rtmo_pose_results_current/        # 旧流程 RTMO 推理缓存
├── yolo_events/                      # 旧流程 YOLO 事件缓存
│
├── scripts/                          # 核心脚本
│   ├── run_image_pipeline_with_rtmo.py # 图片检测主流程
│   ├── run_video_demo.py              # YOLO / tiled YOLO 检测脚本
│   ├── system_output_fusion.py        # 融合输出脚本
│   ├── rtmo_current_to_event.py       # RTMO 当前结果转姿态事件
│   ├── rtmo_to_pose_events.py         # RTMO 批量结果转姿态事件
│   ├── run_yolo_tiled_image.py        # tiled YOLO 单独测试脚本
│   ├── run_batch_demo.py              # 批量测试脚本
│   ├── build_summary.py               # 汇总统计脚本
│   ├── visualize_system_output.py     # 可视化脚本
│   ├── labelme_to_yolo_v2.py          # Labelme 转 YOLO 脚本
│   └── train_yolo_camera_fall_v2.sh   # YOLO 训练脚本
│
├── test_images/                      # 图片测试样例
├── test_videos/                      # 视频测试样例
│
├── weights/                          # 模型权重
│   ├── rtmo/                         # RTMO 权重
│   └── yolo/                         # YOLO 权重或备用权重
│
└── README.md                         # 项目说明文档
```

更多目录说明可查看：

```text
docs/PROJECT_STRUCTURE.md
```

---

## 7. 环境准备

### 7.1 进入项目目录

```bash
cd /workspace/huiyan_system
```

### 7.2 激活环境

```bash
conda activate huiyan_cv
```

### 7.3 设置 MMPose 路径

```bash
export PYTHONPATH=/workspace/mmpose:$PYTHONPATH
```

### 7.4 安装后端依赖

```bash
pip install fastapi uvicorn python-multipart
```

---

## 8. 模型权重说明

当前推荐使用的 YOLO 权重路径：

```text
outputs/yolo_finetune/camera_fall_v2-2/weights/best.pt
```

RTMO 权重路径：

```text
weights/rtmo/best.pth
```

RTMO 配置文件路径：

```text
configs/rtmo/rtmo_config.py
```

注意：

```text
outputs/yolo_finetune/
weights/rtmo/
weights/yolo/
```

这些目录中可能包含模型权重，不建议删除。

---

## 9. 图片检测主流程

当前推荐使用 `run_image_pipeline_with_rtmo.py` 作为图片检测主入口。

### 9.1 推荐测试命令

```bash
cd /workspace/huiyan_system
conda activate huiyan_cv
export PYTHONPATH=/workspace/mmpose:$PYTHONPATH

python scripts/run_image_pipeline_with_rtmo.py \
  --source test_images/test2.png \
  --weights outputs/yolo_finetune/camera_fall_v2-2/weights/best.pt \
  --horizontal-ratio 0.95 \
  --output-dir outputs/api_results/test2
```

### 9.2 输出目录

运行完成后，会生成：

```text
outputs/api_results/test2/
├── result.json
├── yolo_events.json
├── pose_events.json
├── fusion_result.json
├── images/
├── alerts/
├── crop_temp/
├── rtmo_pose_results/
└── rtmo_vis/
```

其中：

- `result.json` 是前端主要读取的统一结果文件。
- `yolo_events.json` 保存 YOLO / tiled YOLO 的真实检测事件。
- `pose_events.json` 保存 RTMO 姿态事件。
- `fusion_result.json` 保存融合后的最终判断。
- `images/` 保存检测结果图。
- `alerts/` 保存告警截图。
- `crop_temp/` 保存根据检测框裁剪出的 RTMO ROI 图片。

---

## 10. 单独运行 YOLO / tiled YOLO 检测

如果只想测试 YOLO 检测和 tiled YOLO fallback，可以运行：

```bash
python scripts/run_video_demo.py \
  --source test_images/test2.png \
  --weights outputs/yolo_finetune/camera_fall_v2-2/weights/best.pt \
  --fall-threshold 0.25 \
  --tiled-fall-threshold 0.15 \
  --output-dir outputs/api_results/test_yolo \
  --event-output outputs/api_results/test_yolo/yolo_events.json
```

该脚本会输出：

```text
outputs/api_results/test_yolo/
├── images/
├── alerts/
├── logs/
├── yolo_events.json
└── run_video_demo_result.json
```

---

## 11. 单独运行视频检测

```bash
python scripts/run_video_demo.py \
  --source test_videos/demo.mp4 \
  --weights outputs/yolo_finetune/camera_fall_v2-2/weights/best.pt \
  --fall-threshold 0.25 \
  --output-dir outputs/video_test \
  --event-output outputs/video_test/yolo_events.json
```

视频检测会输出：

```text
outputs/video_test/
├── videos/
├── alerts/
├── logs/
├── yolo_events.json
└── run_video_demo_result.json
```

说明：

> 视频检测目前主要以 YOLO 分支为主。  
> tiled YOLO 更适合图片和高分辨率远景图像，视频逐帧启用 tiled YOLO 会带来较大计算开销，后续可继续优化触发策略。

---

## 12. 云端后端 API

当前后端接口文件为：

```text
backend/api_server.py
```

后端使用 FastAPI 实现，负责：

1. 接收前端上传图片。
2. 为每次检测生成唯一 `task_id`。
3. 将上传文件保存到 `uploads/`。
4. 调用 `run_image_pipeline_with_rtmo.py`。
5. 读取 `result.json`。
6. 返回检测状态、风险等级、结果图片路径和告警截图路径。

### 12.1 启动后端

```bash
cd /workspace/huiyan_system
conda activate huiyan_cv
export PYTHONPATH=/workspace/mmpose:$PYTHONPATH

uvicorn backend.api_server:app --host 0.0.0.0 --port 8000
```

启动成功后访问：

```text
http://服务器IP:8000/docs
```

---

### 12.2 健康检查接口

```text
GET /
```

返回示例：

```json
{
  "success": true,
  "message": "Huiyan CV backend is running"
}
```

---

### 12.3 图片检测接口

```text
POST /api/detect/image
```

上传字段名：

```text
file
```

返回示例：

```json
{
  "success": true,
  "task_id": "xxxxxxxx",
  "status": "FALL_ALERT",
  "risk_level": "FALL ALERT",
  "api_files": {
    "result_json": "/api/result/xxxxxxxx/result.json",
    "yolo_events": "/api/result/xxxxxxxx/yolo_events.json",
    "pose_events": "/api/result/xxxxxxxx/pose_events.json",
    "fusion_result": "/api/result/xxxxxxxx/fusion_result.json",
    "result_image": "/api/result/xxxxxxxx/images/xxx_result.jpg",
    "alert_image": "/api/result/xxxxxxxx/alerts/xxx_alert.jpg"
  }
}
```

---

## 13. 前端接入说明

前端上传图片时，使用 `FormData`：

```javascript
async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("http://服务器IP:8000/api/detect/image", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  return data;
}
```

展示结果图片：

```javascript
const baseUrl = "http://服务器IP:8000";
const resultImageUrl = baseUrl + data.api_files.result_image;
const alertImageUrl = baseUrl + data.api_files.alert_image;
```

前端可展示的核心字段：

```text
status
risk_level
best_yolo_event.confidence
best_yolo_event.bbox
api_files.result_image
api_files.alert_image
api_files.result_json
```

---

## 14. 输出文件说明

### 14.1 result.json

前端主要读取的统一结果文件。

示例：

```json
{
  "success": true,
  "source": "/workspace/huiyan_system/test_images/test2.png",
  "status": "FALL_ALERT",
  "risk_level": "FALL ALERT",
  "cascaded": true,
  "best_yolo_event": {
    "source": "/workspace/huiyan_system/test_images/test2.png",
    "frame": 0,
    "event": "FALL",
    "confidence": 0.9027,
    "bbox": [1132, 704, 1385, 824],
    "risk_level": "FALL ALERT"
  },
  "files": {
    "output_dir": "...",
    "yolo_events": "...",
    "rtmo_events": "...",
    "fusion_output": "...",
    "rtmo_source": "..."
  },
  "fusion": {}
}
```

---

### 14.2 yolo_events.json

保存 YOLO 或 tiled YOLO 的真实检测事件。

示例：

```json
[
  {
    "source": "/workspace/huiyan_system/test_images/test2.png",
    "frame": 0,
    "event": "FALL",
    "confidence": 0.9027,
    "bbox": [1132, 704, 1385, 824],
    "risk_level": "FALL ALERT",
    "alert_image": "...",
    "detector_status": "FALL_ALERT"
  }
]
```

---

### 14.3 pose_events.json

保存 RTMO 姿态事件。

主要包含：

- 姿态风险等级
- 人体 bbox
- 姿态质量
- 是否检测到水平姿态
- ROI 坐标偏移
- 原图坐标映射结果

---

### 14.4 fusion_result.json

保存融合结果。

主要包含：

- YOLO 事件数量
- RTMO 事件数量
- 最终事件数量
- 最终判断
- 风险等级
- 融合原因
- 按输入源汇总的统计结果

---

## 15. 当前测试样例说明

建议保留以下测试样例，用于答辩或演示：

```text
test_images/test1.png    低姿态边界样例
test_images/test2.png    远景小目标跌倒样例
test_images/test3.png    明显跌倒样例
```

推荐演示顺序：

```text
1. 展示普通图片检测
2. 展示远景小目标样例
3. 说明普通 YOLO / tiled YOLO 的作用
4. 展示 RTMO ROI 裁剪和姿态估计结果
5. 展示 result.json、告警截图和结果图
```

---

## 16. 目录清理建议

以下目录中的文件属于运行结果或中间缓存，可以定期清空，但建议保留目录本身：

```text
outputs/api_results/*
outputs/alerts/*
outputs/crop_temp/*
outputs/images/*
outputs/logs/*
outputs/rtmo_current_vis/*
outputs/videos/*
rtmo_pose_events/*
rtmo_pose_results_current/*
yolo_events/*
runs/*
```

推荐清理命令：

```bash
cd /workspace/huiyan_system

rm -rf outputs/api_results/*
rm -rf outputs/alerts/*
rm -rf outputs/crop_temp/*
rm -rf outputs/images/*
rm -rf outputs/logs/*
rm -rf outputs/rtmo_current_vis/*
rm -rf outputs/videos/*

rm -rf rtmo_pose_events/*
rm -rf rtmo_pose_results_current/*
rm -rf yolo_events/*
rm -rf runs/*

mkdir -p outputs/api_results outputs/alerts outputs/crop_temp outputs/images outputs/logs outputs/rtmo_current_vis outputs/videos
mkdir -p rtmo_pose_events rtmo_pose_results_current yolo_events
```

不要删除以下目录：

```text
backend/
configs/
scripts/
weights/
outputs/yolo_finetune/
datasets/
test_images/
README.md
docs/
```

尤其不要删除：

```text
outputs/yolo_finetune/
weights/rtmo/
weights/yolo/
```

这些目录中可能包含训练权重和模型文件。

---

## 17. 当前项目状态

当前已完成：

- YOLO 跌倒检测
- tiled YOLO 小目标切片复检
- RTMO 姿态估计
- YOLO 检测框驱动 RTMO ROI 裁剪
- RTMO 结果坐标映射回原图
- YOLO + RTMO 融合输出
- `result.json` 结构化结果输出
- 告警截图和检测结果图保存
- FastAPI 后端接口接入
- 前端可通过 API 调用云端检测流程

---

## 18. 已知限制

当前系统仍处于原型验证和工程展示阶段，存在以下限制：

1. 数据集规模仍需继续扩充。
2. 对坐地、蹲伏、弯腰、半倒地等相似姿态仍可能存在误报。
3. RTMO 是姿态估计模型，不直接判断跌倒。
4. 视频流中如果逐帧启用 tiled YOLO，计算开销较大。
5. 多人遮挡、低光照、复杂背景等场景仍需要更多测试。
6. 当前后端主要支持图片检测接口，视频接口可作为后续扩展。

---

## 19. 后续优化方向

后续可从以下方向继续完善：

1. **数据层面**
   - 扩充真实监控数据。
   - 增加坐地、弯腰、蹲伏、遮挡、低光照样本。
   - 建立困难样本回测机制。

2. **模型层面**
   - 优化小目标检测能力。
   - 优化误报控制。
   - 引入更多姿态规则或轻量分类器辅助判断。

3. **系统层面**
   - 完善视频检测 API。
   - 增加任务队列和异步处理。
   - 增加告警历史记录和数据库持久化。
   - 优化 tiled YOLO 的触发策略，降低计算开销。

4. **前端平台层面**
   - 完善实时监控页面。
   - 增加告警事件管理。
   - 增加日志统计和图表展示。
   - 增加处理状态跟踪。

---

## 20. 答辩说明口径

推荐表述：

```text
本项目不是单一 YOLO 跌倒检测系统，而是一个基于 YOLO、tiled YOLO 和 RTMO 的多分支视觉安全监测系统。

YOLO 负责快速检测 fall、standing、other 等目标类别；
tiled YOLO 用于解决远景监控中小目标跌倒容易漏检的问题；
RTMO 不直接判断跌倒，而是输出人体关键点和骨架结构，用于姿态辅助解释；
最终系统通过融合模块输出 FALL_ALERT、POSE_WARNING 或 NORMAL，并保存告警截图、检测结果和结构化日志。
```

---

## 21. 项目总结

慧眼视觉安全监测系统围绕公共安全场景下的跌倒识别与异常姿态告警问题，构建了一个从视觉输入、目标检测、姿态估计、融合判断到结果留存的完整后端原型系统。

系统当前的核心技术路线为：

```text
YOLO 主检测
+ tiled YOLO 小目标补检
+ RTMO 姿态辅助
+ 融合决策
+ 结构化告警输出
```

当前系统已经能够完成图片输入下的完整检测闭环，并支持前端通过 FastAPI 接口调用云端后端检测服务。后续将继续围绕数据扩充、误报控制、视频实时性、前端平台化和告警管理进行优化。