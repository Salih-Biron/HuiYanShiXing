import argparse
import json
import time
from collections import defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path, default):
    if not path.exists():
        return default

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

    if isinstance(data, dict) and "events" in data:
        return data["events"]

    return data


def risk_priority(risk_level: str) -> int:
    mapping = {
        "NORMAL": 0,
        "POSE_WARNING": 1,
        "FALL_ALERT": 2,
    }
    return mapping.get(risk_level, 0)


def main():
    parser = argparse.ArgumentParser(description="Fuse YOLO and RTMO event outputs")
    parser.add_argument(
        "--yolo-events",
        default="yolo_events/events.json",
        help="YOLO event json path",
    )
    parser.add_argument(
        "--rtmo-events",
        default="rtmo_pose_events/pose_events.json",
        help="RTMO pose event json path",
    )
    parser.add_argument(
        "--output",
        default="outputs/system_fusion_output.json",
        help="fusion output json path",
    )
    args = parser.parse_args()

    yolo_path = PROJECT_ROOT / args.yolo_events
    rtmo_path = PROJECT_ROOT / args.rtmo_events
    output_path = PROJECT_ROOT / args.output

    yolo_events = load_json(yolo_path, [])
    rtmo_events = load_json(rtmo_path, [])

    if not isinstance(yolo_events, list):
        yolo_events = []

    if not isinstance(rtmo_events, list):
        rtmo_events = []

    fused = {}

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
            fused[key] = {
                "source": source,
                "frame": frame,
                "final_decision": rtmo_risk,
                "risk_level": rtmo_risk,
                "reason": "RTMO detected abnormal pose",
                "yolo_result": None,
                "rtmo_result": event,
                "alert_image": event.get("alert_image", ""),
            }
        else:
            fused[key]["rtmo_result"] = event

            if risk_priority(rtmo_risk) > risk_priority(fused[key]["risk_level"]):
                fused[key]["risk_level"] = rtmo_risk
                fused[key]["final_decision"] = rtmo_risk
                fused[key]["reason"] = "RTMO risk is higher than YOLO result"

    final_events = sorted(
        fused.values(),
        key=lambda x: (x.get("source", ""), int(x.get("frame", 0))),
    )

    summary_by_source = defaultdict(lambda: {
        "total_events": 0,
        "fall_alert_count": 0,
        "pose_warning_count": 0,
        "normal_count": 0,
        "first_alert_frame": "",
        "max_yolo_conf": 0.0,
    })

    for event in final_events:
        source = event["source"]
        risk = event["risk_level"]
        frame = event["frame"]

        summary_by_source[source]["total_events"] += 1

        if risk == "FALL_ALERT":
            summary_by_source[source]["fall_alert_count"] += 1
            if summary_by_source[source]["first_alert_frame"] == "":
                summary_by_source[source]["first_alert_frame"] = frame
        elif risk == "POSE_WARNING":
            summary_by_source[source]["pose_warning_count"] += 1
        else:
            summary_by_source[source]["normal_count"] += 1

        yolo_result = event.get("yolo_result")
        if yolo_result:
            conf = float(yolo_result.get("confidence", 0.0))
            summary_by_source[source]["max_yolo_conf"] = max(
                summary_by_source[source]["max_yolo_conf"],
                conf,
            )

    output = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "yolo_event_count": len(yolo_events),
        "rtmo_event_count": len(rtmo_events),
        "final_event_count": len(final_events),
        "events": final_events,
        "summary_by_source": dict(summary_by_source),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    system_output_path = PROJECT_ROOT / "outputs/system_output.json"
    system_output_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"[OK] fusion output saved: {output_path}")
    print(f"[OK] system output saved: {system_output_path}")
    print(f"[OK] yolo events: {len(yolo_events)}")
    print(f"[OK] rtmo events: {len(rtmo_events)}")
    print(f"[OK] final events: {len(final_events)}")


if __name__ == "__main__":
    main()
