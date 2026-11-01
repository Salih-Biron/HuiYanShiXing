import argparse
import csv
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List, Optional, Tuple

import cv2


PROJECT_ROOT = Path(__file__).resolve().parents[1]

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv", ".wmv"}

FALL_KEYWORDS = {"fall", "fallen", "down", "lying", "lie", "摔倒", "跌倒", "倒地"}
NORMAL_KEYWORDS = {"standing", "stand", "normal", "walk", "walking", "other"}


@dataclass
class Detection:
    label: str
    display_label: str
    conf: float
    xyxy: Tuple[int, int, int, int]


@dataclass
class FrameResult:
    status: str
    risk_level: str
    detections: List[Detection]
    alert: bool


def project_path(path_text: str) -> Path:
    path = Path(path_text)
    if path.is_absolute():
        return path
    return PROJECT_ROOT / path


def output_base(args) -> Path:
    if args.output_dir:
        return project_path(args.output_dir)
    return PROJECT_ROOT / "outputs"


def event_output_path(args) -> Path:
    if args.event_output:
        return project_path(args.event_output)
    return PROJECT_ROOT / "yolo_events/events_current.json"


def ensure_dirs(args=None) -> None:
    base = output_base(args) if args is not None else PROJECT_ROOT / "outputs"
    (base / "videos").mkdir(parents=True, exist_ok=True)
    (base / "images").mkdir(parents=True, exist_ok=True)
    (base / "alerts").mkdir(parents=True, exist_ok=True)
    (base / "logs").mkdir(parents=True, exist_ok=True)
    (PROJECT_ROOT / "yolo_events").mkdir(parents=True, exist_ok=True)

    if args is not None:
        event_output_path(args).parent.mkdir(parents=True, exist_ok=True)


def reset_event_file(args) -> Path:
    event_path = event_output_path(args)
    event_path.parent.mkdir(parents=True, exist_ok=True)
    event_path.write_text("[]", encoding="utf-8")
    return event_path


def normalize_label(label: str) -> str:
    label_lower = str(label).lower()

    if any(keyword in label_lower for keyword in FALL_KEYWORDS):
        return "FALL"

    if any(keyword in label_lower for keyword in NORMAL_KEYWORDS):
        return "NORMAL"

    return str(label).upper()


def load_yolo_model(weights: str) -> Optional[Any]:
    weight_path = project_path(weights)

    if not weight_path.exists():
        print(f"[WARN] weights not found: {weight_path}")
        print("[WARN] running without model. Use --debug-alert-every to test alert pipeline.")
        return None

    try:
        from ultralytics import YOLO
    except Exception as exc:
        print(f"[WARN] failed to import ultralytics: {exc}")
        return None

    model = YOLO(str(weight_path))
    print(f"[OK] YOLO model loaded: {weight_path}")
    return model


def run_yolo(model: Optional[Any], frame) -> List[Detection]:
    if model is None:
        return []

    detections: List[Detection] = []
    results = model.predict(frame, verbose=False, conf=0.10, imgsz=1280)

    for result in results:
        names = result.names
        boxes = getattr(result, "boxes", None)

        if boxes is None:
            continue

        for box in boxes:
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
            conf = float(box.conf[0]) if box.conf is not None else 0.0
            cls_id = int(box.cls[0]) if box.cls is not None else -1
            raw_label = str(names.get(cls_id, cls_id)) if isinstance(names, dict) else str(cls_id)
            display_label = normalize_label(raw_label)

            detections.append(
                Detection(
                    label=raw_label,
                    display_label=display_label,
                    conf=conf,
                    xyxy=(x1, y1, x2, y2),
                )
            )

    return detections


def judge_frame(
    detections: List[Detection],
    frame_index: int,
    debug_alert_every: int,
    fall_threshold: float,
) -> FrameResult:
    status = "NORMAL"
    risk_level = "NORMAL"
    alert = False

    for det in detections:
        if det.display_label == "FALL" and det.conf >= fall_threshold:
            status = "FALL_ALERT"
            risk_level = "FALL ALERT"
            alert = True
            break

    if (
        not detections
        and debug_alert_every > 0
        and frame_index > 0
        and frame_index % debug_alert_every == 0
    ):
        status = "DEBUG_ALERT"
        risk_level = "DEBUG ALERT"
        alert = True

    return FrameResult(status, risk_level, detections, alert)


def draw_result(frame, result: FrameResult, frame_index: int):
    canvas = frame.copy()

    for det in result.detections:
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

    banner_color = (0, 0, 255) if result.alert else (0, 160, 0)
    cv2.rectangle(canvas, (0, 0), (canvas.shape[1], 52), banner_color, -1)

    cv2.putText(
        canvas,
        f"Frame: {frame_index} | {result.risk_level}",
        (14, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.85,
        (255, 255, 255),
        2,
    )

    return canvas


def write_log_row(log_path: Path, row: List[Any]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    file_exists = log_path.exists()

    with log_path.open("a", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)

        if not file_exists:
            writer.writerow(
                [
                    "time",
                    "source",
                    "frame",
                    "status",
                    "risk_level",
                    "detections",
                    "alert_image",
                ]
            )

        writer.writerow(row)


def save_yolo_event(
    source: Path,
    frame_index: int,
    result: FrameResult,
    alert_path: str,
    event_path: Path,
    fall_threshold: float = 0.30,
) -> None:
    event_path.parent.mkdir(parents=True, exist_ok=True)

    if event_path.exists():
        try:
            loaded = json.loads(event_path.read_text(encoding="utf-8"))

            if isinstance(loaded, list):
                events = loaded
            elif isinstance(loaded, dict) and isinstance(loaded.get("events"), list):
                events = loaded["events"]
            else:
                events = []
        except Exception:
            events = []
    else:
        events = []

    fall_detections = [
        det for det in result.detections
        if det.display_label == "FALL" and det.conf >= fall_threshold
    ]

    if not fall_detections:
        return

    best_det = max(fall_detections, key=lambda det: det.conf)

    events.append(
        {
            "source": str(source),
            "frame": frame_index,
            "event": "FALL",
            "confidence": round(best_det.conf, 4),
            "bbox": list(best_det.xyxy),
            "risk_level": result.risk_level,
            "alert_image": alert_path,
            "detector_status": result.status,
        }
    )

    event_path.write_text(
        json.dumps(events, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


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


def nms_detections(detections: List[Detection], iou_thr: float = 0.5) -> List[Detection]:
    detections = sorted(detections, key=lambda d: d.conf, reverse=True)
    kept: List[Detection] = []

    for det in detections:
        should_keep = True

        for kept_det in kept:
            if bbox_iou(det.xyxy, kept_det.xyxy) >= iou_thr:
                should_keep = False
                break

        if should_keep:
            kept.append(det)

    return kept


def run_yolo_tiled_for_image(model: Optional[Any], frame, args) -> List[Detection]:
    if model is None:
        return []

    height, width = frame.shape[:2]

    grid = max(1, int(args.tiled_grid))
    overlap = max(0.0, min(float(args.tiled_overlap), 0.8))

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

    tiled_fall_detections: List[Detection] = []

    for y0 in y_starts:
        for x0 in x_starts:
            x1 = min(width, x0 + tile_w)
            y1 = min(height, y0 + tile_h)

            tile = frame[y0:y1, x0:x1]

            results = model.predict(
                tile,
                verbose=False,
                conf=args.tiled_conf,
                imgsz=args.tiled_imgsz,
            )

            for result in results:
                names = result.names
                boxes = getattr(result, "boxes", None)

                if boxes is None:
                    continue

                for box in boxes:
                    bx1, by1, bx2, by2 = [int(v) for v in box.xyxy[0].tolist()]
                    conf = float(box.conf[0]) if box.conf is not None else 0.0
                    cls_id = int(box.cls[0]) if box.cls is not None else -1
                    raw_label = str(names.get(cls_id, cls_id)) if isinstance(names, dict) else str(cls_id)
                    display_label = normalize_label(raw_label)

                    if display_label != "FALL":
                        continue

                    if conf < args.tiled_fall_threshold:
                        continue

                    tiled_fall_detections.append(
                        Detection(
                            label=raw_label,
                            display_label="FALL",
                            conf=conf,
                            xyxy=(bx1 + x0, by1 + y0, bx2 + x0, by2 + y0),
                        )
                    )

    return nms_detections(tiled_fall_detections, iou_thr=0.45)


def detection_text(detections: List[Detection]) -> str:
    return "; ".join([f"{d.display_label}:{d.conf:.2f}" for d in detections])


def write_run_result_json(
    path: Path,
    source: Path,
    result: FrameResult,
    output_path: Path,
    alert_path: str,
    event_path: Path,
) -> None:
    payload = {
        "success": True,
        "source": str(source),
        "status": result.status,
        "risk_level": result.risk_level,
        "alert": result.alert,
        "detections": [
            {
                "label": d.label,
                "display_label": d.display_label,
                "confidence": round(d.conf, 4),
                "bbox": list(d.xyxy),
            }
            for d in result.detections
        ],
        "files": {
            "output": str(output_path),
            "alert_image": alert_path,
            "yolo_events": str(event_path),
        },
    }

    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def process_image(source: Path, model: Optional[Any], args) -> None:
    base = output_base(args)
    event_path = reset_event_file(args)

    frame = cv2.imread(str(source))

    if frame is None:
        raise RuntimeError(f"failed to read image: {source}")

    detections = run_yolo(model, frame)
    result = judge_frame(detections, 0, args.debug_alert_every, args.fall_threshold)

    if model is not None and not result.alert and not args.disable_tiled:
        print("[INFO] normal image YOLO has no alert, running tiled YOLO fallback...")
        tiled_fall_detections = run_yolo_tiled_for_image(model, frame, args)

        if tiled_fall_detections:
            detections = detections + tiled_fall_detections
            result = FrameResult(
                status="TILED_FALL_ALERT",
                risk_level="FALL ALERT",
                detections=detections,
                alert=True,
            )
            print(f"[OK] tiled YOLO triggered FALL ALERT, falls={len(tiled_fall_detections)}")
        else:
            print("[INFO] tiled YOLO found no FALL above threshold")

    drawn = draw_result(frame, result, 0)

    output_path = base / "images" / f"{source.stem}_result.jpg"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output_path), drawn)

    alert_path = ""

    if result.alert:
        alert_path = str(base / "alerts" / f"{source.stem}_alert.jpg")
        Path(alert_path).parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(alert_path, drawn)

        event_threshold = args.tiled_fall_threshold if result.status == "TILED_FALL_ALERT" else args.fall_threshold
        save_yolo_event(source, 0, result, alert_path, event_path, event_threshold)

    log_path = base / "logs" / "video_demo_log.csv"

    write_log_row(
        log_path,
        [
            time.strftime("%Y-%m-%d %H:%M:%S"),
            str(source),
            0,
            result.status,
            result.risk_level,
            detection_text(detections),
            alert_path,
        ],
    )

    write_run_result_json(
        base / "run_video_demo_result.json",
        source,
        result,
        output_path,
        alert_path,
        event_path,
    )

    print(f"[OK] image result saved: {output_path}")
    print(f"[OK] event saved: {event_path}")
    print(f"[OK] log saved: {log_path}")


def process_video(source: Path, model: Optional[Any], args) -> None:
    base = output_base(args)
    event_path = reset_event_file(args)

    cap = cv2.VideoCapture(str(source))

    if not cap.isOpened():
        raise RuntimeError(f"failed to read video: {source}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    output_path = base / "videos" / f"{source.stem}_result.mp4"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    writer = cv2.VideoWriter(
        str(output_path),
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (width, height),
    )

    if not writer.isOpened():
        cap.release()
        raise RuntimeError(f"failed to create output video: {output_path}")

    log_path = base / "logs" / "video_demo_log.csv"

    print(f"[INFO] input video: {source}")
    print(f"[INFO] size: {width}x{height}, fps: {fps:.2f}, frames: {total_frames}")
    print(f"[INFO] output video: {output_path}")

    frame_index = 0
    alert_count = 0
    last_alert_frame = -999999
    start_time = time.time()

    while True:
        ok, frame = cap.read()

        if not ok:
            break

        detections = run_yolo(model, frame)

        result = judge_frame(
            detections,
            frame_index,
            args.debug_alert_every,
            args.fall_threshold,
        )

        drawn = draw_result(frame, result, frame_index)
        writer.write(drawn)

        alert_path = ""

        if result.alert and frame_index - last_alert_frame >= args.alert_interval:
            alert_count += 1
            last_alert_frame = frame_index

            alert_path = str(base / "alerts" / f"{source.stem}_frame_{frame_index:06d}_alert.jpg")
            Path(alert_path).parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(alert_path, drawn)

            save_yolo_event(source, frame_index, result, alert_path, event_path, args.fall_threshold)

        if result.alert or frame_index % args.log_every == 0:
            write_log_row(
                log_path,
                [
                    time.strftime("%Y-%m-%d %H:%M:%S"),
                    str(source),
                    frame_index,
                    result.status,
                    result.risk_level,
                    detection_text(detections),
                    alert_path,
                ],
            )

        if frame_index % 50 == 0:
            total_text = total_frames if total_frames > 0 else "?"
            print(f"[RUN] processed {frame_index}/{total_text} frames")

        frame_index += 1

    cap.release()
    writer.release()

    elapsed = time.time() - start_time
    avg_fps = frame_index / elapsed if elapsed > 0 else 0

    summary = {
        "success": True,
        "source": str(source),
        "status": "FINISHED",
        "output_video": str(output_path),
        "event_path": str(event_path),
        "log_path": str(log_path),
        "total_frames": frame_index,
        "alert_count": alert_count,
        "average_fps": round(avg_fps, 4),
    }

    (base / "run_video_demo_result.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("")
    print("[DONE] video processing finished")
    print(f"[OK] output video: {output_path}")
    print(f"[OK] alert dir: {base / 'alerts'}")
    print(f"[OK] event file: {event_path}")
    print(f"[OK] log file: {log_path}")
    print(f"[OK] total frames: {frame_index}")
    print(f"[OK] alert count: {alert_count}")
    print(f"[OK] average speed: {avg_fps:.2f} FPS")


def parse_args():
    parser = argparse.ArgumentParser(description="Huiyan video demo")

    parser.add_argument("--source", required=True)
    parser.add_argument("--weights", default="weights/yolo/best.pt")
    parser.add_argument("--log-every", type=int, default=30)
    parser.add_argument("--alert-interval", type=int, default=30)
    parser.add_argument("--debug-alert-every", type=int, default=0)
    parser.add_argument("--fall-threshold", type=float, default=0.25)

    parser.add_argument("--disable-tiled", action="store_true")
    parser.add_argument("--tiled-grid", type=int, default=3)
    parser.add_argument("--tiled-overlap", type=float, default=0.20)
    parser.add_argument("--tiled-conf", type=float, default=0.05)
    parser.add_argument("--tiled-imgsz", type=int, default=960)
    parser.add_argument("--tiled-fall-threshold", type=float, default=0.15)

    parser.add_argument("--output-dir", default=None, help="Write images/videos/logs under this directory")
    parser.add_argument("--event-output", default=None, help="Write YOLO fall events to this JSON file")

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ensure_dirs(args)

    source = project_path(args.source)

    if not source.exists():
        raise FileNotFoundError(f"input file not found: {source}")

    model = load_yolo_model(args.weights)
    suffix = source.suffix.lower()

    if suffix in IMAGE_EXTS:
        process_image(source, model, args)
    elif suffix in VIDEO_EXTS:
        process_video(source, model, args)
    else:
        raise ValueError(f"unsupported file type: {suffix}")


if __name__ == "__main__":
    main()
