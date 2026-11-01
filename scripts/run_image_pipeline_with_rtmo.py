import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import cv2
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "opencv-python"])
    import cv2


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MMPOSE_ROOT = Path(os.environ.get("MMPOSE_ROOT", str(Path(__file__).resolve().parents[2] / "mmpose")))

_PRED_KEYS = ["predictions", "predictions_list", "results", "instances"]


def project_path(path_text: str) -> Path:
    path = Path(path_text)

    if path.is_absolute():
        return path

    return PROJECT_ROOT / path


def path_for_cli(path: Path) -> str:
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def run_cmd(cmd, cwd=None, env=None, title=None):
    if title:
        print("\n" + "=" * 80 + f"\n{title}\n" + "=" * 80)

    print("[CMD]", " ".join(str(x) for x in cmd))

    result = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        env=env,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(f"command failed: {' '.join(str(x) for x in cmd)}")


def _instance_score(inst):
    if not isinstance(inst, dict):
        return 0.0

    kpt_scores = inst.get("keypoint_scores", [])

    if kpt_scores and isinstance(kpt_scores[0], list):
        kpt_scores = kpt_scores[0]

    vals = [float(s) for s in kpt_scores if s]
    avg_kpt = sum(vals) / len(vals) if vals else 0.0
    bbox_score = float(inst.get("bbox_score") or inst.get("score") or 1.0)

    return bbox_score * avg_kpt


def _filter_best_instance(pred_json: Path, is_cascaded: bool):
    if not is_cascaded or not pred_json.exists():
        return

    try:
        raw = json.loads(pred_json.read_text(encoding="utf-8"))
        instances = None

        if isinstance(raw, list):
            instances = raw
        elif isinstance(raw, dict):
            for key in _PRED_KEYS:
                if key in raw and isinstance(raw[key], list):
                    instances = raw[key]
                    break

        if not instances or len(instances) <= 1:
            return

        print(f"[FILTER] {len(instances)} instances → keeping best by score")

        best = max(instances, key=_instance_score)

        if isinstance(raw, list):
            clean = [best]
        else:
            for key in _PRED_KEYS:
                if key in raw and isinstance(raw[key], list):
                    raw[key] = [best]
                    break
            clean = raw

        pred_json.write_text(
            json.dumps(clean, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    except Exception as ex:
        print(f"[WARN] instance filter failed, non-fatal: {ex}")


def _crop_roi(source: Path, roi: list, padding: int, output_dir: Path):
    img = cv2.imread(str(source))

    if img is None:
        print(f"[WARN] cannot read image: {source}")
        return source, 0, 0, False

    height, width = img.shape[:2]

    x1, y1, x2, y2 = roi

    x1_c = max(0, int(x1) - padding)
    y1_c = max(0, int(y1) - padding)
    x2_c = min(width, int(x2) + padding)
    y2_c = min(height, int(y2) + padding)

    crop = img[y1_c:y2_c, x1_c:x2_c]

    if crop.size == 0:
        print("[WARN] ROI crop is empty")
        return source, 0, 0, False

    output_dir.mkdir(parents=True, exist_ok=True)

    out_path = output_dir / f"{source.stem}_crop_roi.png"
    cv2.imwrite(str(out_path), crop)

    return out_path, x1_c, y1_c, True


def load_yolo_events(events_path: Path) -> List[Dict[str, Any]]:
    if not events_path.exists():
        return []

    try:
        raw = json.loads(events_path.read_text(encoding="utf-8"))

        if isinstance(raw, list):
            return raw

        if isinstance(raw, dict) and isinstance(raw.get("events"), list):
            return raw["events"]

    except Exception as ex:
        print(f"[WARN] failed to load YOLO events: {ex}")

    return []


def pick_best_fall_event(events: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    candidates = []

    for event in events:
        if not isinstance(event, dict):
            continue

        if str(event.get("event", "")).upper() != "FALL":
            continue

        bbox = event.get("bbox")

        if not isinstance(bbox, list) or len(bbox) != 4:
            continue

        candidates.append(event)

    if not candidates:
        return None

    return max(candidates, key=lambda e: float(e.get("confidence", 0.0)))


def write_frontend_result(
    result_path: Path,
    source: Path,
    output_dir: Path,
    yolo_events_path: Path,
    rtmo_event_path: Path,
    fusion_output: Path,
    rtmo_source: Path,
    is_cascaded: bool,
    best_event: Optional[Dict[str, Any]],
):
    fusion_data: Any = None

    if fusion_output.exists():
        try:
            fusion_data = json.loads(fusion_output.read_text(encoding="utf-8"))
        except Exception:
            fusion_data = None

    status = "NORMAL"
    risk_level = "NORMAL"

    if best_event is not None:
        status = "FALL_ALERT"
        risk_level = "FALL ALERT"

    if isinstance(fusion_data, dict):
        status = fusion_data.get("status") or fusion_data.get("final_status") or status
        risk_level = fusion_data.get("risk_level") or fusion_data.get("final_risk_level") or risk_level

    payload = {
        "success": True,
        "source": str(source),
        "status": status,
        "risk_level": risk_level,
        "cascaded": is_cascaded,
        "best_yolo_event": best_event,
        "files": {
            "output_dir": str(output_dir),
            "yolo_events": str(yolo_events_path),
            "rtmo_events": str(rtmo_event_path),
            "fusion_output": str(fusion_output),
            "rtmo_source": str(rtmo_source),
        },
        "fusion": fusion_data,
    }

    result_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser(description="Cascaded Pipeline: YOLO → RTMO → Fusion image")

    parser.add_argument("--source", required=True)
    parser.add_argument("--weights", default="outputs/yolo_finetune/camera_fall_v2-2/weights/best.pt")
    parser.add_argument("--rtmo-config", default="configs/rtmo/rtmo_config.py")
    parser.add_argument("--rtmo-weights", default="weights/rtmo/best.pth")

    parser.add_argument("--fall-threshold", type=float, default=0.25)
    parser.add_argument("--tiled-fall-threshold", type=float, default=0.15)
    parser.add_argument("--bbox-thr", type=float, default=0.05)
    parser.add_argument("--kpt-thr", type=float, default=0.3)
    parser.add_argument("--crop-padding", type=int, default=40)

    parser.add_argument(
        "--output-dir",
        default=None,
        help="Per-task output dir, for example outputs/api_results/<task_id>",
    )

    parser.add_argument(
        "--horizontal-ratio",
        type=float,
        default=1.20,
        help="Width/height threshold forwarded to rtmo_current_to_event",
    )

    args = parser.parse_args()

    source = project_path(args.source)
    weights = project_path(args.weights)
    rtmo_config = project_path(args.rtmo_config)
    rtmo_weights = project_path(args.rtmo_weights)
    stem = source.stem

    if args.output_dir:
        output_dir = project_path(args.output_dir)
    else:
        output_dir = PROJECT_ROOT / "outputs" / "api_results" / stem

    output_dir.mkdir(parents=True, exist_ok=True)

    yolo_events_path = output_dir / "yolo_events.json"
    rtmo_pred_dir = output_dir / "rtmo_pose_results"
    rtmo_vis_dir = output_dir / "rtmo_vis"
    rtmo_event_path = output_dir / "pose_events.json"
    fusion_output = output_dir / "fusion_result.json"
    frontend_result = output_dir / "result.json"

    for file_path in [yolo_events_path, rtmo_event_path, fusion_output, frontend_result]:
        if file_path.exists():
            file_path.unlink()

    rtmo_pred_dir.mkdir(parents=True, exist_ok=True)

    for old in rtmo_pred_dir.glob("*.json"):
        try:
            old.unlink()
        except OSError:
            pass

    run_cmd(
        [
            sys.executable,
            str(PROJECT_ROOT / "scripts/run_video_demo.py"),
            "--source", path_for_cli(source),
            "--weights", path_for_cli(weights),
            "--fall-threshold", str(args.fall_threshold),
            "--tiled-fall-threshold", str(args.tiled_fall_threshold),
            "--event-output", str(yolo_events_path),
            "--output-dir", str(output_dir),
        ],
        cwd=PROJECT_ROOT,
        title="[1/4] YOLO detection",
    )

    events = load_yolo_events(yolo_events_path)

    if not yolo_events_path.exists():
        yolo_events_path.write_text("[]", encoding="utf-8")

    best_event = pick_best_fall_event(events)

    if best_event is None:
        print("\n[INFO] no FALL bbox found. Skip RTMO and write NORMAL result.")

        rtmo_event_path.write_text("[]", encoding="utf-8")

        try:
            run_cmd(
                [
                    sys.executable,
                    str(PROJECT_ROOT / "scripts/system_output_fusion.py"),
                    "--yolo-events", path_for_cli(yolo_events_path),
                    "--rtmo-events", path_for_cli(rtmo_event_path),
                    "--output", path_for_cli(fusion_output),
                ],
                cwd=PROJECT_ROOT,
                title="[4/4] YOLO + RTMO fusion",
            )
        except Exception as ex:
            print(f"[WARN] fusion skipped or failed for NORMAL result: {ex}")

        write_frontend_result(
            frontend_result,
            source,
            output_dir,
            yolo_events_path,
            rtmo_event_path,
            fusion_output,
            source,
            False,
            None,
        )

        print("\n" + "=" * 80)
        print("[DONE] pipeline finished")
        print(f"  source      : {source.name}")
        print("  cascaded    : False")
        print(f"  result json : {frontend_result}")
        print("=" * 80)

        return

    roi_bbox = best_event["bbox"]
    crop_padding = args.crop_padding

    print(f"\n[CROP] extracting ROI {roi_bbox} + padding={crop_padding} from {source.name}")

    rtmo_source, x_offset, y_offset, is_cascaded = _crop_roi(
        source,
        roi_bbox,
        crop_padding,
        output_dir / "crop_temp",
    )

    if is_cascaded:
        print(f"[CROP] saved {rtmo_source.name} | offset=({x_offset}, {y_offset})")

    env = os.environ.copy()
    env["PYTHONPATH"] = f"{MMPOSE_ROOT}:{env.get('PYTHONPATH', '')}"

    run_cmd(
        [
            sys.executable,
            str(MMPOSE_ROOT / "demo/inferencer_demo.py"),
            str(rtmo_source),
            "--pose2d", str(rtmo_config),
            "--pose2d-weights", str(rtmo_weights),
            "--device", "cuda:0",
            "--bbox-thr", str(args.bbox_thr),
            "--kpt-thr", str(args.kpt_thr),
            "--draw-bbox",
            "--vis-out-dir", str(rtmo_vis_dir),
            "--pred-out-dir", str(rtmo_pred_dir),
        ],
        cwd=MMPOSE_ROOT,
        env=env,
        title="[2/4] RTMO inference",
    )

    pred_json = rtmo_pred_dir / f"{rtmo_source.stem}.json"

    if not pred_json.exists():
        found = sorted(rtmo_pred_dir.glob("*.json"))

        if found:
            pred_json = found[0]
        else:
            raise FileNotFoundError(f"No prediction json found in {rtmo_pred_dir}")

    _filter_best_instance(pred_json, is_cascaded)

    cmd_to_event = [
        sys.executable,
        str(PROJECT_ROOT / "scripts/rtmo_current_to_event.py"),
        "--pred-json", path_for_cli(pred_json),
        "--output", path_for_cli(rtmo_event_path),
        "--horizontal-ratio", str(args.horizontal_ratio),
    ]

    if x_offset or y_offset:
        cmd_to_event.extend(["--x-offset", str(x_offset), "--y-offset", str(y_offset)])

    run_cmd(
        cmd_to_event,
        cwd=PROJECT_ROOT,
        title="[3/4] RTMO → pose event",
    )

    run_cmd(
        [
            sys.executable,
            str(PROJECT_ROOT / "scripts/system_output_fusion.py"),
            "--yolo-events", path_for_cli(yolo_events_path),
            "--rtmo-events", path_for_cli(rtmo_event_path),
            "--output", path_for_cli(fusion_output),
        ],
        cwd=PROJECT_ROOT,
        title="[4/4] YOLO + RTMO fusion",
    )

    write_frontend_result(
        frontend_result,
        source,
        output_dir,
        yolo_events_path,
        rtmo_event_path,
        fusion_output,
        rtmo_source,
        is_cascaded,
        best_event,
    )

    print("\n" + "=" * 80)
    print("[DONE] pipeline finished")
    print(f"  source          : {source.name}")
    print(f"  cascaded        : {is_cascaded}")
    print("  bbox source     : real YOLO/tiled event")
    print(f"  horizontal-ratio: {args.horizontal_ratio}")
    print(f"  fusion output   : {fusion_output}")
    print(f"  result json     : {frontend_result}")
    print("=" * 80)


if __name__ == "__main__":
    main()