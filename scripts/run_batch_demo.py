import argparse
import csv
import shutil
import subprocess
import sys
import time
from pathlib import Path
from collections import defaultdict


PROJECT_ROOT = Path(__file__).resolve().parents[1]

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv", ".wmv"}


def collect_samples():
    samples = []

    image_dir = PROJECT_ROOT / "test_images"
    video_dir = PROJECT_ROOT / "test_videos"

    if image_dir.exists():
        for p in sorted(image_dir.iterdir()):
            if p.suffix.lower() in IMAGE_EXTS:
                samples.append(("image", p))

    if video_dir.exists():
        for p in sorted(video_dir.iterdir()):
            if p.suffix.lower() in VIDEO_EXTS:
                samples.append(("video", p))

    return samples


def backup_and_clear_log():
    log_path = PROJECT_ROOT / "outputs/logs/video_demo_log.csv"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    if log_path.exists():
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        backup_path = log_path.with_name(f"video_demo_log_backup_{timestamp}.csv")
        shutil.copy2(log_path, backup_path)
        log_path.unlink()
        print(f"[INFO] old log backed up to: {backup_path}")

    event_path = PROJECT_ROOT / "yolo_events/events.json"
    if event_path.exists():
        event_path.unlink()
        print(f"[INFO] old yolo events cleared: {event_path}")


def run_one_sample(sample_type, sample_path, weights):
    rel_source = sample_path.relative_to(PROJECT_ROOT)

    cmd = [
        sys.executable,
        str(PROJECT_ROOT / "scripts/run_video_demo.py"),
        "--source",
        str(rel_source),
        "--weights",
        weights,
    ]

    print("")
    print("=" * 80)
    print(f"[RUN] {sample_type}: {rel_source}")
    print("=" * 80)

    result = subprocess.run(
        cmd,
        cwd=str(PROJECT_ROOT),
        text=True,
    )

    return result.returncode == 0


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


def build_summary(samples):
    log_path = PROJECT_ROOT / "outputs/logs/video_demo_log.csv"
    summary_path = PROJECT_ROOT / "outputs/logs/summary.csv"
    summary_path.parent.mkdir(parents=True, exist_ok=True)

    stats = defaultdict(lambda: {
        "input_type": "",
        "total_log_rows": 0,
        "alert_rows": 0,
        "fall_rows": 0,
        "max_fall_conf": 0.0,
        "first_alert_frame": "",
        "risk_level": "NORMAL",
    })

    sample_type_map = {
        str(path): sample_type for sample_type, path in samples
    }

    if log_path.exists():
        with log_path.open("r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)

            for row in reader:
                source = row.get("source", "")
                status = row.get("status", "")
                frame = row.get("frame", "")
                detections = row.get("detections", "")

                stats[source]["total_log_rows"] += 1

                if source in sample_type_map:
                    stats[source]["input_type"] = sample_type_map[source]
                else:
                    suffix = Path(source).suffix.lower()
                    if suffix in IMAGE_EXTS:
                        stats[source]["input_type"] = "image"
                    elif suffix in VIDEO_EXTS:
                        stats[source]["input_type"] = "video"

                if status == "FALL_ALERT":
                    stats[source]["alert_rows"] += 1
                    stats[source]["risk_level"] = "FALL_ALERT"

                    if stats[source]["first_alert_frame"] == "":
                        stats[source]["first_alert_frame"] = frame

                for item in detections.split(";"):
                    label, conf = parse_detection_item(item)

                    if label == "FALL":
                        stats[source]["fall_rows"] += 1

                        if conf is not None:
                            stats[source]["max_fall_conf"] = max(
                                stats[source]["max_fall_conf"],
                                conf,
                            )

    with summary_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "sample_name",
            "input_type",
            "risk_level",
            "total_log_rows",
            "alert_rows",
            "fall_detected_rows",
            "max_fall_conf",
            "first_alert_frame",
            "output_path",
        ])

        for sample_type, sample_path in samples:
            source_abs = str(sample_path)
            s = stats[source_abs]

            if sample_type == "video":
                output_path = PROJECT_ROOT / "outputs/videos" / f"{sample_path.stem}_result.mp4"
            else:
                output_path = PROJECT_ROOT / "outputs/images" / f"{sample_path.stem}_result.jpg"

            writer.writerow([
                sample_path.name,
                sample_type,
                s["risk_level"],
                s["total_log_rows"],
                s["alert_rows"],
                s["fall_rows"],
                f'{s["max_fall_conf"]:.2f}',
                s["first_alert_frame"],
                str(output_path),
            ])

    return summary_path


def main():
    parser = argparse.ArgumentParser(description="Run Huiyan batch demo")
    parser.add_argument(
        "--weights",
        default="weights/yolo/best.pt",
        help="YOLO weights path",
    )
    parser.add_argument(
        "--keep-old-log",
        action="store_true",
        help="Do not clear old video_demo_log.csv before batch run",
    )

    args = parser.parse_args()

    samples = collect_samples()

    if not samples:
        print("[ERROR] no samples found in test_images/ or test_videos/")
        sys.exit(1)

    print(f"[INFO] found {len(samples)} samples")

    if not args.keep_old_log:
        backup_and_clear_log()

    success_count = 0
    fail_count = 0

    for sample_type, sample_path in samples:
        ok = run_one_sample(sample_type, sample_path, args.weights)

        if ok:
            success_count += 1
        else:
            fail_count += 1
            print(f"[WARN] failed sample: {sample_path}")

    import subprocess

    clean_summary_cmd = [
        sys.executable,
        str(PROJECT_ROOT / "scripts/build_summary.py"),
    ]

    subprocess.run(
        clean_summary_cmd,
        cwd=str(PROJECT_ROOT),
        check=False,
    )

    rtmo_cmd = [
        sys.executable,
        str(PROJECT_ROOT / "scripts/rtmo_to_pose_events.py"),
    ]

    subprocess.run(
        rtmo_cmd,
        cwd=str(PROJECT_ROOT),
        check=False,
    )

    fusion_cmd = [
        sys.executable,
        str(PROJECT_ROOT / "scripts/system_output_fusion.py"),
    ]

    subprocess.run(
        fusion_cmd,
        cwd=str(PROJECT_ROOT),
        check=False,
    )

    summary_path = PROJECT_ROOT / "outputs/logs/summary.csv"
    fusion_path = PROJECT_ROOT / "outputs/system_fusion_output.json"

    print("")
    print("=" * 80)
    print("[DONE] batch finished")
    print(f"[OK] success: {success_count}")
    print(f"[OK] failed: {fail_count}")
    print(f"[OK] clean summary saved: {summary_path}")
    print(f"[OK] fusion output saved: {fusion_path}")
    print("=" * 80)


if __name__ == "__main__":
    main()
