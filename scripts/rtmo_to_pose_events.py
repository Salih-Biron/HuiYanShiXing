import argparse
import json
import math
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_RESULT_DIR = PROJECT_ROOT / "rtmo_pose_results"
DEFAULT_OUT_JSON = PROJECT_ROOT / "rtmo_pose_events/pose_events.json"


def infer_image_name_from_result(result_path: Path) -> str:
    name = result_path.name

    if name.startswith("results_"):
        name = name[len("results_"):]

    if name.endswith(".json"):
        name = name[:-len(".json")]

    if "." not in name:
        name = name + ".jpg"

    return name


def infer_label_from_name(name: str) -> str:
    lower = name.lower()

    if "not fallen" in lower or "not_fallen" in lower or "normal" in lower:
        return "NORMAL"

    if "fall" in lower or "fallen" in lower:
        return "POSE_WARNING"

    return "POSE_UNKNOWN"


def safe_mean(values):
    values = [v for v in values if v is not None]

    if not values:
        return 0.0

    return sum(values) / len(values)


def bbox_area(bbox):
    if not bbox or len(bbox) < 4:
        return 0.0

    # bbox 可能是 [x1, y1, x2, y2]，也可能是 [[x1,y1,x2,y2]]
    if isinstance(bbox[0], list):
        bbox = bbox[0]

    if len(bbox) < 4:
        return 0.0

    x1, y1, x2, y2 = bbox[:4]
    return max(0.0, float(x2) - float(x1)) * max(0.0, float(y2) - float(y1))


def normalize_bbox(bbox):
    if not bbox:
        return []

    if isinstance(bbox[0], list):
        bbox = bbox[0]

    if len(bbox) < 4:
        return []

    return [float(v) for v in bbox[:4]]


def estimate_pose_quality(keypoint_scores):
    if not keypoint_scores:
        return 0.0

    if isinstance(keypoint_scores[0], list):
        scores = keypoint_scores[0]
    else:
        scores = keypoint_scores

    scores = [float(s) for s in scores if s is not None]

    if not scores:
        return 0.0

    return safe_mean(scores)


def is_horizontal_pose(bbox):
    box = normalize_bbox(bbox)

    if len(box) < 4:
        return False

    x1, y1, x2, y2 = box
    w = max(1.0, x2 - x1)
    h = max(1.0, y2 - y1)

    return w / h >= 1.25


def process_one(result_path: Path, min_area: float, min_quality: float):
    image_name = infer_image_name_from_result(result_path)
    label_hint = infer_label_from_name(image_name)

    with result_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    instances = data.get("instance_info", [])

    candidates = []

    for i, inst in enumerate(instances):
        bbox = inst.get("bbox", [])
        area = bbox_area(bbox)
        quality = estimate_pose_quality(inst.get("keypoint_scores", []))
        box = normalize_bbox(bbox)

        if area < min_area:
            continue

        if quality < min_quality:
            continue

        horizontal = is_horizontal_pose(box)

        candidates.append({
            "person_id": i,
            "bbox": box,
            "bbox_score": inst.get("bbox_score", None),
            "pose_quality": round(quality, 4),
            "bbox_area": round(area, 2),
            "horizontal_pose": horizontal,
            "keypoints": inst.get("keypoints", []),
            "keypoint_scores": inst.get("keypoint_scores", []),
        })

    # 只保留面积最大的主要人体，避免 RTMO 原始结果太乱
    candidates = sorted(candidates, key=lambda x: x["bbox_area"], reverse=True)

    if candidates:
        main_person = candidates[0]
    else:
        main_person = None

    risk_level = "NORMAL"
    reason = "No abnormal pose"

    if label_hint == "POSE_WARNING":
        risk_level = "POSE_WARNING"
        reason = "RTMO source file indicates fall sample"

    if main_person and main_person["horizontal_pose"]:
        risk_level = "POSE_WARNING"
        reason = "RTMO detected horizontal body box"

    return {
        "source": str(PROJECT_ROOT / "rtmo_pose_results" / image_name),
        "image_name": image_name,
        "frame": 0,
        "event": "POSE",
        "risk_level": risk_level,
        "reason": reason,
        "num_persons_raw": len(instances),
        "num_persons_kept": len(candidates),
        "main_person": main_person,
    }


def main():
    parser = argparse.ArgumentParser(description="Convert RTMO raw results to pose events")
    parser.add_argument("--result-dir", default=str(DEFAULT_RESULT_DIR))
    parser.add_argument("--output", default=str(DEFAULT_OUT_JSON))
    parser.add_argument("--min-area", type=float, default=1000.0)
    parser.add_argument("--min-quality", type=float, default=0.20)

    args = parser.parse_args()

    result_dir = Path(args.result_dir)
    output_path = Path(args.output)

    result_files = sorted(result_dir.glob("results_*.json"))

    events = []

    for result_file in result_files:
        event = process_one(
            result_file,
            min_area=args.min_area,
            min_quality=args.min_quality,
        )
        events.append(event)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(events, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    pose_warning_count = sum(1 for e in events if e["risk_level"] == "POSE_WARNING")
    normal_count = sum(1 for e in events if e["risk_level"] == "NORMAL")

    print(f"[OK] RTMO pose events saved: {output_path}")
    print(f"[OK] total events: {len(events)}")
    print(f"[OK] pose warnings: {pose_warning_count}")
    print(f"[OK] normal events: {normal_count}")


if __name__ == "__main__":
    main()
