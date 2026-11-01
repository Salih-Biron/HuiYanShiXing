import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv", ".wmv"}


def collect_samples():
    samples = []

    for folder, input_type, exts in [
        ("test_images", "image", IMAGE_EXTS),
        ("test_videos", "video", VIDEO_EXTS),
    ]:
        sample_dir = PROJECT_ROOT / folder

        if not sample_dir.exists():
            continue

        for path in sorted(sample_dir.iterdir()):
            if path.suffix.lower() in exts:
                samples.append((input_type, path))

    return samples


def parse_detection_item(item):
    item = item.strip()

    if ":" not in item:
        return None, None

    label, conf_text = item.split(":", 1)
    label = label.strip()

    try:
        conf = float(conf_text.strip())
    except Exception:
        conf = None

    return label, conf


def main():
    parser = argparse.ArgumentParser(description="Build clean Huiyan summary.csv")
    parser.add_argument("--fall-threshold", type=float, default=0.30)
    args = parser.parse_args()

    log_path = PROJECT_ROOT / "outputs/logs/video_demo_log.csv"
    event_path = PROJECT_ROOT / "yolo_events/events.json"
    summary_path = PROJECT_ROOT / "outputs/logs/summary.csv"

    samples = collect_samples()

    stats = defaultdict(lambda: {
        "input_type": "",
        "total_log_rows": 0,
        "alert_rows": 0,
        "threshold_fall_rows": 0,
        "max_fall_conf": 0.0,
        "risk_level": "NORMAL",
        "first_alert_frame": "",
        "yolo_event_count": 0,
        "max_event_conf": 0.0,
    })

    for input_type, sample_path in samples:
        stats[str(sample_path)]["input_type"] = input_type

    if log_path.exists():
        with log_path.open("r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)

            for row in reader:
                source = row.get("source", "")
                status = row.get("status", "")
                frame = row.get("frame", "")
                detections = row.get("detections", "")

                stats[source]["total_log_rows"] += 1

                if "FALL_ALERT" in status:
                    stats[source]["alert_rows"] += 1
                    stats[source]["risk_level"] = "FALL_ALERT"

                    if stats[source]["first_alert_frame"] == "":
                        stats[source]["first_alert_frame"] = frame

                for item in detections.split(";"):
                    label, conf = parse_detection_item(item)

                    if label == "FALL" and conf is not None:
                        stats[source]["max_fall_conf"] = max(
                            stats[source]["max_fall_conf"],
                            conf,
                        )

                        if conf >= args.fall_threshold:
                            stats[source]["threshold_fall_rows"] += 1

    if event_path.exists():
        try:
            events = json.loads(event_path.read_text(encoding="utf-8"))
        except Exception:
            events = []

        if isinstance(events, dict):
            events = events.get("events", [])

        for event in events:
            source = event.get("source", "")
            conf = float(event.get("confidence", 0.0))
            frame = str(event.get("frame", ""))

            stats[source]["yolo_event_count"] += 1
            stats[source]["max_event_conf"] = max(stats[source]["max_event_conf"], conf)

            if stats[source]["first_alert_frame"] == "":
                stats[source]["first_alert_frame"] = frame

            stats[source]["risk_level"] = "FALL_ALERT"

    summary_path.parent.mkdir(parents=True, exist_ok=True)

    with summary_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)

        writer.writerow([
            "sample_name",
            "input_type",
            "risk_level",
            "total_log_rows",
            "alert_rows",
            "threshold_fall_rows",
            "max_fall_conf",
            "yolo_event_count",
            "max_event_conf",
            "first_alert_frame",
            "output_path",
        ])

        for input_type, sample_path in samples:
            source = str(sample_path)
            s = stats[source]

            if input_type == "video":
                output_path = PROJECT_ROOT / "outputs/videos" / f"{sample_path.stem}_result.mp4"
            else:
                output_path = PROJECT_ROOT / "outputs/images" / f"{sample_path.stem}_result.jpg"

            writer.writerow([
                sample_path.name,
                input_type,
                s["risk_level"],
                s["total_log_rows"],
                s["alert_rows"],
                s["threshold_fall_rows"],
                f'{s["max_fall_conf"]:.2f}',
                s["yolo_event_count"],
                f'{s["max_event_conf"]:.2f}',
                s["first_alert_frame"],
                str(output_path),
            ])

    print(f"[OK] clean summary saved: {summary_path}")


if __name__ == "__main__":
    main()
