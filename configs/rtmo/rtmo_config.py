import os

_base_ = [os.path.join(os.environ.get("MMPOSE_ROOT", os.path.abspath(os.path.join(os.getcwd(), "../mmpose"))), "configs/body_2d_keypoint/rtmo/coco/rtmo-m_16xb16-600e_coco-640x640.py")]
