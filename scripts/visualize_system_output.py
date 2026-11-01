import json
from pathlib import Path

import cv2


SYSTEM_ROOT = Path(__file__).resolve().parents[1]

FUSION_JSON = SYSTEM_ROOT / "outputs" / "system_fusion_output.json"
IMAGE_DIR = SYSTEM_ROOT / "rtmo_pose_results"
OUT_DIR = SYSTEM_ROOT / "outputs" / "visualizations"

MAX_IMAGES = 30


def load_json(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize_bbox(bbox):
    if bbox is None:
        return None

    if isinstance(bbox, list) and len(bbox) == 1 and isinstance(bbox[0], list):
        bbox = bbox[0]

    if not isinstance(bbox, list) or len(bbox) < 4:
        return None

    return [int(float(bbox[0])), int(float(bbox[1])), int(float(bbox[2])), int(float(bbox[3]))]


def draw_yolo_events(img, events):
    for event in events:
        bbox = normalize_bbox(event.get("bbox"))
        if bbox is None:
            continue

        x1, y1, x2, y2 = bbox

        event_type = event.get("event_type", "unknown")
        confidence = event.get("confidence", 0)
        alarm_flag = event.get("alarm_flag", False)

        color = (0, 0, 255) if alarm_flag else (0, 255, 0)

        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)

        label = f"{event_type} {confidence:.2f}"
        if alarm_flag:
            label = "ALARM: " + label

        cv2.putText(
            img,
            label,
            (x1, max(y1 - 8, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            color,
            2
        )


def draw_rtmo_keypoints(img, persons):
    for person in persons:
        keypoints = person.get("keypoints", [])
        scores = person.get("keypoint_scores", [])

        for idx, kp in enumerate(keypoints):
            if not isinstance(kp, list) or len(kp) < 2:
                continue

            score = 1.0
            if isinstance(scores, list) and idx < len(scores):
                score = scores[idx]

            if score is not None and score < 0.3:
                continue

            x, y = int(float(kp[0])), int(float(kp[1]))
            cv2.circle(img, (x, y), 2, (255, 0, 0), -1)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    data = load_json(FUSION_JSON)
    results = data.get("results", [])

    saved = 0
    missing = 0

    for item in results:
        if saved >= MAX_IMAGES:
            break

        image_name = item.get("image_name")
        if not image_name:
            continue

        image_path = IMAGE_DIR / image_name

        if not image_path.exists():
            missing += 1
            continue

        img = cv2.imread(str(image_path))
        if img is None:
            missing += 1
            continue

        pose_branch = item.get("pose_branch", {})
        event_branch = item.get("event_branch", {})

        persons = pose_branch.get("persons", [])
        events = event_branch.get("events", [])

        draw_rtmo_keypoints(img, persons)
        draw_yolo_events(img, events)

        alarm_flag = item.get("alarm_flag", False)
        num_persons = pose_branch.get("num_persons", 0)
        num_events = event_branch.get("num_events", 0)
        num_alarms = event_branch.get("num_alarms", 0)

        title = f"{image_name} | persons={num_persons} events={num_events} alarms={num_alarms}"

        cv2.putText(
            img,
            title,
            (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 255),
            2
        )

        if alarm_flag:
            cv2.putText(
                img,
                "SYSTEM ALARM",
                (20, 75),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.0,
                (0, 0, 255),
                3
            )

        out_path = OUT_DIR / f"vis_{image_name}"
        cv2.imwrite(str(out_path), img)
        saved += 1

    print(f"saved visualizations to: {OUT_DIR}")
    print(f"saved_images = {saved}")
    print(f"missing_images = {missing}")


if __name__ == "__main__":
    main()
