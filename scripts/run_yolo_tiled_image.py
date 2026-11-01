import argparse
from pathlib import Path

import cv2
from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parents[1]

FALL_KEYWORDS = {"fall", "fallen", "down", "lying", "lie", "摔倒", "跌倒", "倒地"}
NORMAL_KEYWORDS = {"standing", "stand", "normal", "walk", "walking", "other"}


def project_path(path_text):
    path = Path(path_text)
    if path.is_absolute():
        return path
    return PROJECT_ROOT / path


def normalize_label(label):
    lower = str(label).lower()
    if any(k in lower for k in FALL_KEYWORDS):
        return "FALL"
    if any(k in lower for k in NORMAL_KEYWORDS):
        return "NORMAL"
    return str(label).upper()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--weights", default="weights/yolo/best.pt")
    parser.add_argument("--fall-threshold", type=float, default=0.20)
    parser.add_argument("--conf", type=float, default=0.05)
    parser.add_argument("--imgsz", type=int, default=960)
    parser.add_argument("--grid", type=int, default=3)
    parser.add_argument("--overlap", type=float, default=0.20)
    args = parser.parse_args()

    source = project_path(args.source)
    weights = project_path(args.weights)

    image = cv2.imread(str(source))
    if image is None:
        raise RuntimeError(f"failed to read image: {source}")

    h, w = image.shape[:2]
    model = YOLO(str(weights))

    out = image.copy()
    detections = []

    tile_w = int(w / args.grid)
    tile_h = int(h / args.grid)

    step_x = int(tile_w * (1 - args.overlap))
    step_y = int(tile_h * (1 - args.overlap))

    if step_x <= 0:
        step_x = tile_w
    if step_y <= 0:
        step_y = tile_h

    y_starts = list(range(0, max(1, h - tile_h + 1), step_y))
    x_starts = list(range(0, max(1, w - tile_w + 1), step_x))

    if y_starts[-1] != h - tile_h:
        y_starts.append(max(0, h - tile_h))
    if x_starts[-1] != w - tile_w:
        x_starts.append(max(0, w - tile_w))

    for y0 in y_starts:
        for x0 in x_starts:
            x1 = min(w, x0 + tile_w)
            y1 = min(h, y0 + tile_h)

            tile = image[y0:y1, x0:x1]

            results = model.predict(tile, verbose=False, conf=args.conf, imgsz=args.imgsz)

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
                    label = normalize_label(raw_label)

                    gx1 = bx1 + x0
                    gy1 = by1 + y0
                    gx2 = bx2 + x0
                    gy2 = by2 + y0

                    detections.append({
                        "label": label,
                        "raw_label": raw_label,
                        "conf": conf,
                        "bbox": [gx1, gy1, gx2, gy2],
                    })

    alert = any(d["label"] == "FALL" and d["conf"] >= args.fall_threshold for d in detections)

    for d in detections:
        x1, y1, x2, y2 = d["bbox"]
        label = d["label"]
        conf = d["conf"]

        color = (0, 0, 255) if label == "FALL" else (0, 255, 0)

        # 只画比较有用的框，避免太乱
        if label == "FALL" or conf >= 0.25:
            cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
            cv2.putText(
                out,
                f"{label} {conf:.2f}",
                (x1, max(25, y1 - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                color,
                2,
            )

    banner_color = (0, 0, 255) if alert else (0, 160, 0)
    risk_text = "FALL ALERT" if alert else "NORMAL"

    cv2.rectangle(out, (0, 0), (w, 52), banner_color, -1)
    cv2.putText(
        out,
        f"TILED YOLO | {risk_text}",
        (14, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (255, 255, 255),
        2,
    )

    output_dir = PROJECT_ROOT / "outputs/images"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{source.stem}_tiled_result.jpg"
    cv2.imwrite(str(output_path), out)

    print(f"[OK] output: {output_path}")
    print(f"[OK] detections: {len(detections)}")
    print(f"[OK] fall detections:")
    for d in detections:
        if d["label"] == "FALL":
            print(d)
    print(f"[OK] final: {risk_text}")


if __name__ == "__main__":
    main()
