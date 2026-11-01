import importlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
from datetime import timedelta
import unittest
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))


class AlertReviewFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="task3-", dir=PROJECT_ROOT)
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name) / "results"
        self.output.mkdir()
        self.environment = {
            "HUIYAN_API_OUTPUT_DIR": str(self.output),
            "HUIYAN_UPLOAD_DIR": str(Path(self.temp.name) / "uploads"),
            "PYTHONDONTWRITEBYTECODE": "1",
        }
        self.env_patch = patch.dict(os.environ, self.environment)
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)
        self.api = importlib.import_module("backend.api_server")
        config_type = type(self.api.service.config)
        service_type = type(self.api.service)
        self.service_patch = patch.object(
            self.api, "service", service_type(config_type.from_env())
        )
        self.service_patch.start()
        self.addCleanup(self.service_patch.stop)
        self.model_patch = patch.object(self.api.service, "load_models", return_value=None)
        self.model_patch.start()
        self.addCleanup(self.model_patch.stop)
        self.client = TestClient(self.api.app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)
        now = self.api.local_now()
        self.payloads = {
            "video-task": {
                "source": "sample.mp4", "source_type": "video",
                "status": "FALL_ALERT", "processed_frames": 120,
                "alert_timeline": [
                    {"event_id": "fall_001", "status": "FALL_ALERT", "frame": 10},
                    {"event_id": "fall_002", "status": "POSE_WARNING", "frame": 80},
                ],
            },
            "image-task": {"source": "sample.jpg", "status": "FALL_ALERT"},
            "normal-task": {"source": "normal.jpg", "status": "NORMAL"},
            "history-task": {
                "source": "history.jpg", "status": "POSE_WARNING",
                "created_at_iso": (now - timedelta(days=1)).isoformat(),
            },
        }
        for task_id, payload in self.payloads.items():
            payload.update(task_id=task_id)
            payload.setdefault("created_at_iso", now.isoformat())
            directory = self.output / task_id
            directory.mkdir()
            (directory / "result.json").write_text(json.dumps(payload), encoding="utf-8")
        self.original_results = {
            path: path.read_bytes() for path in self.output.glob("*/result.json")
        }

    def get(self, path, **params):
        response = self.client.get(path, params=params)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_restart_archives_old_alerts_and_preserves_review_and_statistics(self):
        saved = self.change("video-task:fall_001", "false_positive")
        summary = self.get("/api/stats/summary")
        logs = self.logs()
        trend = self.get("/api/stats/trend")
        self.assertEqual(self.get("/api/alerts", date_scope="today")["total"], 3)
        with TestClient(self.api.app) as restarted:
            self.assertEqual(restarted.get("/api/alerts").json()["total"], 0)
            self.assertEqual(restarted.get("/api/alerts", params={"date_scope": "history"}).json()["total"], 4)
            restored = restarted.get("/api/alerts/video-task:fall_001").json()["data"]
            self.assertIn("archivedAt", restored)
            self.assertEqual({key: restored[key] for key in saved}, saved)
            self.assertEqual(self.get("/api/stats/summary"), summary)
            self.assertEqual(self.logs(), logs)
            self.assertEqual(self.get("/api/stats/trend"), trend)
            directory = self.output / "new-task"
            directory.mkdir()
            (directory / "result.json").write_text(json.dumps({
                "task_id": "new-task", "source": "new.jpg", "source_type": "image",
                "status": "FALL_ALERT", "created_at_iso": self.api.local_now().isoformat(),
            }), encoding="utf-8")
            today = restarted.get("/api/alerts").json()
            self.assertEqual([item["id"] for item in today["data"]], ["new-task:image"])
            self.assertEqual(restarted.get("/api/alerts", params={"date_scope": "all"}).json()["total"], 5)
            self.change("video-task:fall_001", "resolved")
        with TestClient(self.api.app) as restarted:
            self.assertEqual(restarted.get("/api/alerts").json()["total"], 0)
            self.assertEqual(restarted.get("/api/alerts", params={"date_scope": "history"}).json()["total"], 5)
            detail = restarted.get("/api/alerts/video-task:fall_001").json()["data"]
            self.assertEqual(detail["archivedAt"], restored["archivedAt"])
            self.assertEqual(detail["status"], "resolved")
            self.assertEqual(len(detail["history"]), 2)
        for path, original in self.original_results.items():
            self.assertEqual(path.read_bytes(), original)

    def test_archive_failure_rolls_back_and_blocks_startup(self):
        connection = Mock()
        connection.executemany.side_effect = sqlite3.OperationalError("archive failure")
        with patch.object(self.api, "_open_alert_db", return_value=connection):
            with self.assertRaisesRegex(RuntimeError, "Failed to archive"):
                with TestClient(self.api.app):
                    pass
        connection.rollback.assert_called_once()
        connection.commit.assert_not_called()
        connection.close.assert_called_once()
        self.assertEqual(self.get("/api/alerts")["total"], 3)

    def test_video_screenshots_do_not_fall_back_to_another_event(self):
        payload = {
            "task_id": "screenshot-task", "source_type": "video",
            "status": "FALL_ALERT", "api_files": {"alert_image": "alerts/other.jpg"},
            "alert_timeline": [
                {"event_id": "fall_001", "alert_image": "alerts/first.jpg", "frame": 10, "timestamp_sec": 0.4},
                {"event_id": "fall_002", "frame": 80, "timestamp_sec": 3.2},
            ],
        }
        alerts = self.api._payload_alerts(payload)
        self.assertEqual([item["image"] for item in alerts], ["alerts/first.jpg", ""])
        self.assertEqual([item["eventId"] for item in alerts], ["fall_001", "fall_002"])
        self.assertEqual([item["timestampSec"] for item in alerts], [0.4, 3.2])
        image_alert = self.api._payload_alerts({
            "task_id": "image-screenshot", "source_type": "image", "status": "FALL_ALERT",
            "api_files": {"result_image": "result.jpg"},
        })
        self.assertEqual(image_alert[0]["image"], "result.jpg")

    def change(self, alert_id, status):
        response = self.client.patch(
            f"/api/alerts/{alert_id}/status", json={"status": status}
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["data"]

    def logs(self, **params):
        return self.get("/api/detection/logs", date_scope="all", **params)["data"]

    def assert_stage(self, status, count, false_positives, risk, excluded, processed):
        log = next(item for item in self.logs() if item["taskId"] == "video-task")
        self.assertEqual(
            (log["status"], log["alertCount"], log["falsePositiveCount"], log["riskLevel"]),
            (status, count, false_positives, risk),
        )
        self.assertEqual(log["originalAlertCount"], 2)
        self.assertEqual(log["rawStatus"], "FALL_ALERT")
        self.assertEqual([item["excluded"] for item in log["alertTimeline"]], excluded)
        summary = self.get("/api/stats/summary")
        self.assertEqual(summary["todayAlerts"], count + 1)
        self.assertEqual(summary["todayFalsePositives"], false_positives)
        self.assertEqual(summary["processedEvents"], processed)
        self.assertEqual(summary["todayImages"], 2)
        self.assertEqual(summary["todayFrames"], 120)
        trend = self.get("/api/stats/trend")["data"]
        self.assertEqual(trend[-1]["count"], count + 1)
        self.assertEqual(trend[-2]["count"], 1)
        filtered = {item["taskId"] for item in self.logs(status="alert")}
        self.assertEqual("video-task" in filtered, count > 0)
        self.assertEqual(self.get("/api/alerts", date_scope="all")["total"], 4)
        for path, original in self.original_results.items():
            self.assertEqual(path.read_bytes(), original)

    def test_video_false_positive_partial_and_full_restoration(self):
        self.assert_stage("alert", 2, 0, "high", [False, False], 0)
        self.change("video-task:fall_001", "false_positive")
        self.assert_stage("partial_false_positive", 1, 1, "medium", [True, False], 1)
        self.assertEqual(len(self.logs(status="partial_false_positive")), 1)
        self.change("video-task:fall_002", "false_positive")
        self.assert_stage("false_positive", 0, 2, "none", [True, True], 2)
        self.assertEqual(len(self.logs(status="false_positive", risk_level="none")), 1)
        self.change("video-task:fall_001", "resolved")
        self.assert_stage("partial_false_positive", 1, 1, "high", [False, True], 2)
        self.change("video-task:fall_002", "resolved")
        self.assert_stage("alert", 2, 0, "high", [False, False], 2)
        log = next(item for item in self.logs() if item["taskId"] == "video-task")
        self.assertEqual([item["reviewStatus"] for item in log["alertTimeline"]], ["resolved"] * 2)

    def test_image_false_positive_and_restoration(self):
        for state, expected in [
            ("false_positive", ("false_positive", 0, 1, "none", 2)),
            ("resolved", ("alert", 1, 0, "high", 3)),
        ]:
            self.change("image-task:image", state)
            log = next(item for item in self.logs() if item["taskId"] == "image-task")
            self.assertEqual(
                (log["status"], log["alertCount"], log["falsePositiveCount"], log["riskLevel"]),
                expected[:4],
            )
            summary = self.get("/api/stats/summary")
            self.assertEqual(summary["todayAlerts"], expected[4])
            self.assertEqual(summary["todayFalsePositives"], expected[2])
            self.assertEqual(self.get("/api/stats/trend")["data"][-1]["count"], expected[4])
        self.assertEqual(log["rawStatus"], "FALL_ALERT")

    def test_restore_to_pending_and_processing(self):
        for target in ["pending", "processing"]:
            self.change("video-task:fall_001", "false_positive")
            self.change("video-task:fall_001", target)
            self.assert_stage("alert", 2, 0, "high", [False, False], 0)

    def test_history_survives_fresh_process(self):
        alert_id = "video-task:fall_001"
        states = ["processing", "false_positive", "resolved"]
        for status in states:
            saved = self.change(alert_id, status)
        detail = self.get(f"/api/alerts/{alert_id}")["data"]
        self.assertEqual(detail, saved)
        history = detail["history"]
        self.assertEqual([item["from"] for item in history], ["pending"] + states[:-1])
        self.assertEqual([item["to"] for item in history], states)
        self.assertEqual([item["status"] for item in history], states)
        self.assertEqual(detail["updatedAt"], history[-1]["timestamp"])
        for item in history:
            self.assertIsNotNone(self.api._parse_datetime(item["timestamp"]))
        code = (
            "import json; from backend.api_server import _load_alerts; "
            "print(json.dumps(next(a for a in _load_alerts() "
            "if a['id'] == 'video-task:fall_001')))"
        )
        result = subprocess.run(
            [sys.executable, "-B", "-c", code], cwd=PROJECT_ROOT,
            env=os.environ.copy(), text=True, capture_output=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        restored = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertEqual(restored, detail)

    def test_date_filters_and_normal_log(self):
        self.assertEqual(self.get("/api/alerts", date_scope="today")["total"], 3)
        self.assertEqual(self.get("/api/alerts", date_scope="history")["total"], 1)
        self.assertEqual(self.get("/api/detection/logs", date_scope="today")["total"], 3)
        self.assertEqual(self.get("/api/detection/logs", date_scope="history")["total"], 1)
        self.assertEqual(len(self.logs(status="normal")), 1)
        self.assertEqual(self.get("/api/alerts", date_scope="all", source_type="video")["total"], 2)
        self.assertEqual(len(self.logs(search="sample.mp4")), 1)

    def test_invalid_requests_do_not_change_state(self):
        for body in [{}, {"status": "invalid"}, {"status": None}, {"status": 1}]:
            response = self.client.patch("/api/alerts/video-task:fall_001/status", json=body)
            self.assertEqual(response.status_code, 400)
        response = self.client.patch("/api/alerts/missing/status", json={"status": "resolved"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.get("/api/alerts/missing").status_code, 404)
        for path in ["/api/alerts", "/api/detection/logs"]:
            self.assertEqual(self.client.get(path, params={"date_scope": "invalid"}).status_code, 422)
        detail = self.get("/api/alerts/video-task:fall_001")["data"]
        self.assertEqual(detail["status"], "pending")
        self.assertEqual(detail["history"], [])

    def test_write_failure_rolls_back_without_success(self):
        self.api._open_alert_db().close()
        read_connection = sqlite3.connect(
            str(self.api.service.config.api_output_dir / "alert_state.sqlite3"),
            check_same_thread=False,
        )
        read_connection.row_factory = sqlite3.Row
        failing_connection = Mock()
        failing_connection.execute.side_effect = sqlite3.OperationalError("simulated write failure")
        with patch.object(self.api, "_open_alert_db", side_effect=[read_connection, failing_connection]):
            response = self.client.patch(
                "/api/alerts/video-task:fall_001/status", json={"status": "false_positive"}
            )
        self.assertEqual(response.status_code, 500)
        failing_connection.rollback.assert_called_once()
        failing_connection.close.assert_called_once()
        failing_connection.commit.assert_not_called()
        self.assert_stage("alert", 2, 0, "high", [False, False], 0)
        detail = self.get("/api/alerts/video-task:fall_001")["data"]
        self.assertEqual(detail["history"], [])

    def test_database_unavailable_returns_error(self):
        with patch.object(self.api.sqlite3, "connect", side_effect=sqlite3.OperationalError("unavailable")):
            response = self.client.patch(
                "/api/alerts/video-task:fall_001/status", json={"status": "false_positive"}
            )
        self.assertEqual(response.status_code, 500)
        self.assert_stage("alert", 2, 0, "high", [False, False], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
