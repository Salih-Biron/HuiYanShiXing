> 历史说明：可能包含旧路径、旧参数和旧版指标；当前安装、启动与目录以根 README 为准。

# Huiyan Vision System

## Overview

This directory contains the system integration layer of the project.

The project currently contains two model branches:

1. RTMO pose estimation branch
2. YOLO fall detection branch

The system layer is responsible for converting model outputs into unified JSON outputs for downstream usage.

## Project Structure

```text
/workspace/mmpose
  RTMO pose estimation branch

/workspace/behavior
  YOLO fall detection branch

/workspace/huiyan_system
  system integration and unified output layer
