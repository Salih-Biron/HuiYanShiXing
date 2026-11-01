import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np

from backend.inference_service import InferenceService, ServiceConfig


class _Capture:
    def __init__(self, frames):
        self.frames = list(frames)
        self.index = 0

    def isOpened(self):
        return True

    def get(self, prop):
        return {cv2.CAP_PROP_FPS: 10.0, cv2.CAP_PROP_FRAME_WIDTH: 32,
                cv2.CAP_PROP_FRAME_HEIGHT: 24, cv2.CAP_PROP_FRAME_COUNT: len(self.frames)}.get(prop, 0)

    def grab(self):
        return self.index < len(self.frames)

    def retrieve(self):
        frame = self.frames[self.index]
        self.index += 1
        return True, frame

    def release(self):
        return None


class VideoArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix="video-artifacts-")
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)

    def run_detection(self, outcomes):
        root = self.root
        config = ServiceConfig.from_env()
        config = config.__class__(**{
            **config.__dict__, "upload_dir": root / "uploads",
            "api_output_dir": root / "results", "video_frame_stride": 1,
            "video_event_gap_sec": 0, "video_alert_interval": 1,
        })
        service = InferenceService(config)
        service._loaded = True
        frames = [np.zeros((24, 32, 3), dtype=np.uint8) for _ in outcomes]
        capture = _Capture(frames)
        with patch("backend.inference_service.cv2.VideoCapture", return_value=capture), \
             patch("backend.inference_service.cv2.VideoWriter", side_effect=AssertionError("VideoWriter must not be used")), \
             patch("backend.inference_service.encode_browser_video", side_effect=AssertionError("encoder must not be used")), \
             patch("backend.inference_service.extract_video_clip", side_effect=AssertionError("clip extractor must not be used")), \
             patch.object(service, "_detect_frame", side_effect=outcomes):
            return service._detect_video_sync("task", "input.mp4", b"source video")

    def outcome(self, alert):
        return {
            "pipeline_mode": "yolo_only", "best_fall": None,
            "alert": alert, "risk_level": "FALL ALERT" if alert else "NORMAL",
            "display_detections": [], "pose_event": None,
        }

    def test_no_events_keeps_upload_and_zero_clip_artifacts(self):
        payload = self.run_detection([self.outcome(False), self.outcome(False)])
        self.assertEqual(payload["alert_timeline"], [])
        self.assertEqual(payload["event_clip_count"], 0)
        self.assertEqual(payload["event_clip_error_count"], 0)
        self.assertEqual(payload["api_files"]["output_video"], "")
        self.assertEqual(payload["api_files"]["event_clips"], [])
        self.assertTrue(Path(payload["source"]).is_file())

    def test_multiple_events_keep_stable_ids_and_snapshots(self):
        outcomes = [self.outcome(True), self.outcome(False), self.outcome(True)]
        payload = self.run_detection(outcomes)
        self.assertEqual([event["event_id"] for event in payload["alert_timeline"]], ["fall_001", "fall_002"])
        self.assertTrue(all(event["event_video"] == "" for event in payload["alert_timeline"]))
        self.assertTrue(all(event["alert_image"] for event in payload["alert_timeline"]))
        self.assertEqual(payload["event_clip_count"], 0)
        self.assertEqual(payload["event_clip_error_count"], 0)
        self.assertTrue(Path(payload["source"]).exists())
        self.assertTrue(all(event["alert_image"].startswith("/api/result/task/alerts/") for event in payload["alert_timeline"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
