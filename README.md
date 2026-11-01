# 慧眼识行 HuiYanShiXing

基于 YOLO 与 RTMO 的跌倒检测项目，包含 React 管理界面、FastAPI 推理接口、图片与视频检测、告警复核和统计功能。部分管理页面使用前端演示数据；界面设置不代表已实现服务器鉴权或通知服务。

## 目录

- `backend/`：API、推理服务和回归测试。
- `fronted/`：React + TypeScript + Vite 前端，保留原项目目录拼写。
- `scripts/`：启动、数据转换、训练及离线推理工具。
- `configs/rtmo/`：RTMO 配置。
- `docs/`：项目说明。

权重、数据集、用户上传文件、检测结果、训练输出和本地环境文件不纳入 Git。`fronted/public/` 中的静态图片和视频用于原有页面演示，不是用户上传目录。

## 后端环境

建议沿用原项目 Python 3.9.25 的 `huiyan_cv` 环境。已有环境记录的 PyTorch 为 `2.1.2+cu118`、MMCV 为 `2.1.0`。这些是原环境版本记录，不代表任意平台均已验证。CUDA、PyTorch 与 MMCV 二进制必须兼容。

```bash
conda create -n huiyan_cv python=3.9 -y
conda activate huiyan_cv
python -m pip install torch==2.1.2 torchvision==0.16.2 --index-url https://download.pytorch.org/whl/cu118
python -m pip install -r requirements.txt
```

RTMO 是可选组件。需要姿态推理时，另行准备 MMPose 源码、匹配 PyTorch/CUDA 的 `mmcv==2.1.0` 及 `requirements-pose.txt`，设置 `MMPOSE_ROOT` 指向源码目录。默认查找本仓库同级的 `mmpose` 目录。模型缺失时 API 可启动，但检测接口不能据此视为可用。

## 模型准备

模型不随源码分发。将已训练模型放置为：

```text
weights/yolo/best.pt
weights/rtmo/best.pth
```

本次整理对应的新 YOLO 为 `camera_fall_450_yolov8s/weights/best.pt`。不要把旧默认权重误当作该版本；来源、文件大小及 SHA-256 见 `docs/MODELS.json`。也可以通过 `YOLO_WEIGHTS` 指向原始文件，无需复制。RTMO 沿用原有权重。

```bash
cp .env.example .env
# 根据实际路径编辑 .env
bash scripts/start_backend.sh
```

后端默认监听 8000。根路径和 `/api/` 返回状态，`/docs` 提供 API 文档。`HUIYAN_PROJECT_ROOT` 默认是当前代码仓库；原项目的上传文件和输出目录不会被自动读取。配置读取的是环境变量，启动脚本负责加载 `.env`。

## 前端

```bash
cd fronted
npm ci
npm run dev
```

开发服务使用 3000 端口，`/api` 代理至本机 8000。构建执行 `npm run build`；正式部署需另行配置 `/api` 反向代理。

## 回归检查

```bash
python -m pip install -r requirements-dev.txt
python -m unittest discover -s backend -p 'test_*.py'
cd fronted
npm run lint
npm run build
```

后端现有测试使用模拟推理，不衡量真实权重准确率。新旧模型尚未完成统一独立测试集对比，不能用不同验证集的指标宣称全面提升。

## 训练和离线工具

`bash scripts/train_yolo_camera_fall_v2.sh` 延续旧版 v2 训练流程，可用 `YOLO_DATA`、`YOLO_MODEL`、`YOLO_EPOCHS` 覆盖输入。它不是新版 450 张数据训练的复现配方。其他脚本使用前先查看参数，并自行准备数据与权重。

## 部署边界与许可

当前代码用于研究和演示，公开服务前需要配置鉴权、CORS、资源限制及数据保护。MIT 许可文件保留原仓库内容；第三方模型、依赖和演示素材的许可需分别遵守，本仓库许可证不替代其授权。
