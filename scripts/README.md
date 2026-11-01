> 历史说明：可能包含旧路径、旧参数和旧版指标；当前安装、启动与目录以根 README 为准。

# scripts 目录说明

## 主流程脚本

- `run_image_pipeline_with_rtmo.py`  
  图片检测主流程。执行 YOLO / tiled YOLO 检测，读取真实检测框，裁剪 ROI，调用 RTMO 姿态估计，并进行融合输出。

- `run_video_demo.py`  
  图片 / 视频 YOLO 检测脚本。支持普通 YOLO 检测、tiled YOLO 切片复检、结果图保存、告警截图、日志和 yolo_events.json 输出。

- `run_system_pipeline.py`  
  系统级流程脚本，保留用于后续统一调度。

## 融合模块

- `system_output_fusion.py`  
  融合 YOLO 检测事件和 RTMO 姿态事件，输出最终 FALL_ALERT / POSE_WARNING / NORMAL 结果。

## RTMO 姿态模块

- `rtmo_current_to_event.py`  
  将当前 RTMO 推理结果转换为姿态事件，并支持 ROI 坐标映射回原图。

- `rtmo_to_pose_events.py`  
  RTMO 姿态结果批量转换脚本。

## YOLO 与数据处理

- `run_yolo_tiled_image.py`  
  tiled YOLO 单独测试脚本，用于验证切片检测效果。

- `labelme_to_yolo_v2.py`  
  将 Labelme 标注转换为 YOLO 训练标签。

- `train_yolo_camera_fall_v2.sh`  
  YOLO 微调训练脚本。

## 工具脚本

- `build_summary.py`  
  汇总检测结果，生成 summary 文件。

- `run_batch_demo.py`  
  批量运行测试样例。

- `visualize_system_output.py`  
  可视化系统输出结果。
