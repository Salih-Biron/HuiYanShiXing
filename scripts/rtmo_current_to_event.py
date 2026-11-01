import argparse
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".bmp", ".webp"]

def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))

def find_source_image(stem: str) -> str:
    if stem.endswith("_crop_roi"):
        stem = stem.replace("_crop_roi", "")
    for ext in IMAGE_EXTS:
        p = PROJECT_ROOT / "test_images" / f"{stem}{ext}"
        if p.exists():
            return str(p)
    return str(PROJECT_ROOT / "test_images" / f"{stem}.png")

def flatten_instances(obj):
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

def normalize_bbox(bbox):
    if not bbox:
        return []
    if isinstance(bbox, list) and bbox and isinstance(bbox[0], list):
        bbox = bbox[0]
    if not isinstance(bbox, list) or len(bbox) < 4:
        return []
    return [float(v) for v in bbox[:4]]

def bbox_from_keypoints(keypoints, keypoint_scores=None, score_thr=0.1):
    if not keypoints:
        return []
    xs, ys = [], []
    
    # 归一化处理一维扁平列表或嵌套列表
    pts = []
    if keypoints and isinstance(keypoints, list):
        if isinstance(keypoints[0], list):
            pts = keypoints[0] if isinstance(keypoints[0][0], (int, float)) else keypoints
        elif isinstance(keypoints[0], (int, float)):
            # 如果是一维列表，每2个或3个元素切片组合成点
            stride = 3 if len(keypoints) >= 51 else 2
            for i in range(0, len(keypoints), stride):
                if i + 1 < len(keypoints):
                    pts.append([keypoints[i], keypoints[i+1]])
                    
    for i, p in enumerate(pts):
        if not isinstance(p, list) or len(p) < 2:
            continue
        xs.append(float(p[0]))
        ys.append(float(p[1]))

    if not xs or not ys:
        return []
    return [min(xs), min(ys), max(xs), max(ys)]

def bbox_area(box):
    if len(box) < 4:
        return 0.0
    x1, y1, x2, y2 = box
    return max(0.0, x2 - x1) * max(0.0, y2 - y1)

def pose_quality(inst):
    scores = inst.get("keypoint_scores", [])
    if isinstance(scores, list) and scores and isinstance(scores[0], list):
        scores = scores[0]
    values = []
    for s in scores:
        try: values.append(float(s))
        except Exception: pass
    if not values:
        return 0.0
    return sum(values) / len(values)

def is_horizontal(box, ratio_thr):
    if len(box) < 4:
        return False
    x1, y1, x2, y2 = box
    w = max(1.0, x2 - x1)
    h = max(1.0, y2 - y1)
    return (w / h) >= ratio_thr

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pred-json", required=True)
    parser.add_argument("--output", default="rtmo_pose_events/pose_events_current.json")
    parser.add_argument("--min-area", type=float, default=80.0)
    parser.add_argument("--min-quality", type=float, default=0.03)
    parser.add_argument("--horizontal-ratio", type=float, default=1.20)
    parser.add_argument("--x-offset", type=int, default=0)
    parser.add_argument("--y-offset", type=int, default=0)
    args = parser.parse_args()

    pred_path = Path(args.pred_json)
    output_path = PROJECT_ROOT / args.output

    data = load_json(pred_path)
    raw_instances = flatten_instances(data)

    candidates = []

    for i, inst in enumerate(raw_instances):
        bbox = normalize_bbox(inst.get("bbox", []))
        keypoints = inst.get("keypoints", [])
        
        # ------------------------------------------------------------
        # 超级鲁棒性多维坐标重构层（解决 float 迭代型 Bug）
        # ------------------------------------------------------------
        if keypoints and (args.x_offset > 0 or args.y_offset > 0):
            if isinstance(keypoints, list) and len(keypoints) > 0:
                # 状态 A: 二维嵌套情况 [[x,y], [x,y]...]
                if isinstance(keypoints[0], list):
                    actual_pts = keypoints[0] if isinstance(keypoints[0][0], (int, float)) else keypoints
                    for pt in actual_pts:
                        if isinstance(pt, list) and len(pt) >= 2:
                            pt[0] = float(pt[0]) + args.x_offset
                            pt[1] = float(pt[1]) + args.y_offset
                # 状态 B: 彻底的一维扁平数组 [x1, y1, x2, y2...] 或 [x1, y1, score1...]
                elif isinstance(keypoints[0], (int, float)):
                    stride = 3 if len(keypoints) >= 51 else 2  # 根据COCO 17个点判断步长
                    for idx in range(0, len(keypoints), stride):
                        if idx + 1 < len(keypoints):
                            keypoints[idx] = float(keypoints[idx]) + args.x_offset
                            keypoints[idx+1] = float(keypoints[idx+1]) + args.y_offset

        if not bbox:
            bbox = bbox_from_keypoints(inst.get("keypoints", []), inst.get("keypoint_scores", []))
        else:
            if args.x_offset > 0 or args.y_offset > 0:
                bbox[0] += args.x_offset
                bbox[1] += args.y_offset
                bbox[2] += args.x_offset
                bbox[3] += args.y_offset

        area = bbox_area(bbox)
        quality = pose_quality(inst)

        if area < args.min_area: continue
        if quality < args.min_quality: continue

        horizontal = is_horizontal(bbox, args.horizontal_ratio)

        candidates.append({
            "person_id": i,
            "bbox": [round(v, 2) for v in bbox],
            "bbox_area": round(area, 2),
            "pose_quality": round(quality, 4),
            "horizontal_pose": horizontal,
            "bbox_score": inst.get("bbox_score", None),
        })

    horizontal_candidates = [c for c in candidates if c["horizontal_pose"]]

    if horizontal_candidates:
        main_person = max(horizontal_candidates, key=lambda x: x["bbox_area"] * max(x["pose_quality"], 0.01))
        risk_level = "POSE_WARNING"
        reason = "RTMO detected horizontal body pose"
    elif candidates:
        main_person = max(candidates, key=lambda x: x["bbox_area"])
        risk_level = "NORMAL"
        reason = "RTMO did not detect horizontal body pose"
    else:
        main_person = None
        risk_level = "NORMAL"
        reason = "No valid RTMO person kept after filtering"

    stem = pred_path.stem
    source = find_source_image(stem)

    event = {
        "source": source,
        "image_name": Path(source).name,
        "frame": 0,
        "event": "POSE",
        "risk_level": risk_level,
        "reason": reason,
        "num_persons_raw": len(raw_instances),
        "num_persons_kept": len(candidates),
        "num_horizontal_candidates": len(horizontal_candidates),
        "main_person": main_person,
        "cascaded_offset": {"x_offset": args.x_offset, "y_offset": args.y_offset}
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps([event], ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[OK] current RTMO event saved: {output_path}")
    print(f"[OK] kept persons: {len(candidates)}")
    print(f"[OK] horizontal candidates: {len(horizontal_candidates)}")
    print(f"[OK] risk_level: {risk_level}")

if __name__ == "__main__":
    main()
