import asyncio
from contextlib import contextmanager
import json
import math
import os
import shutil
import subprocess
import tempfile
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import cv2
import numpy as np

try:
    from .time_utils import local_now_iso, local_now_str, local_timezone_name
except ImportError:
    from time_utils import local_now_iso, local_now_str, local_timezone_name


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv", ".wmv", ".webm"}
PRED_KEYS = ("predictions", "predictions_list", "results", "instances")
FALL_KEYWORDS = {"fall", "fallen", "down", "lying", "lie"}
NORMAL_KEYWORDS = {"standing", "stand", "normal", "walk", "walking", "other"}


@contextmanager
def temporary_cwd(path: Path):
    previous = Path.cwd()
    if path.exists():
        os.chdir(path)
    try:
        yield
    finally:
        if path.exists():
            os.chdir(previous)


def is_nonempty_file(path: Path) -> bool:
    try:
        return path.is_file() and path.stat().st_size > 0
    except OSError:
        return False


@dataclass(frozen=True)
class ServiceConfig:
    project_root: Path
    upload_dir: Path
    api_output_dir: Path
    mmpose_root: Path
    yolo_weights: Path
    rtmo_config: Path
    rtmo_weights: Path
    device: str = "cuda:0"
    gpu_concurrency: int = 1
    yolo_imgsz: int = 1280
    yolo_conf: float = 0.25
    yolo_half: bool = True
    yolo_classes: Optional[List[int]] = None
    yolo_max_det: int = 50
    fall_threshold: float = 0.25
    fall_normal_suppression: bool = True
    fall_normal_iou_thr: float = 0.45
    fall_normal_conf_margin: float = 0.02
    fall_min_area_ratio: float = 0.0005
    fall_max_area_ratio: float = 0.45
    fall_min_aspect_ratio: float = 0.08
    fall_vertical_reject_under: float = 0.45
    fall_vertical_ratio: float = 1.35
    rtmo_confirm_enabled: bool = False
    rtmo_confirm_under: float = 0.70
    rtmo_fail_open: bool = True
    draw_min_conf: float = 0.25
    tiled_enabled: bool = True
    tiled_grid: int = 3
    tiled_overlap: float = 0.20
    tiled_conf: float = 0.10
    tiled_imgsz: int = 960
    tiled_fall_threshold: float = 0.25
    tiled_batch: int = 4
    tiled_min_long_side: int = 1280
    tiled_min_short_side: int = 720
    crop_padding: int = 40
    rtmo_bbox_thr: float = 0.05
    rtmo_kpt_thr: float = 0.30
    rtmo_min_area: float = 80.0
    rtmo_min_quality: float = 0.03
    rtmo_horizontal_ratio: float = 0.95
    rtmo_fallback_enabled: bool = False
    camera_rtmo_fallback: bool = True
    require_rtmo: bool = False
    warmup: bool = True
    video_frame_stride: int = 10
    video_alert_interval: int = 30
    video_clip_enabled: bool = True
    video_clip_pre_sec: float = 10.0
    video_clip_post_sec: float = 10.0
    video_event_gap_sec: float = 5.0
    video_max_duration_sec: int = 3600
    video_max_upload_mb: int = 500

    @classmethod
    def from_env(cls) -> "ServiceConfig":
        default_project = Path(__file__).resolve().parents[1]
        project_root = Path(os.getenv("HUIYAN_PROJECT_ROOT", str(default_project))).resolve()

        def path_env(name: str, default: Path) -> Path:
            return Path(os.getenv(name, str(default))).resolve()

        def bool_env(name: str, default: bool) -> bool:
            raw = os.getenv(name)
            if raw is None:
                return default
            return raw.strip().lower() in {"1", "true", "yes", "on"}

        def int_env(name: str, default: int) -> int:
            return int(os.getenv(name, str(default)))

        def float_env(name: str, default: float) -> float:
            return float(os.getenv(name, str(default)))

        classes_raw = os.getenv("HUIYAN_YOLO_CLASSES", "all").strip()
        yolo_classes = None
        if classes_raw and classes_raw.lower() not in {"none", "all", "*"}:
            yolo_classes = [int(item.strip()) for item in classes_raw.split(",") if item.strip()]

        preferred_yolo = project_root / "weights/yolo/best.pt"
        legacy_yolo = project_root / "outputs/yolo_finetune/camera_fall_v2-2/weights/best.pt"
        yolo_default = preferred_yolo
        if not is_nonempty_file(preferred_yolo) and is_nonempty_file(legacy_yolo):
            yolo_default = legacy_yolo

        return cls(
            project_root=project_root,
            upload_dir=path_env("HUIYAN_UPLOAD_DIR", project_root / "uploads"),
            api_output_dir=path_env("HUIYAN_API_OUTPUT_DIR", project_root / "outputs/api_results"),
            mmpose_root=path_env("MMPOSE_ROOT", project_root.parent / "mmpose"),
            yolo_weights=path_env("YOLO_WEIGHTS", yolo_default),
            rtmo_config=path_env("RTMO_CONFIG", project_root / "configs/rtmo/rtmo_config.py"),
            rtmo_weights=path_env("RTMO_WEIGHTS", project_root / "weights/rtmo/best.pth"),
            device=os.getenv("HUIYAN_DEVICE", "cuda:0"),
            gpu_concurrency=max(1, int_env("HUIYAN_GPU_CONCURRENCY", 1)),
            yolo_imgsz=int_env("HUIYAN_YOLO_IMGSZ", 1280),
            yolo_conf=float_env("HUIYAN_YOLO_CONF", 0.25),
            yolo_half=bool_env("HUIYAN_YOLO_HALF", True),
            yolo_classes=yolo_classes,
            yolo_max_det=int_env("HUIYAN_YOLO_MAX_DET", 50),
            fall_threshold=float_env("HUIYAN_FALL_THRESHOLD", 0.25),
            fall_normal_suppression=bool_env("HUIYAN_FALL_NORMAL_SUPPRESSION", True),
            fall_normal_iou_thr=float_env("HUIYAN_FALL_NORMAL_IOU", 0.45),
            fall_normal_conf_margin=float_env("HUIYAN_FALL_NORMAL_CONF_MARGIN", 0.02),
            fall_min_area_ratio=float_env("HUIYAN_FALL_MIN_AREA_RATIO", 0.0005),
            fall_max_area_ratio=float_env("HUIYAN_FALL_MAX_AREA_RATIO", 0.45),
            fall_min_aspect_ratio=float_env("HUIYAN_FALL_MIN_ASPECT_RATIO", 0.08),
            fall_vertical_reject_under=float_env("HUIYAN_FALL_VERTICAL_REJECT_UNDER", 0.45),
            fall_vertical_ratio=float_env("HUIYAN_FALL_VERTICAL_RATIO", 1.35),
            rtmo_confirm_enabled=bool_env("HUIYAN_RTMO_CONFIRM_ENABLED", False),
            rtmo_confirm_under=float_env("HUIYAN_RTMO_CONFIRM_UNDER", 0.70),
            rtmo_fail_open=bool_env("HUIYAN_RTMO_FAIL_OPEN", True),
            draw_min_conf=float_env("HUIYAN_DRAW_MIN_CONF", 0.25),
            tiled_enabled=bool_env("HUIYAN_TILED_ENABLED", True),
            tiled_grid=int_env("HUIYAN_TILED_GRID", 3),
            tiled_overlap=float_env("HUIYAN_TILED_OVERLAP", 0.20),
            tiled_conf=float_env("HUIYAN_TILED_CONF", 0.10),
            tiled_imgsz=int_env("HUIYAN_TILED_IMGSZ", 960),
            tiled_fall_threshold=float_env("HUIYAN_TILED_FALL_THRESHOLD", 0.25),
            tiled_batch=max(1, int_env("HUIYAN_TILED_BATCH", 4)),
            tiled_min_long_side=int_env("HUIYAN_TILED_MIN_LONG_SIDE", 1280),
            tiled_min_short_side=int_env("HUIYAN_TILED_MIN_SHORT_SIDE", 720),
            crop_padding=int_env("HUIYAN_CROP_PADDING", 40),
            rtmo_bbox_thr=float_env("HUIYAN_RTMO_BBOX_THR", 0.05),
            rtmo_kpt_thr=float_env("HUIYAN_RTMO_KPT_THR", 0.30),
            rtmo_min_area=float_env("HUIYAN_RTMO_MIN_AREA", 80.0),
            rtmo_min_quality=float_env("HUIYAN_RTMO_MIN_QUALITY", 0.03),
            rtmo_horizontal_ratio=float_env("HUIYAN_RTMO_HORIZONTAL_RATIO", 0.95),
            rtmo_fallback_enabled=bool_env("HUIYAN_RTMO_FALLBACK_ENABLED", False),
            camera_rtmo_fallback=bool_env("HUIYAN_CAMERA_RTMO_FALLBACK", True),
            require_rtmo=bool_env("HUIYAN_REQUIRE_RTMO", False),
            warmup=bool_env("HUIYAN_WARMUP", True),
            video_frame_stride=max(1, int_env("HUIYAN_VIDEO_FRAME_STRIDE", 10)),
            video_alert_interval=max(1, int_env("HUIYAN_VIDEO_ALERT_INTERVAL", 30)),
            video_clip_enabled=bool_env("HUIYAN_VIDEO_CLIP_ENABLED", True),
            video_clip_pre_sec=max(0.0, float_env("HUIYAN_VIDEO_CLIP_PRE_SEC", 10.0)),
            video_clip_post_sec=max(0.0, float_env("HUIYAN_VIDEO_CLIP_POST_SEC", 10.0)),
            video_event_gap_sec=max(0.0, float_env("HUIYAN_VIDEO_EVENT_GAP_SEC", 5.0)),
            video_max_duration_sec=int_env("HUIYAN_VIDEO_MAX_DURATION_SEC", 3600),
            video_max_upload_mb=int_env("HUIYAN_VIDEO_MAX_UPLOAD_MB", 500),
        )


@dataclass
class Detection:
    label: str
    display_label: str
    conf: float
    xyxy: Tuple[int, int, int, int]

    def to_payload(self) -> Dict[str, Any]:
        return {
            "label": self.label,
            "display_label": self.display_label,
            "confidence": round(float(self.conf), 4),
            "bbox": [int(v) for v in self.xyxy],
        }


def append_or_merge_fall_event(
    events: List[Dict[str, Any]],
    sample: Dict[str, Any],
    max_gap_frames: int,
) -> bool:
    """Append an alert as a new fall event or merge it into the active event.

    Returns True when a new event was created. Consecutive detections close
    enough in time represent the same fall, so only the first trigger gets an
    evidence clip.
    """
    frame = int(sample["frame"])
    if events:
        current = events[-1]
        gap = frame - int(current["last_alert_frame"])
        if 0 <= gap <= max(0, int(max_gap_frames)):
            current["last_alert_frame"] = frame
            current["last_alert_timestamp_sec"] = float(sample["timestamp_sec"])
            current["detection_count"] = int(current.get("detection_count", 1)) + 1

            new_confidence = sample.get("confidence")
            old_confidence = current.get("confidence")
            if new_confidence is not None and (
                old_confidence is None or float(new_confidence) > float(old_confidence)
            ):
                current["confidence"] = new_confidence
            return False

    event = dict(sample)
    event["first_frame"] = frame
    event["last_alert_frame"] = frame
    event["last_alert_timestamp_sec"] = float(sample["timestamp_sec"])
    event["detection_count"] = 1
    events.append(event)
    return True


def calculate_event_clip_window(
    alert_timestamp_sec: float,
    video_duration_sec: float,
    pre_sec: float,
    post_sec: float,
) -> Tuple[float, float]:
    """Return a source-bounded [start, end] window around an alert."""
    timestamp = max(0.0, float(alert_timestamp_sec))
    duration = max(0.0, float(video_duration_sec))
    start = max(0.0, timestamp - max(0.0, float(pre_sec)))
    end = timestamp + max(0.0, float(post_sec))
    if duration > 0:
        end = min(duration, end)
    return round(start, 3), round(max(start, end), 3)


def encode_browser_video(path: Path, preserve_original: bool = False) -> None:
    """Atomically publish an H.264/yuv420p MP4 with progressive playback."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        try:
            import imageio_ffmpeg
            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except (ImportError, RuntimeError) as exc:
            raise RuntimeError("Browser video encoding requires FFmpeg with libx264 or imageio-ffmpeg") from exc

    fd, temporary = tempfile.mkstemp(prefix=f".{path.stem}-", suffix=".mp4", dir=path.parent)
    os.close(fd)
    converted = Path(temporary)
    try:
        result = subprocess.run(
            [ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
             "-i", str(path), "-map", "0:v:0", "-an", "-c:v", "libx264",
             "-preset", "fast", "-crf", "23", "-threads", "2",
             "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-pix_fmt", "yuv420p",
             "-movflags", "+faststart", str(converted)],
            capture_output=True, text=True, timeout=1800,
        )
        if result.returncode or not is_nonempty_file(converted):
            raise RuntimeError(f"Browser video encoding failed: {result.stderr[-2000:]}")
        if preserve_original:
            backup = path.with_suffix(".original.mp4")
            if not backup.exists():
                shutil.copy2(path, backup)
        os.replace(converted, path)
    finally:
        converted.unlink(missing_ok=True)


def extract_video_clip(
    source_path: Path,
    output_path: Path,
    start_sec: float,
    end_sec: float,
) -> Dict[str, Any]:
    """Extract source frames and encode a browser-compatible video-only clip."""
    if end_sec <= start_sec:
        raise ValueError("event clip end must be greater than start")

    cap = cv2.VideoCapture(str(source_path))
    if not cap.isOpened():
        cap.release()
        raise ValueError(f"failed to open source video for clipping: {source_path}")

    writer = None
    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 25.0)
        if fps <= 0:
            fps = 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        if width <= 0 or height <= 0:
            raise ValueError("source video has invalid dimensions")

        start_frame = max(0, int(math.floor(start_sec * fps)))
        end_frame = max(start_frame + 1, int(math.ceil(end_sec * fps)))
        if total_frames > 0:
            start_frame = min(start_frame, max(0, total_frames - 1))
            end_frame = min(end_frame, total_frames)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        writer = cv2.VideoWriter(
            str(output_path),
            cv2.VideoWriter_fourcc(*"mp4v"),
            fps,
            (width, height),
        )
        if not writer.isOpened():
            raise ValueError(f"failed to create event clip: {output_path}")

        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        written_frames = 0
        for _ in range(start_frame, end_frame):
            ok, frame = cap.read()
            if not ok or frame is None:
                break
            writer.write(frame)
            written_frames += 1

        if written_frames <= 0:
            raise ValueError("no frames were written to the event clip")

        writer.release()
        writer = None
        encode_browser_video(output_path)
        return {
            "frame_count": written_frames,
            "fps": round(fps, 3),
            "duration_sec": round(written_frames / fps, 3),
            "start_frame": start_frame,
            "end_frame": start_frame + written_frames - 1,
        }
    except Exception:
        if writer is not None:
            writer.release()
            writer = None
        try:
            output_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise
    finally:
        cap.release()
        if writer is not None:
            writer.release()


class InferenceService:
    def __init__(self, config: ServiceConfig):
        self.config = config
        self.config.upload_dir.mkdir(parents=True, exist_ok=True)
        self.config.api_output_dir.mkdir(parents=True, exist_ok=True)
        self._gpu_lock = asyncio.Semaphore(config.gpu_concurrency)
        self._yolo_model: Any = None
        self._rtmo_inferencer: Any = None
        self._loaded = False
        self._load_error: Optional[str] = None
        self._rtmo_error: Optional[str] = None

    @classmethod
    def from_env(cls) -> "InferenceService":
        return cls(ServiceConfig.from_env())

    def load_models(self) -> None:
        if self._loaded:
            return

        configure_torch_runtime(self.config.device)
        self._load_yolo()
        self._load_rtmo()
        if self.config.warmup:
            self._warmup()
        self._loaded = True

    async def detect_image_bytes(
        self,
        *,
        task_id: str,
        filename: str,
        file_bytes: bytes,
    ) -> Dict[str, Any]:
        async with self._gpu_lock:
            return await asyncio.to_thread(
                self._detect_image_sync,
                task_id,
                filename,
                file_bytes,
            )

    async def detect_video_bytes(
        self,
        *,
        task_id: str,
        filename: str,
        file_bytes: bytes,
        progress_cb: Optional[Any] = None,
    ) -> Dict[str, Any]:
        async with self._gpu_lock:
            return await asyncio.to_thread(
                self._detect_video_sync,
                task_id,
                filename,
                file_bytes,
                progress_cb,
            )

    def status(self) -> Dict[str, Any]:
        return {
            "loaded": self._loaded,
            "load_error": self._load_error,
            "rtmo_error": self._rtmo_error,
            "device": self.config.device,
            "yolo_weights": str(self.config.yolo_weights),
            "yolo_imgsz": self.config.yolo_imgsz,
            "yolo_conf": self.config.yolo_conf,
            "fall_threshold": self.config.fall_threshold,
            "yolo_classes": self.config.yolo_classes,
            "fall_normal_suppression": self.config.fall_normal_suppression,
            "fall_normal_iou_thr": self.config.fall_normal_iou_thr,
            "fall_normal_conf_margin": self.config.fall_normal_conf_margin,
            "fall_min_area_ratio": self.config.fall_min_area_ratio,
            "fall_max_area_ratio": self.config.fall_max_area_ratio,
            "fall_min_aspect_ratio": self.config.fall_min_aspect_ratio,
            "fall_vertical_reject_under": self.config.fall_vertical_reject_under,
            "fall_vertical_ratio": self.config.fall_vertical_ratio,
            "tiled_enabled": self.config.tiled_enabled,
            "tiled_conf": self.config.tiled_conf,
            "tiled_fall_threshold": self.config.tiled_fall_threshold,
            "rtmo_confirm_enabled": self.config.rtmo_confirm_enabled,
            "rtmo_confirm_under": self.config.rtmo_confirm_under,
            "rtmo_fail_open": self.config.rtmo_fail_open,
            "rtmo_fallback_enabled": self.config.rtmo_fallback_enabled,
            "camera_rtmo_fallback": self.config.camera_rtmo_fallback,
            "rtmo_config": str(self.config.rtmo_config),
            "rtmo_weights": str(self.config.rtmo_weights),
            "gpu_concurrency": self.config.gpu_concurrency,
        }

    def _load_yolo(self) -> None:
        if self._yolo_model is not None:
            return
        if not self.config.yolo_weights.exists():
            raise FileNotFoundError(f"YOLO weights not found: {self.config.yolo_weights}")
        if self.config.yolo_weights.is_file() and self.config.yolo_weights.stat().st_size <= 0:
            raise RuntimeError(f"YOLO weights file is empty: {self.config.yolo_weights}")
        try:
            from ultralytics import YOLO
        except Exception as exc:
            self._load_error = f"failed to import ultralytics: {exc}"
            raise RuntimeError(self._load_error) from exc

        self._yolo_model = YOLO(str(self.config.yolo_weights))
        try:
            self._yolo_model.fuse()
        except Exception:
            pass

    def _load_rtmo(self) -> None:
        if self._rtmo_inferencer is not None:
            return
        if not self.config.rtmo_config.exists() or not self.config.rtmo_weights.exists():
            self._rtmo_error = (
                f"RTMO files not found: config={self.config.rtmo_config}, "
                f"weights={self.config.rtmo_weights}"
            )
            if self.config.require_rtmo:
                raise FileNotFoundError(self._rtmo_error)
            return

        if self.config.mmpose_root.exists() and str(self.config.mmpose_root) not in sys.path:
            sys.path.insert(0, str(self.config.mmpose_root))
        if self.config.mmpose_root.exists():
            current_pythonpath = os.environ.get("PYTHONPATH", "")
            mmpose_root = str(self.config.mmpose_root)
            pythonpath_parts = [part for part in current_pythonpath.split(os.pathsep) if part]
            if mmpose_root not in pythonpath_parts:
                os.environ["PYTHONPATH"] = os.pathsep.join([mmpose_root, *pythonpath_parts])

        try:
            from mmpose.apis import MMPoseInferencer

            with temporary_cwd(self.config.mmpose_root):
                self._rtmo_inferencer = MMPoseInferencer(
                    pose2d=str(self.config.rtmo_config),
                    pose2d_weights=str(self.config.rtmo_weights),
                    device=self.config.device,
                )
            self._rtmo_error = None
        except Exception as exc:
            self._rtmo_error = f"failed to load RTMO inferencer: {exc}"
            if self.config.require_rtmo:
                raise RuntimeError(self._rtmo_error) from exc

    def _warmup(self) -> None:
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        try:
            self._predict_yolo(
                dummy,
                conf=self.config.yolo_conf,
                imgsz=self.config.yolo_imgsz,
                batch=1,
            )
        except Exception as exc:
            self._load_error = f"YOLO warmup failed: {exc}"
            raise

        if self._rtmo_inferencer is not None:
            try:
                self._rtmo_predict(dummy)
            except Exception as exc:
                self._rtmo_error = f"RTMO warmup failed: {exc}"
                if self.config.require_rtmo:
                    raise

    def _detect_image_sync(
        self,
        task_id: str,
        filename: str,
        file_bytes: bytes,
    ) -> Dict[str, Any]:
        if not self._loaded:
            self.load_models()

        total_start = time.perf_counter()
        timings = {
            "upload_decode": 0,
            "yolo_full": 0,
            "yolo_tiled": 0,
            "rtmo": 0,
            "fusion": 0,
            "render_write": 0,
            "total": 0,
        }

        suffix = Path(filename).suffix.lower() or ".jpg"
        if suffix not in IMAGE_EXTS:
            raise ValueError(f"Unsupported image type: {suffix}")

        task_dir = self.config.api_output_dir / task_id
        input_path = self.config.upload_dir / f"{task_id}{suffix}"
        task_dir.mkdir(parents=True, exist_ok=True)

        start = time.perf_counter()
        input_path.write_bytes(file_bytes)
        frame = self._decode_image(file_bytes)
        timings["upload_decode"] = elapsed_ms(start)

        yolo_events_path = task_dir / "yolo_events.json"
        pose_events_path = task_dir / "pose_events.json"
        fusion_path = task_dir / "fusion_result.json"
        result_path = task_dir / "result.json"

        start = time.perf_counter()
        detections = self._predict_yolo(
            frame,
            conf=self.config.yolo_conf,
            imgsz=self.config.yolo_imgsz,
            batch=1,
        )
        best_fall = self._best_fall(detections, self.config.fall_threshold, frame.shape)
        timings["yolo_full"] = elapsed_ms(start)

        tiled_ran = False
        if best_fall is None and self._should_run_tiled(frame):
            tiled_ran = True
            start = time.perf_counter()
            tiled_detections = self._predict_tiled(frame)
            timings["yolo_tiled"] = elapsed_ms(start)
            if tiled_detections:
                detections.extend(tiled_detections)
                best_fall = self._best_fall(detections, self.config.tiled_fall_threshold, frame.shape)

        yolo_events = []
        candidate_yolo_event = None
        pipeline_mode = "yolo_tiled" if tiled_ran else "yolo_only"

        if best_fall is not None:
            candidate_yolo_event = {
                "source": str(input_path),
                "frame": 0,
                "event": "FALL",
                "confidence": round(best_fall.conf, 4),
                "bbox": [int(v) for v in best_fall.xyxy],
                "risk_level": "FALL ALERT",
                "alert_image": "",
                "detector_status": "TILED_FALL_ALERT" if tiled_ran else "FALL_ALERT",
            }

        pose_events: List[Dict[str, Any]] = []
        rtmo_source_path = input_path
        rtmo_ran = False
        rtmo_error = None
        pose_fall_detection: Optional[Detection] = None
        if best_fall is not None:
            start = time.perf_counter()
            rtmo_ran = self._rtmo_inferencer is not None
            if rtmo_ran:
                crop, x_offset, y_offset = crop_roi(frame, best_fall.xyxy, self.config.crop_padding)
                crop_dir = task_dir / "crop_temp"
                crop_dir.mkdir(parents=True, exist_ok=True)
                rtmo_source_path = crop_dir / f"{input_path.stem}_crop_roi.png"
                cv2.imwrite(str(rtmo_source_path), crop)
                try:
                    rtmo_result = self._rtmo_predict(crop)
                    pose_events = [
                        build_pose_event(
                            rtmo_result,
                            source=str(input_path),
                            image_name=input_path.name,
                            x_offset=x_offset,
                            y_offset=y_offset,
                            min_area=self.config.rtmo_min_area,
                            min_quality=self.config.rtmo_min_quality,
                            horizontal_ratio=self.config.rtmo_horizontal_ratio,
                        )
                    ]
                except Exception as exc:
                    rtmo_error = str(exc)
                    self._rtmo_error = f"RTMO inference failed: {exc}"
            else:
                rtmo_error = self._rtmo_error or "RTMO inferencer is not loaded"
            timings["rtmo"] = elapsed_ms(start)
            if rtmo_ran:
                pipeline_mode = "yolo_tiled_rtmo" if tiled_ran else "yolo_rtmo"
        elif self._should_run_rtmo_fallback(filename) and self._rtmo_inferencer is not None:
            start = time.perf_counter()
            rtmo_ran = True
            try:
                rtmo_result = self._rtmo_predict(frame)
                pose_event = build_pose_event(
                    rtmo_result,
                    source=str(input_path),
                    image_name=input_path.name,
                    x_offset=0,
                    y_offset=0,
                    min_area=self.config.rtmo_min_area,
                    min_quality=self.config.rtmo_min_quality,
                    horizontal_ratio=self.config.rtmo_horizontal_ratio,
                )
                pose_events = [pose_event]
                if pose_confirms_fall(pose_event):
                    main_person = pose_event.get("main_person") or {}
                    pose_fall_detection = detection_from_pose_person(main_person)
            except Exception as exc:
                rtmo_error = str(exc)
                self._rtmo_error = f"RTMO fallback inference failed: {exc}"
            timings["rtmo"] = elapsed_ms(start)
            pipeline_mode = "yolo_rtmo"

        rtmo_confirmed = any(pose_confirms_fall(event) for event in pose_events)
        alert, rtmo_gate = resolve_alert_decision(
            self.config,
            best_fall,
            rtmo_confirmed,
            rtmo_ran,
            rtmo_error,
        )
        if best_fall is None and pose_fall_detection is not None and rtmo_confirmed:
            alert = True
            rtmo_gate["accepted"] = True
            rtmo_gate["reason"] = "RTMO fallback detected horizontal body pose"
        status = "FALL_ALERT" if alert and best_fall is not None else "POSE_WARNING" if alert else "NORMAL"
        risk_level = "FALL ALERT" if status == "FALL_ALERT" else "POSE WARNING" if status == "POSE_WARNING" else "NORMAL"
        if alert and candidate_yolo_event is not None:
            yolo_events.append(candidate_yolo_event)

        start = time.perf_counter()
        fusion = fuse_events(yolo_events, pose_events)
        timings["fusion"] = elapsed_ms(start)

        start = time.perf_counter()
        image_dir = task_dir / "images"
        alert_dir = task_dir / "alerts"
        image_dir.mkdir(parents=True, exist_ok=True)
        alert_dir.mkdir(parents=True, exist_ok=True)

        result_image_path = image_dir / f"{input_path.stem}_result.jpg"
        display_fall_detection = best_fall or pose_fall_detection
        all_detections = [*detections]
        if pose_fall_detection is not None:
            all_detections.append(pose_fall_detection)
        drawn = draw_result(
            frame,
            display_detections(all_detections, display_fall_detection, alert, self.config.draw_min_conf),
            alert,
            risk_level,
        )
        cv2.imwrite(str(result_image_path), drawn)

        alert_image_path = None
        if alert:
            alert_image_path = alert_dir / f"{input_path.stem}_alert.jpg"
            cv2.imwrite(str(alert_image_path), drawn)
            if yolo_events:
                yolo_events[0]["alert_image"] = str(alert_image_path)
            for event in fusion.get("events", []):
                event["alert_image"] = str(alert_image_path)
                yolo_result = event.get("yolo_result")
                if yolo_result is not None:
                    yolo_result["alert_image"] = str(alert_image_path)

        run_result = {
            "success": True,
            "source": str(input_path),
            "status": status,
            "risk_level": risk_level,
            "alert": alert,
            "detections": [det.to_payload() for det in all_detections],
            "display_detections": [
                det.to_payload()
                for det in display_detections(all_detections, display_fall_detection, alert, self.config.draw_min_conf)
            ],
            "files": {
                "output": str(result_image_path),
                "alert_image": str(alert_image_path) if alert_image_path else "",
                "yolo_events": str(yolo_events_path),
            },
        }

        write_json(task_dir / "run_video_demo_result.json", run_result)
        write_json(yolo_events_path, yolo_events)
        write_json(pose_events_path, pose_events)
        write_json(fusion_path, fusion)

        payload = {
            "success": True,
            "task_id": task_id,
            "created_at": local_now_str(),
            "created_at_iso": local_now_iso(),
            "created_at_timezone": local_timezone_name(),
            "source": str(input_path),
            "status": status,
            "risk_level": risk_level,
            "cascaded": bool(rtmo_ran),
            "best_yolo_event": yolo_events[0] if yolo_events else None,
            "candidate_yolo_event": candidate_yolo_event,
            "pipeline_mode": pipeline_mode,
            "timings_ms": timings,
            "rtmo_ran": rtmo_ran,
            "rtmo_confirmed": rtmo_confirmed,
            "rtmo_gate": rtmo_gate,
            "rtmo_error": rtmo_error,
            "files": {
                "output_dir": str(task_dir),
                "yolo_events": str(yolo_events_path),
                "rtmo_events": str(pose_events_path),
                "fusion_output": str(fusion_path),
                "rtmo_source": str(rtmo_source_path),
            },
            "fusion": fusion,
            "api_files": {
                "result_json": f"/api/result/{task_id}/result.json",
                "yolo_events": f"/api/result/{task_id}/yolo_events.json",
                "pose_events": f"/api/result/{task_id}/pose_events.json",
                "fusion_result": f"/api/result/{task_id}/fusion_result.json",
                "result_image": f"/api/result/{task_id}/images/{result_image_path.name}",
            },
        }
        if alert_image_path is not None:
            payload["api_files"]["alert_image"] = f"/api/result/{task_id}/alerts/{alert_image_path.name}"

        timings["render_write"] = elapsed_ms(start)
        timings["total"] = elapsed_ms(total_start)
        write_json(result_path, payload)
        return payload

    def _detect_frame(self, frame) -> Dict[str, Any]:
        """Run the cascade (YOLO -> Tiled -> RTMO -> Fusion) on a single frame.

        Mirrors the image path but returns the in-memory artifacts so the video
        loop can draw, persist alert snapshots and aggregate events itself.
        """
        detections = self._predict_yolo(
            frame,
            conf=self.config.yolo_conf,
            imgsz=self.config.yolo_imgsz,
            batch=1,
        )
        best_fall = self._best_fall(detections, self.config.fall_threshold, frame.shape)

        tiled_ran = False
        if best_fall is None and self._should_run_tiled(frame):
            tiled_ran = True
            tiled_detections = self._predict_tiled(frame)
            if tiled_detections:
                detections.extend(tiled_detections)
                best_fall = self._best_fall(detections, self.config.tiled_fall_threshold, frame.shape)

        pipeline_mode = "yolo_tiled" if tiled_ran else "yolo_only"

        pose_event = None
        rtmo_ran = False
        rtmo_error = None
        if best_fall is not None and self._rtmo_inferencer is not None:
            rtmo_ran = True
            crop, x_offset, y_offset = crop_roi(frame, best_fall.xyxy, self.config.crop_padding)
            try:
                rtmo_result = self._rtmo_predict(crop)
                pose_event = build_pose_event(
                    rtmo_result,
                    source="",
                    image_name="",
                    x_offset=x_offset,
                    y_offset=y_offset,
                    min_area=self.config.rtmo_min_area,
                    min_quality=self.config.rtmo_min_quality,
                    horizontal_ratio=self.config.rtmo_horizontal_ratio,
                )
            except Exception as exc:
                rtmo_error = str(exc)
                pose_event = None
            if rtmo_ran:
                pipeline_mode = "yolo_tiled_rtmo" if tiled_ran else "yolo_rtmo"

        rtmo_confirmed = pose_confirms_fall(pose_event)
        alert, rtmo_gate = resolve_alert_decision(
            self.config,
            best_fall,
            rtmo_confirmed,
            rtmo_ran,
            rtmo_error,
        )
        risk_level = "FALL ALERT" if alert else "NORMAL"

        return {
            "detections": detections,
            "display_detections": display_detections(
                detections,
                best_fall,
                alert,
                self.config.draw_min_conf,
            ),
            "best_fall": best_fall,
            "alert": alert,
            "risk_level": risk_level,
            "pipeline_mode": pipeline_mode,
            "pose_event": pose_event,
            "rtmo_ran": rtmo_ran,
            "rtmo_confirmed": rtmo_confirmed,
            "rtmo_gate": rtmo_gate,
        }

    def _detect_video_sync(
        self,
        task_id: str,
        filename: str,
        file_bytes: bytes,
        progress_cb: Optional[Any] = None,
    ) -> Dict[str, Any]:
        if not self._loaded:
            self.load_models()

        total_start = time.perf_counter()

        suffix = Path(filename).suffix.lower() or ".mp4"
        if suffix not in VIDEO_EXTS:
            raise ValueError(f"Unsupported video type: {suffix}")

        max_bytes = self.config.video_max_upload_mb * 1024 * 1024
        if len(file_bytes) > max_bytes:
            raise ValueError(f"Video too large: max {self.config.video_max_upload_mb}MB")

        task_dir = self.config.api_output_dir / task_id
        alert_dir = task_dir / "alerts"
        task_dir.mkdir(parents=True, exist_ok=True)
        alert_dir.mkdir(parents=True, exist_ok=True)

        input_path = self.config.upload_dir / f"{task_id}{suffix}"
        input_path.write_bytes(file_bytes)

        cap = cv2.VideoCapture(str(input_path))
        if not cap.isOpened():
            cap.release()
            raise ValueError("failed to open video")

        src_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        if not src_fps or src_fps <= 0:
            src_fps = 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        duration_sec = total_frames / src_fps if total_frames else 0.0

        if duration_sec > self.config.video_max_duration_sec:
            cap.release()
            raise ValueError(
                f"Video too long: {duration_sec:.0f}s > max {self.config.video_max_duration_sec}s"
            )

        stride = max(1, self.config.video_frame_stride)
        result_path = task_dir / "result.json"
        timeline_path = task_dir / "timeline.json"
        progress_path = task_dir / "progress.json"
        yolo_events_path = task_dir / "yolo_events.json"
        pose_events_path = task_dir / "pose_events.json"
        fusion_path = task_dir / "fusion_result.json"

        yolo_events: List[Dict[str, Any]] = []
        pose_events: List[Dict[str, Any]] = []
        alert_timeline: List[Dict[str, Any]] = []
        pipeline_modes: set = set()

        frame_index = -1
        processed_frames = 0
        alert_count = 0
        alert_frame_count = 0
        event_gap_frames = max(
            self.config.video_alert_interval,
            int(round(self.config.video_event_gap_sec * src_fps)),
        )

        def write_progress(status: str) -> None:
            percent = round(100.0 * frame_index / total_frames, 1) if total_frames else 0.0
            progress = {
                "task_id": task_id,
                "status": status,
                "processed_frames": processed_frames,
                "total_frames": total_frames,
                "alert_count": alert_count,
                "percent": min(percent, 100.0),
            }
            write_json(progress_path, progress)
            if progress_cb is not None:
                try:
                    progress_cb(progress)
                except Exception:
                    pass

        write_progress("processing")

        try:
            while True:
                ok = cap.grab()
                if not ok:
                    break
                frame_index += 1
                if frame_index % stride != 0:
                    continue

                ok, frame = cap.retrieve()
                if not ok or frame is None:
                    continue

                outcome = self._detect_frame(frame)
                processed_frames += 1
                pipeline_modes.add(outcome["pipeline_mode"])
                timestamp_sec = round(frame_index / src_fps, 2)

                best_fall = outcome["best_fall"]
                if outcome["alert"] and best_fall is not None:
                    yolo_events.append({
                        "source": str(input_path),
                        "frame": frame_index,
                        "event": "FALL",
                        "confidence": round(best_fall.conf, 4),
                        "bbox": [int(v) for v in best_fall.xyxy],
                        "risk_level": "FALL ALERT",
                        "alert_image": "",
                    })

                pose_event = outcome["pose_event"]
                if pose_event is not None:
                    pose_event["source"] = str(input_path)
                    pose_event["frame"] = frame_index
                    pose_events.append(pose_event)

                drawn = draw_result(
                    frame,
                    outcome["display_detections"],
                    outcome["alert"],
                    outcome["risk_level"],
                )

                if outcome["alert"]:
                    alert_frame_count += 1
                    status = "POSE_WARNING" if (
                        pose_event and pose_event.get("risk_level") == "POSE_WARNING"
                    ) else "FALL_ALERT"
                    is_new_event = append_or_merge_fall_event(
                        alert_timeline,
                        {
                            "frame": frame_index,
                            "timestamp_sec": timestamp_sec,
                            "status": status,
                            "risk_level": outcome["risk_level"],
                            "confidence": round(best_fall.conf, 4) if best_fall else None,
                            "alert_image": "",
                        },
                        event_gap_frames,
                    )
                    if is_new_event:
                        alert_count += 1
                        alert_image_path = alert_dir / f"frame_{frame_index:06d}.jpg"
                        if cv2.imwrite(str(alert_image_path), drawn):
                            alert_timeline[-1]["alert_image"] = (
                                f"/api/result/{task_id}/alerts/{alert_image_path.name}"
                            )

                if processed_frames % 5 == 0:
                    write_progress("processing")
        finally:
            cap.release()

        effective_duration_sec = duration_sec
        if effective_duration_sec <= 0 and frame_index >= 0:
            effective_duration_sec = (frame_index + 1) / src_fps

        clip_start_time = time.perf_counter()
        event_clip_urls: List[str] = []
        clip_error_count = 0
        for event_number, event in enumerate(alert_timeline, start=1):
            event["event_id"] = f"fall_{event_number:03d}"
            event["event_video"] = ""

        clip_ms = elapsed_ms(clip_start_time)
        fusion = fuse_events(yolo_events, pose_events)
        write_json(yolo_events_path, yolo_events)
        write_json(pose_events_path, pose_events)
        write_json(fusion_path, fusion)

        overall_status = "FALL_ALERT" if alert_frame_count else "NORMAL"
        overall_risk = "high" if alert_frame_count else "low"
        if pipeline_modes:
            pipeline_mode = max(
                pipeline_modes,
                key=lambda mode: {
                    "yolo_only": 0,
                    "yolo_tiled": 1,
                    "yolo_rtmo": 2,
                    "yolo_tiled_rtmo": 3,
                }.get(mode, 0),
            )
        else:
            pipeline_mode = "yolo_only"

        total_ms = elapsed_ms(total_start)
        payload = {
            "success": True,
            "task_id": task_id,
            "created_at": local_now_str(),
            "created_at_iso": local_now_iso(),
            "created_at_timezone": local_timezone_name(),
            "source": str(input_path),
            "source_type": "video",
            "status": overall_status,
            "risk_level": overall_risk,
            "duration_sec": round(effective_duration_sec, 2),
            "total_frames": total_frames,
            "processed_frames": processed_frames,
            "alert_count": alert_count,
            "alert_frame_count": alert_frame_count,
            "event_clip_count": len(event_clip_urls),
            "event_clip_error_count": clip_error_count,
            "average_fps": round(processed_frames / (total_ms / 1000), 2) if total_ms else 0.0,
            "pipeline_mode": pipeline_mode,
            "timings_ms": {"total": total_ms, "event_clips": 0},
            "alert_timeline": alert_timeline,
            "fusion": fusion,
            "api_files": {
                "output_video": "",
                "event_clips": [],
                "timeline_json": f"/api/result/{task_id}/timeline.json",
                "result_json": f"/api/result/{task_id}/result.json",
                "yolo_events": f"/api/result/{task_id}/yolo_events.json",
                "pose_events": f"/api/result/{task_id}/pose_events.json",
                "fusion_result": f"/api/result/{task_id}/fusion_result.json",
            },
        }

        write_json(timeline_path, payload)
        write_json(result_path, payload)
        write_progress("completed")
        return payload

    def _decode_image(self, file_bytes: bytes):
        buf = np.frombuffer(file_bytes, dtype=np.uint8)
        frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("failed to decode image")
        return frame

    def _predict_yolo(
        self,
        images: Any,
        *,
        conf: float,
        imgsz: int,
        batch: int,
    ) -> List[Detection]:
        if self._yolo_model is None:
            raise RuntimeError("YOLO model is not loaded")

        kwargs = {
            "verbose": False,
            "conf": conf,
            "imgsz": imgsz,
            "device": self.config.device,
            "half": self.config.yolo_half and self.config.device != "cpu",
            "max_det": self.config.yolo_max_det,
            "batch": batch,
        }
        if self.config.yolo_classes is not None:
            kwargs["classes"] = self.config.yolo_classes

        results = self._yolo_model.predict(images, **kwargs)
        return parse_yolo_results(results)

    def _predict_tiled(self, frame) -> List[Detection]:
        tiles = make_tiles(frame, self.config.tiled_grid, self.config.tiled_overlap)
        if not tiles:
            return []

        try:
            detections = self._predict_tiled_batch(frame, tiles, self.config.tiled_batch)
        except RuntimeError as exc:
            if not is_oom(exc) or self.config.tiled_batch == 1:
                raise
            clear_cuda_cache()
            detections = self._predict_tiled_batch(frame, tiles, 1)

        fall_detections = self._fall_candidates(
            detections,
            self.config.tiled_fall_threshold,
            frame.shape,
        )
        return nms_detections(fall_detections, iou_thr=0.45)

    def _predict_tiled_batch(
        self,
        frame,
        tiles: Sequence[Tuple[int, int, int, int]],
        batch: int,
    ) -> List[Detection]:
        detections: List[Detection] = []
        for start in range(0, len(tiles), batch):
            batch_tiles = tiles[start:start + batch]
            images = [frame[y1:y2, x1:x2] for x1, y1, x2, y2 in batch_tiles]
            kwargs = {
                "verbose": False,
                "conf": self.config.tiled_conf,
                "imgsz": self.config.tiled_imgsz,
                "device": self.config.device,
                "half": self.config.yolo_half and self.config.device != "cpu",
                "max_det": self.config.yolo_max_det,
                "batch": len(images),
            }
            if self.config.yolo_classes is not None:
                kwargs["classes"] = self.config.yolo_classes
            results = self._yolo_model.predict(images, **kwargs)
            for tile_box, result in zip(batch_tiles, results):
                x_offset, y_offset = tile_box[0], tile_box[1]
                for det in parse_yolo_results([result]):
                    x1, y1, x2, y2 = det.xyxy
                    detections.append(
                        Detection(
                            label=det.label,
                            display_label=det.display_label,
                            conf=det.conf,
                            xyxy=(x1 + x_offset, y1 + y_offset, x2 + x_offset, y2 + y_offset),
                        )
                    )
        return detections

    def _rtmo_predict(self, roi_image) -> Any:
        if self._rtmo_inferencer is None:
            raise RuntimeError("RTMO inferencer is not loaded")

        kwargs_options = [
            {
                "show": False,
                "draw_bbox": False,
                "return_vis": False,
                "bbox_thr": self.config.rtmo_bbox_thr,
                "kpt_thr": self.config.rtmo_kpt_thr,
            },
            {
                "show": False,
                "draw_bbox": False,
                "bbox_thr": self.config.rtmo_bbox_thr,
                "kpt_thr": self.config.rtmo_kpt_thr,
            },
            {"show": False, "draw_bbox": False},
            {},
        ]

        last_error = None
        for kwargs in kwargs_options:
            try:
                with temporary_cwd(self.config.mmpose_root):
                    output = self._rtmo_inferencer(roi_image, **kwargs)
                if isinstance(output, dict):
                    return output
                iterator = iter(output)
                return next(iterator)
            except TypeError as exc:
                last_error = exc
                continue
        raise RuntimeError(f"RTMO call failed: {last_error}")

    def _should_run_tiled(self, frame) -> bool:
        if not self.config.tiled_enabled:
            return False
        height, width = frame.shape[:2]
        return (
            max(height, width) >= self.config.tiled_min_long_side
            and min(height, width) >= self.config.tiled_min_short_side
        )

    def _should_run_rtmo_fallback(self, filename: str) -> bool:
        if self.config.rtmo_fallback_enabled:
            return True
        if not self.config.camera_rtmo_fallback:
            return False
        return Path(filename).stem.startswith("camera-capture-")

    def _best_fall(
        self,
        detections: Sequence[Detection],
        threshold: float,
        frame_shape: Optional[Tuple[int, ...]] = None,
    ) -> Optional[Detection]:
        candidates = self._fall_candidates(detections, threshold, frame_shape)
        if not candidates:
            return None
        return max(candidates, key=lambda det: det.conf)

    def _fall_candidates(
        self,
        detections: Sequence[Detection],
        threshold: float,
        frame_shape: Optional[Tuple[int, ...]] = None,
    ) -> List[Detection]:
        return [
            det for det in detections
            if det.display_label == "FALL"
            and det.conf >= threshold
            and self._fall_box_is_plausible(det, frame_shape)
            and not self._fall_is_suppressed_by_normal(det, detections)
        ]

    def _fall_box_is_plausible(
        self,
        det: Detection,
        frame_shape: Optional[Tuple[int, ...]],
    ) -> bool:
        x1, y1, x2, y2 = det.xyxy
        width = max(1, x2 - x1)
        height = max(1, y2 - y1)
        vertical_ratio = height / width
        if (
            det.conf < self.config.fall_vertical_reject_under
            and vertical_ratio >= self.config.fall_vertical_ratio
        ):
            return False

        aspect = min(width, height) / max(width, height)
        if aspect < self.config.fall_min_aspect_ratio:
            return False

        if frame_shape is None:
            return True

        frame_h, frame_w = frame_shape[:2]
        frame_area = max(1, frame_w * frame_h)
        area_ratio = (width * height) / frame_area
        return self.config.fall_min_area_ratio <= area_ratio <= self.config.fall_max_area_ratio

    def _fall_is_suppressed_by_normal(
        self,
        fall_det: Detection,
        detections: Sequence[Detection],
    ) -> bool:
        if not self.config.fall_normal_suppression:
            return False

        for det in detections:
            if det.display_label != "NORMAL":
                continue
            if bbox_iou(fall_det.xyxy, det.xyxy) < self.config.fall_normal_iou_thr:
                continue
            if det.conf + self.config.fall_normal_conf_margin >= fall_det.conf:
                return True

        return False


def pose_confirms_fall(event: Optional[Dict[str, Any]]) -> bool:
    if not event:
        return False
    main_person = event.get("main_person") or {}
    return (
        event.get("risk_level") in {"POSE_WARNING", "FALL_ALERT"}
        or int(event.get("num_horizontal_candidates") or 0) > 0
        or bool(main_person.get("horizontal_pose"))
    )


def detection_from_pose_person(person: Dict[str, Any]) -> Optional[Detection]:
    bbox = person.get("bbox")
    if not isinstance(bbox, list) or len(bbox) < 4:
        return None
    try:
        x1, y1, x2, y2 = [int(round(float(v))) for v in bbox[:4]]
    except (TypeError, ValueError):
        return None
    if x2 <= x1 or y2 <= y1:
        return None

    conf = person.get("pose_quality")
    try:
        confidence = float(conf)
    except (TypeError, ValueError):
        confidence = 0.6

    return Detection(
        label="rtmo_horizontal_pose",
        display_label="FALL",
        conf=max(0.01, min(confidence, 1.0)),
        xyxy=(x1, y1, x2, y2),
    )


def resolve_alert_decision(
    config: ServiceConfig,
    best_fall: Optional[Detection],
    rtmo_confirmed: bool,
    rtmo_ran: bool,
    rtmo_error: Optional[str],
) -> Tuple[bool, Dict[str, Any]]:
    gate = {
        "enabled": config.rtmo_confirm_enabled,
        "required": False,
        "accepted": False,
        "suppressed": False,
        "rtmo_confirmed": bool(rtmo_confirmed),
        "rtmo_ran": bool(rtmo_ran),
        "rtmo_confirm_under": config.rtmo_confirm_under,
        "reason": "No YOLO fall candidate",
    }

    if best_fall is None:
        return False, gate

    gate["yolo_confidence"] = round(float(best_fall.conf), 4)

    if not config.rtmo_confirm_enabled:
        gate["accepted"] = True
        gate["reason"] = "YOLO fall candidate accepted; RTMO confirmation disabled"
        return True, gate

    if best_fall.conf >= config.rtmo_confirm_under:
        gate["accepted"] = True
        gate["reason"] = "YOLO confidence is high enough for direct alert"
        return True, gate

    gate["required"] = True
    if rtmo_confirmed:
        gate["accepted"] = True
        gate["reason"] = "YOLO candidate confirmed by RTMO horizontal pose"
        return True, gate

    if not rtmo_ran:
        gate["rtmo_error"] = rtmo_error or "RTMO did not run"
        if config.rtmo_fail_open:
            gate["accepted"] = True
            gate["reason"] = "RTMO unavailable; YOLO candidate kept because fail-open is enabled"
            return True, gate
        gate["suppressed"] = True
        gate["reason"] = "RTMO unavailable; YOLO candidate suppressed"
        return False, gate

    gate["suppressed"] = True
    gate["reason"] = "YOLO candidate suppressed because RTMO did not confirm horizontal pose"
    return False, gate


def display_detections(
    detections: Sequence[Detection],
    best_fall: Optional[Detection],
    alert: bool,
    min_conf: float,
) -> List[Detection]:
    if alert and best_fall is not None:
        return [best_fall]
    return [
        det for det in detections
        if det.display_label != "FALL" and det.conf >= min_conf
    ]


def elapsed_ms(start: float) -> int:
    return int(round((time.perf_counter() - start) * 1000))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=json_default), encoding="utf-8")


def json_default(value: Any) -> Any:
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    return str(value)


def normalize_label(label: str) -> str:
    label_lower = str(label).lower()
    if any(keyword in label_lower for keyword in FALL_KEYWORDS):
        return "FALL"
    if any(keyword in label_lower for keyword in NORMAL_KEYWORDS):
        return "NORMAL"
    return str(label).upper()


def parse_yolo_results(results: Iterable[Any]) -> List[Detection]:
    detections: List[Detection] = []
    for result in results:
        names = getattr(result, "names", {})
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            continue

        for box in boxes:
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
            conf = float(box.conf[0]) if box.conf is not None else 0.0
            cls_id = int(box.cls[0]) if box.cls is not None else -1
            raw_label = str(names.get(cls_id, cls_id)) if isinstance(names, dict) else str(cls_id)
            detections.append(
                Detection(
                    label=raw_label,
                    display_label=normalize_label(raw_label),
                    conf=conf,
                    xyxy=(x1, y1, x2, y2),
                )
            )
    return detections


def crop_roi(frame, bbox: Tuple[int, int, int, int], padding: int):
    height, width = frame.shape[:2]
    x1, y1, x2, y2 = bbox
    x1_c = max(0, int(x1) - padding)
    y1_c = max(0, int(y1) - padding)
    x2_c = min(width, int(x2) + padding)
    y2_c = min(height, int(y2) + padding)
    crop = frame[y1_c:y2_c, x1_c:x2_c]
    if crop.size == 0:
        return frame, 0, 0
    return crop, x1_c, y1_c


def make_tiles(frame, grid: int, overlap: float) -> List[Tuple[int, int, int, int]]:
    height, width = frame.shape[:2]
    grid = max(1, int(grid))
    overlap = max(0.0, min(float(overlap), 0.8))
    tile_w = max(1, int(width / grid))
    tile_h = max(1, int(height / grid))
    step_x = max(1, int(tile_w * (1 - overlap)))
    step_y = max(1, int(tile_h * (1 - overlap)))

    x_starts = list(range(0, max(1, width - tile_w + 1), step_x))
    y_starts = list(range(0, max(1, height - tile_h + 1), step_y))
    if x_starts[-1] != width - tile_w:
        x_starts.append(max(0, width - tile_w))
    if y_starts[-1] != height - tile_h:
        y_starts.append(max(0, height - tile_h))

    return [
        (x0, y0, min(width, x0 + tile_w), min(height, y0 + tile_h))
        for y0 in y_starts
        for x0 in x_starts
    ]


def nms_detections(detections: List[Detection], iou_thr: float) -> List[Detection]:
    detections = sorted(detections, key=lambda det: det.conf, reverse=True)
    kept: List[Detection] = []
    for det in detections:
        if all(bbox_iou(det.xyxy, kept_det.xyxy) < iou_thr for kept_det in kept):
            kept.append(det)
    return kept


def bbox_iou(box_a, box_b) -> float:
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b
    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)
    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h
    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = area_a + area_b - inter_area
    if union <= 0:
        return 0.0
    return inter_area / union


def draw_result(frame, detections: Sequence[Detection], alert: bool, risk_level: str):
    canvas = frame.copy()
    for det in detections:
        x1, y1, x2, y2 = det.xyxy
        color = (0, 0, 255) if det.display_label == "FALL" else (0, 255, 0)
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            canvas,
            f"{det.display_label} {det.conf:.2f}",
            (x1, max(25, y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            color,
            2,
        )

    banner_color = (0, 0, 255) if alert else (0, 160, 0)
    cv2.rectangle(canvas, (0, 0), (canvas.shape[1], 52), banner_color, -1)
    cv2.putText(
        canvas,
        f"Frame: 0 | {risk_level}",
        (14, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.85,
        (255, 255, 255),
        2,
    )
    return canvas


def flatten_instances(obj: Any) -> List[Dict[str, Any]]:
    results = []
    if isinstance(obj, dict):
        if "keypoints" in obj or "bbox" in obj:
            results.append(obj)
        for value in obj.values():
            results.extend(flatten_instances(value))
    elif isinstance(obj, list):
        for item in obj:
            results.extend(flatten_instances(item))
    return results


def normalize_bbox(bbox: Any) -> List[float]:
    if bbox is None:
        return []
    if isinstance(bbox, np.ndarray):
        bbox = bbox.tolist()
    if isinstance(bbox, list) and bbox and isinstance(bbox[0], list):
        bbox = bbox[0]
    if not isinstance(bbox, list) or len(bbox) < 4:
        return []
    return [float(v) for v in bbox[:4]]


def bbox_from_keypoints(keypoints: Any) -> List[float]:
    points = normalize_keypoints(keypoints)
    if not points:
        return []
    xs = [float(point[0]) for point in points if len(point) >= 2]
    ys = [float(point[1]) for point in points if len(point) >= 2]
    if not xs or not ys:
        return []
    return [min(xs), min(ys), max(xs), max(ys)]


def normalize_keypoints(keypoints: Any) -> List[List[float]]:
    if keypoints is None:
        return []
    if isinstance(keypoints, np.ndarray):
        keypoints = keypoints.tolist()
    if not isinstance(keypoints, list) or not keypoints:
        return []
    if isinstance(keypoints[0], list):
        if keypoints and keypoints[0] and isinstance(keypoints[0][0], (int, float)):
            return keypoints
        return keypoints[0] if keypoints[0] else []
    if isinstance(keypoints[0], (int, float)):
        stride = 3 if len(keypoints) >= 51 else 2
        points = []
        for index in range(0, len(keypoints), stride):
            if index + 1 < len(keypoints):
                points.append([float(keypoints[index]), float(keypoints[index + 1])])
        return points
    return []


def pose_quality(inst: Dict[str, Any]) -> float:
    scores = inst.get("keypoint_scores", [])
    if isinstance(scores, np.ndarray):
        scores = scores.tolist()
    if isinstance(scores, list) and scores and isinstance(scores[0], list):
        scores = scores[0]
    values = []
    for score in scores:
        try:
            values.append(float(score))
        except Exception:
            pass
    if not values:
        return 0.0
    return sum(values) / len(values)


def bbox_area(box: Sequence[float]) -> float:
    if len(box) < 4:
        return 0.0
    x1, y1, x2, y2 = box
    return max(0.0, x2 - x1) * max(0.0, y2 - y1)


def is_horizontal(box: Sequence[float], ratio_thr: float) -> bool:
    if len(box) < 4:
        return False
    x1, y1, x2, y2 = box
    width = max(1.0, x2 - x1)
    height = max(1.0, y2 - y1)
    return (width / height) >= ratio_thr


def build_pose_event(
    rtmo_result: Any,
    *,
    source: str,
    image_name: str,
    x_offset: int,
    y_offset: int,
    min_area: float,
    min_quality: float,
    horizontal_ratio: float,
) -> Dict[str, Any]:
    raw_instances = flatten_instances(rtmo_result)
    candidates = []

    for index, inst in enumerate(raw_instances):
        bbox = normalize_bbox(inst.get("bbox", []))
        if bbox:
            bbox[0] += x_offset
            bbox[1] += y_offset
            bbox[2] += x_offset
            bbox[3] += y_offset
        else:
            bbox = bbox_from_keypoints(inst.get("keypoints", []))
            if bbox:
                bbox[0] += x_offset
                bbox[1] += y_offset
                bbox[2] += x_offset
                bbox[3] += y_offset

        area = bbox_area(bbox)
        quality = pose_quality(inst)
        if area < min_area or quality < min_quality:
            continue

        horizontal = is_horizontal(bbox, horizontal_ratio)
        candidates.append(
            {
                "person_id": index,
                "bbox": [round(v, 2) for v in bbox],
                "bbox_area": round(area, 2),
                "pose_quality": round(quality, 4),
                "horizontal_pose": horizontal,
                "bbox_score": to_float(inst.get("bbox_score", None)),
            }
        )

    horizontal_candidates = [item for item in candidates if item["horizontal_pose"]]
    if horizontal_candidates:
        main_person = max(
            horizontal_candidates,
            key=lambda item: item["bbox_area"] * max(item["pose_quality"], 0.01),
        )
        risk_level = "POSE_WARNING"
        reason = "RTMO detected horizontal body pose"
    elif candidates:
        main_person = max(candidates, key=lambda item: item["bbox_area"])
        risk_level = "NORMAL"
        reason = "RTMO did not detect horizontal body pose"
    else:
        main_person = None
        risk_level = "NORMAL"
        reason = "No valid RTMO person kept after filtering"

    return {
        "source": source,
        "image_name": image_name,
        "frame": 0,
        "event": "POSE",
        "risk_level": risk_level,
        "reason": reason,
        "num_persons_raw": len(raw_instances),
        "num_persons_kept": len(candidates),
        "num_horizontal_candidates": len(horizontal_candidates),
        "main_person": main_person,
        "cascaded_offset": {"x_offset": x_offset, "y_offset": y_offset},
    }


def to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, np.ndarray):
        value = value.tolist()
    if isinstance(value, list) and value:
        value = value[0]
    try:
        return float(value)
    except Exception:
        return None


def risk_priority(risk_level: str) -> int:
    return {"NORMAL": 0, "POSE_WARNING": 1, "FALL_ALERT": 2}.get(risk_level, 0)


def fuse_events(yolo_events: List[Dict[str, Any]], rtmo_events: List[Dict[str, Any]]) -> Dict[str, Any]:
    fused: Dict[str, Dict[str, Any]] = {}

    for event in yolo_events:
        source = event.get("source", "")
        frame = int(event.get("frame", 0))
        key = f"{source}::{frame}"
        fused[key] = {
            "source": source,
            "frame": frame,
            "final_decision": "FALL_ALERT",
            "risk_level": "FALL_ALERT",
            "reason": "YOLO detected FALL",
            "yolo_result": event,
            "rtmo_result": None,
            "alert_image": event.get("alert_image", ""),
        }

    for event in rtmo_events:
        source = event.get("source", "")
        frame = int(event.get("frame", 0))
        key = f"{source}::{frame}"
        rtmo_risk = event.get("risk_level", "POSE_WARNING")
        if rtmo_risk not in {"NORMAL", "POSE_WARNING", "FALL_ALERT"}:
            rtmo_risk = "POSE_WARNING"

        if key not in fused:
            reason = (
                "RTMO detected horizontal body pose"
                if rtmo_risk != "NORMAL"
                else "RTMO did not confirm fall posture"
            )
            fused[key] = {
                "source": source,
                "frame": frame,
                "final_decision": rtmo_risk,
                "risk_level": rtmo_risk,
                "reason": reason,
                "yolo_result": None,
                "rtmo_result": event,
                "alert_image": event.get("alert_image", ""),
            }
            continue

        fused[key]["rtmo_result"] = event
        if risk_priority(rtmo_risk) > risk_priority(fused[key]["risk_level"]):
            fused[key]["risk_level"] = rtmo_risk
            fused[key]["final_decision"] = rtmo_risk
            fused[key]["reason"] = "RTMO risk is higher than YOLO result"

    final_events = sorted(fused.values(), key=lambda item: (item.get("source", ""), int(item.get("frame", 0))))
    summary_by_source: Dict[str, Dict[str, Any]] = {}
    for event in final_events:
        source = event["source"]
        summary = summary_by_source.setdefault(
            source,
            {
                "total_events": 0,
                "fall_alert_count": 0,
                "pose_warning_count": 0,
                "normal_count": 0,
                "first_alert_frame": "",
                "max_yolo_conf": 0.0,
            },
        )
        summary["total_events"] += 1
        risk = event["risk_level"]
        if risk == "FALL_ALERT":
            summary["fall_alert_count"] += 1
            if summary["first_alert_frame"] == "":
                summary["first_alert_frame"] = event["frame"]
        elif risk == "POSE_WARNING":
            summary["pose_warning_count"] += 1
        else:
            summary["normal_count"] += 1

        yolo_result = event.get("yolo_result")
        if yolo_result:
            summary["max_yolo_conf"] = max(
                summary["max_yolo_conf"],
                float(yolo_result.get("confidence", 0.0)),
            )

    return {
        "generated_at": local_now_str(),
        "generated_at_timezone": local_timezone_name(),
        "yolo_event_count": len(yolo_events),
        "rtmo_event_count": len(rtmo_events),
        "final_event_count": len(final_events),
        "events": final_events,
        "summary_by_source": summary_by_source,
    }


def is_oom(exc: BaseException) -> bool:
    text = str(exc).lower()
    return "out of memory" in text or "cuda oom" in text


def clear_cuda_cache() -> None:
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass


def configure_torch_runtime(device: str) -> None:
    if device == "cpu":
        return
    try:
        import torch

        torch.set_grad_enabled(False)
        if torch.cuda.is_available():
            torch.backends.cudnn.benchmark = True
    except Exception:
        pass
