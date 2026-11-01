# 项目结构

以根目录 README 为部署入口。

- backend：API、推理、时间工具及现有测试。
- fronted：页面源码、静态演示资源与锁定依赖。
- configs/rtmo：通过 MMPOSE_ROOT 定位上游配置。
- scripts：启动、训练、转换、离线推理。
- requirements*.txt：基础、开发和可选姿态依赖。
- docs/MODELS.json：当前模型来源和校验值。

weights、datasets、uploads、outputs、runs 等运行资产由部署者单独准备，不随 Git 分发。
