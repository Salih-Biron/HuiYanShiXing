import asyncio
import json
import math
import sqlite3
import time
import traceback
import uuid
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List

from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

try:
    from .inference_service import IMAGE_EXTS, VIDEO_EXTS, InferenceService
    from .time_utils import BUSINESS_TIMEZONE, local_now
except ImportError:
    from inference_service import IMAGE_EXTS, VIDEO_EXTS, InferenceService
    from time_utils import BUSINESS_TIMEZONE, local_now


service = InferenceService.from_env()
MAX_BATCH_IMAGES = 20

# In-memory registry of video tasks: task_id -> status payload.
video_tasks: Dict[str, Dict[str, Any]] = {}

app = FastAPI(title="Huiyan CV Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_load_models():
    service.config.api_output_dir.mkdir(parents=True, exist_ok=True)
    _archive_existing_alerts()
    try:
        service.load_models()
    except Exception as exc:
        # Keep the API bootable on machines without GPU/model deps; detection will
        # retry loading and return a clear 500 if the environment is incomplete.
        service._load_error = str(exc)
        print(f"[startup] model loading failed: {exc}", flush=True)
        traceback.print_exc()


@app.get("/")
def health_check():
    return {
        "success": True,
        "message": "Huiyan CV backend is running",
        "inference": service.status(),
    }


@app.get("/api/")
def api_health_check():
    return health_check()


@app.post("/api/detect/image")
async def detect_image(file: UploadFile = File(...)):
    task_id = str(uuid.uuid4())
    suffix = Path(file.filename or "").suffix.lower()

    if suffix not in IMAGE_EXTS:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": f"Unsupported image type: {suffix}",
            },
        )

    try:
        file_bytes = await file.read()
        result = await service.detect_image_bytes(
            task_id=task_id,
            filename=file.filename or f"{task_id}{suffix}",
            file_bytes=file_bytes,
        )
        return result
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "task_id": task_id,
                "message": str(exc),
            },
        )
    except Exception as exc:
        print(f"[detect_image] task_id={task_id} failed: {exc}", flush=True)
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "task_id": task_id,
                "message": "Detection failed",
                "error": str(exc),
                "inference": service.status(),
            },
        )


@app.post("/api/detect/images")
async def detect_images(files: List[UploadFile] = File(...)):
    batch_id = str(uuid.uuid4())
    start = time.perf_counter()

    if not files:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "No images uploaded",
            },
        )

    if len(files) > MAX_BATCH_IMAGES:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": f"Too many images: max {MAX_BATCH_IMAGES}",
                "max_images": MAX_BATCH_IMAGES,
            },
        )

    results: List[Dict[str, Any]] = []
    for index, file in enumerate(files):
        task_id = str(uuid.uuid4())
        filename = file.filename or f"{task_id}.jpg"
        suffix = Path(filename).suffix.lower()

        if suffix not in IMAGE_EXTS:
            results.append(
                {
                    "success": False,
                    "batch_id": batch_id,
                    "batch_index": index,
                    "filename": filename,
                    "task_id": task_id,
                    "message": f"Unsupported image type: {suffix}",
                }
            )
            continue

        try:
            file_bytes = await file.read()
            result = await service.detect_image_bytes(
                task_id=task_id,
                filename=filename,
                file_bytes=file_bytes,
            )
            result["batch_id"] = batch_id
            result["batch_index"] = index
            result["filename"] = filename
            results.append(result)
        except Exception as exc:
            results.append(
                {
                    "success": False,
                    "batch_id": batch_id,
                    "batch_index": index,
                    "filename": filename,
                    "task_id": task_id,
                    "message": f"Detection failed: {exc}",
                    "error": str(exc),
                }
            )

    completed = sum(1 for item in results if item.get("success"))
    failed = len(results) - completed
    alert_count = sum(
        1
        for item in results
        if item.get("status") in {"FALL_ALERT", "POSE_WARNING"}
    )

    return {
        "success": failed == 0,
        "batch_id": batch_id,
        "total": len(results),
        "completed": completed,
        "failed": failed,
        "alert_count": alert_count,
        "timings_ms": {
            "total": int(round((time.perf_counter() - start) * 1000)),
        },
        "results": results,
    }


def _new_video_task(task_id: str, filename: str) -> Dict[str, Any]:
    task = {
        "task_id": task_id,
        "filename": filename,
        "status": "processing",
        "progress": {
            "processed_frames": 0,
            "total_frames": 0,
            "alert_count": 0,
            "percent": 0.0,
        },
        "result": None,
        "error": None,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    video_tasks[task_id] = task
    return task


async def _run_video_task(task_id: str, filename: str, file_bytes: bytes) -> None:
    task = video_tasks.get(task_id)

    def on_progress(progress: Dict[str, Any]) -> None:
        if task is None:
            return
        task["progress"] = {
            "processed_frames": progress.get("processed_frames", 0),
            "total_frames": progress.get("total_frames", 0),
            "alert_count": progress.get("alert_count", 0),
            "percent": progress.get("percent", 0.0),
        }

    try:
        result = await service.detect_video_bytes(
            task_id=task_id,
            filename=filename,
            file_bytes=file_bytes,
            progress_cb=on_progress,
        )
        if task is not None:
            task["status"] = "completed"
            task["result"] = result
            task["progress"] = {
                "processed_frames": result.get("processed_frames", 0),
                "total_frames": result.get("total_frames", 0),
                "alert_count": result.get("alert_count", 0),
                "percent": 100.0,
            }
    except Exception as exc:  # noqa: BLE001 - surface any failure to the poller
        if task is not None:
            task["status"] = "failed"
            task["error"] = str(exc)


@app.post("/api/detect/video")
async def detect_video(file: UploadFile = File(...)):
    task_id = str(uuid.uuid4())
    filename = file.filename or f"{task_id}.mp4"
    suffix = Path(filename).suffix.lower()

    if suffix not in VIDEO_EXTS:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": f"Unsupported video type: {suffix}",
            },
        )

    file_bytes = await file.read()
    max_bytes = service.config.video_max_upload_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": f"Video too large: max {service.config.video_max_upload_mb}MB",
            },
        )

    _new_video_task(task_id, filename)
    asyncio.create_task(_run_video_task(task_id, filename, file_bytes))

    return {
        "success": True,
        "task_id": task_id,
        "status": "processing",
        "message": "Video processing started",
    }


@app.get("/api/detect/video/{task_id}/status")
def get_video_status(task_id: str):
    task = video_tasks.get(task_id)
    if task is None:
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "Task not found"},
        )
    return {
        "success": True,
        "task_id": task_id,
        "status": task["status"],
        "progress": task["progress"],
        "result": task["result"],
        "error": task["error"],
    }


@app.get("/api/detect/video/{task_id}/output.mp4")
def get_video_output(task_id: str):
    output_path = service.config.api_output_dir / task_id / "output.mp4"
    if not output_path.exists():
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "Video not found or still processing",
            },
        )
    return FileResponse(str(output_path), media_type="video/mp4")


@app.delete("/api/detect/video/{task_id}")
def delete_video_task(task_id: str):
    task = video_tasks.pop(task_id, None)
    if task is None:
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "Task not found"},
        )
    return {"success": True, "message": "Task removed"}


@app.get("/api/detection/logs")
def get_detection_logs(
    status: str = "all",
    risk_level: str = "all",
    search: str = "",
    page: int = 1,
    page_size: int = 10,
    date_scope: str = "today",
):
    if date_scope not in {"today", "history", "all"}:
        raise HTTPException(status_code=422, detail="date_scope must be today, history or all")

    payloads = _load_result_payloads()
    today = local_now().date()
    if date_scope == "today":
        payloads = [payload for payload in payloads if _payload_datetime(payload).date() == today]
    elif date_scope == "history":
        payloads = [payload for payload in payloads if _payload_datetime(payload).date() < today]
    alerts_by_task = _alerts_by_task(payloads)
    logs = [_payload_to_log(payload, alerts_by_task.get(_task_id(payload), [])) for payload in payloads]
    logs = _filter_logs(logs, status=status, risk_level=risk_level, search=search)

    page = max(1, int(page))
    page_size = max(1, min(int(page_size), 100))
    total = len(logs)
    total_pages = math.ceil(total / page_size) if total else 0
    start = (page - 1) * page_size
    end = start + page_size

    return {
        "success": True,
        "data": logs[start:end],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": total_pages,
    }


@app.get("/api/alerts")
def get_alerts(
    status: str = "all",
    risk_level: str = "all",
    search: str = "",
    source_type: str = "all",
    page: int = 1,
    page_size: int = 10,
    date_scope: str = "today",
):
    if date_scope not in {"today", "history", "all"}:
        raise HTTPException(status_code=422, detail="date_scope must be today, history or all")
    alerts = _filter_logs(_load_alerts(), status=status, risk_level=risk_level, search=search)
    if date_scope != "all":
        today = local_now().date()
        dated_alerts = []
        for alert in alerts:
            timestamp = _parse_datetime(alert.get("timestamp"))
            archived = alert.get("archivedAt") is not None
            alert_date = timestamp.date() if timestamp else None
            if (date_scope == "today" and not archived and alert_date == today) or (date_scope == "history" and (archived or (alert_date is not None and alert_date < today))):
                dated_alerts.append(alert)
        alerts = dated_alerts
    if source_type.lower() != "all":
        alerts = [alert for alert in alerts if alert["sourceType"] == source_type.lower()]
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    total = len(alerts)
    start = (page - 1) * page_size
    return {
        "success": True,
        "data": alerts[start:start + page_size],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": math.ceil(total / page_size) if total else 0,
    }


@app.get("/api/alerts/{alert_id}")
def get_alert(alert_id: str):
    for alert in _load_alerts():
        if alert["id"] == alert_id:
            return {"success": True, "data": alert}
    raise HTTPException(status_code=404, detail="Alert event not found")


@app.patch("/api/alerts/{alert_id}/status")
def update_alert_status(alert_id: str, body: Dict[str, Any] = Body(...)):
    status = body.get("status")
    if not isinstance(status, str) or status not in ALERT_STATUSES:
        raise HTTPException(status_code=400, detail="Status must be pending, processing, resolved or false_positive")
    alert = next((item for item in _load_alerts() if item["id"] == alert_id), None)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert event not found")
    connection = _open_alert_db()
    try:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute("SELECT * FROM alert_state WHERE alert_id = ?", (alert_id,)).fetchone()
        previous = row["status"] if row else "pending"
        history = json.loads(row["history"]) if row else []
        updated_at = datetime.now().astimezone().isoformat(timespec="microseconds")
        history.append({"from": previous, "to": status, "status": status, "timestamp": updated_at})
        connection.execute(
            "INSERT INTO alert_state (alert_id, status, updated_at, history) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(alert_id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at, history=excluded.history",
            (alert_id, status, updated_at, json.dumps(history, ensure_ascii=False)),
        )
        connection.commit()
    except (sqlite3.Error, ValueError, TypeError) as exc:
        connection.rollback()
        raise HTTPException(status_code=500, detail="Failed to persist alert status and operation history") from exc
    finally:
        connection.close()
    alert.update(status=status, updatedAt=updated_at, history=history)
    return {"success": True, "data": alert}


@app.get("/api/stats/trend")
def get_stats_trend():
    today = local_now().date()
    counts = Counter(
        _parse_datetime(alert["timestamp"]).date()
        for alert in _load_alerts()
        if alert["status"] != "false_positive"
    )
    return {
        "success": True,
        "data": [
            {"day": (today - timedelta(days=offset)).strftime("%m-%d"),
             "count": counts[today - timedelta(days=offset)]}
            for offset in range(6, -1, -1)
        ],
    }


@app.get("/api/stats/summary")
def get_stats_summary():
    payloads = _load_result_payloads()
    today = local_now().date()
    today_payloads = [payload for payload in payloads if _payload_datetime(payload).date() == today]
    today_alerts = [alert for alert in _load_alerts(payloads) if _parse_datetime(alert["timestamp"]).date() == today]
    today_frames = sum(
        int(payload.get("processed_frames", 0))
        for payload in today_payloads
        if _source_type(payload) == "video"
    )
    latencies = [
        int(payload.get("timings_ms", {}).get("total", 0))
        for payload in today_payloads
        if int(payload.get("timings_ms", {}).get("total", 0)) > 0
    ]
    return {
        "success": True,
        "todayImages": sum(_source_type(payload) == "image" for payload in today_payloads),
        "todayFrames": today_frames,
        "todayAlerts": sum(alert["status"] != "false_positive" for alert in today_alerts),
        "todayFalsePositives": sum(alert["status"] == "false_positive" for alert in today_alerts),
        "processedEvents": sum(alert["status"] in {"resolved", "false_positive"} for alert in today_alerts),
        "averageLatencyMs": int(sum(latencies) / len(latencies)) if latencies else 0,
        "averageAccuracy": None,
        "totalImages": sum(_source_type(payload) == "image" for payload in payloads),
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


@app.get("/api/result/{task_id}/{file_path:path}")
def get_result_file(task_id: str, file_path: str):
    task_dir = service.config.api_output_dir / task_id
    target_path = task_dir / file_path

    try:
        target_path.resolve().relative_to(task_dir.resolve())
    except ValueError:
        return JSONResponse(
            status_code=403,
            content={
                "success": False,
                "message": "Invalid file path",
            },
        )

    if not target_path.exists():
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "File not found",
            },
        )

    return FileResponse(str(target_path))


def _load_result_payloads() -> List[Dict[str, Any]]:
    payloads: List[Dict[str, Any]] = []
    for result_file in service.config.api_output_dir.glob("*/result.json"):
        try:
            payload = json.loads(result_file.read_text(encoding="utf-8"))
            if not isinstance(payload, dict):
                continue
            payload["_result_mtime"] = result_file.stat().st_mtime
            payload["_result_file"] = str(result_file)
            payloads.append(payload)
        except Exception:
            continue
    payloads.sort(key=lambda payload: payload["_result_mtime"], reverse=True)
    return payloads


ALERT_STATUSES = {"pending", "processing", "resolved", "false_positive"}


def _parse_datetime(value: Any):
    try:
        if isinstance(value, (int, float)):
            parsed = datetime.fromtimestamp(value, BUSINESS_TIMEZONE)
        else:
            parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(BUSINESS_TIMEZONE).replace(tzinfo=None)
        return parsed
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def _payload_datetime(payload: Dict[str, Any]) -> datetime:
    for value in (payload.get("created_at_iso"), payload.get("created_at"), payload.get("_result_mtime")):
        parsed = _parse_datetime(value)
        if parsed is not None:
            return parsed
    return datetime.min


def _source_type(payload: Dict[str, Any]) -> str:
    if payload.get("source_type") == "video" or "alert_timeline" in payload:
        return "video"
    return "video" if Path(str(payload.get("source") or "")).suffix.lower() in VIDEO_EXTS else "image"


def _timeline(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = payload.get("alert_timeline")
    return [item for item in items if isinstance(item, dict)] if isinstance(items, list) else []


def _safe_id(value: str) -> str:
    if value and all(char.isascii() and (char.isalnum() or char in "_-.") for char in value):
        return value
    return uuid.uuid5(uuid.NAMESPACE_URL, value).hex


def _output_video_url(task_id: str) -> str:
    output_path = service.config.api_output_dir / task_id / "output.mp4"
    return f"/api/result/{task_id}/output.mp4" if output_path.is_file() else ""





def _confidence(value: Any):
    try:
        number = float(value)
        return max(0.0, min(1.0, number)) if math.isfinite(number) else None
    except (TypeError, ValueError, OverflowError):
        return None


def _risk_level(raw_status: str, risk: Any = None) -> str:
    if raw_status == "POSE_WARNING":
        return "medium"
    if raw_status == "FALL_ALERT":
        return "high"
    normalized = str(risk or "").lower().replace(" ", "_")
    return {"fall_alert": "high", "pose_warning": "medium"}.get(
        normalized, normalized if normalized in {"high", "medium", "low"} else "low"
    )


def _payload_alerts(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    task_id = str(payload.get("task_id") or Path(payload.get("_result_file", "")).parent.name)
    source_type = _source_type(payload)
    raw_status = str(payload.get("status") or "")
    if source_type == "image" and not (
        raw_status in {"FALL_ALERT", "POSE_WARNING"} or payload.get("alert")
    ):
        return []
    api_files = payload.get("api_files") if isinstance(payload.get("api_files"), dict) else {}
    events = _timeline(payload) if source_type == "video" else [{}]
    best_event = payload.get("best_yolo_event")
    best_event = best_event if isinstance(best_event, dict) else {}
    alerts = []
    seen = set()
    for index, event in enumerate(events, start=1):
        event_id = str(event.get("event_id") or f"fall_{index:03d}") if source_type == "video" else "image"
        if event_id in seen:
            continue
        seen.add(event_id)
        event_status = str(event.get("status") or raw_status or "FALL_ALERT")
        alert = {
            "id": f"{_safe_id(task_id)}:{_safe_id(event_id)}",
            "taskId": task_id,
            "source": Path(str(payload.get("source") or task_id)).name,
            "sourceType": source_type,
            "timestamp": _payload_datetime(payload).isoformat(timespec="seconds"),
            "rawStatus": event_status,
            "riskLevel": _risk_level(event_status, event.get("risk_level") or payload.get("risk_level")),
            "confidence": _confidence(event.get("confidence") if source_type == "video" else best_event.get("confidence", payload.get("confidence"))),
            "status": "pending",
            "image": (event.get("alert_image") or "") if source_type == "video" else (api_files.get("alert_image") or api_files.get("result_image") or ""),
            "frame": event.get("frame", event.get("first_frame")) if source_type == "video" else 0,
            "history": [],
        }
        if source_type == "video":
            alert.update({
                "eventId": event_id,
                "eventVideo": event.get("event_video") or "",
                "outputVideo": _output_video_url(task_id),
                "timestampSec": event.get("timestamp_sec"),
            })
        alerts.append(alert)
    return alerts


def _open_alert_db():
    connection = None
    try:
        service.config.api_output_dir.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(str(service.config.api_output_dir / "alert_state.sqlite3"), timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute(
            "CREATE TABLE IF NOT EXISTS alert_state ("
            "alert_id TEXT PRIMARY KEY, status TEXT NOT NULL, updated_at TEXT NOT NULL, history TEXT NOT NULL)"
        )
        connection.execute(
            "CREATE TABLE IF NOT EXISTS alert_archive ("
            "alert_id TEXT PRIMARY KEY, archived_at TEXT NOT NULL)"
        )
        connection.commit()
        return connection
    except (sqlite3.Error, OSError) as exc:
        if connection is not None:
            connection.close()
        raise HTTPException(status_code=500, detail="Alert state database unavailable") from exc


def _archive_existing_alerts():
    alerts = [alert for payload in _load_result_payloads() for alert in _payload_alerts(payload)]
    archived_at = local_now().isoformat(timespec="seconds")
    connection = _open_alert_db()
    try:
        connection.execute("BEGIN IMMEDIATE")
        connection.executemany(
            "INSERT OR IGNORE INTO alert_archive (alert_id, archived_at) VALUES (?, ?)",
            [(alert["id"], archived_at) for alert in alerts],
        )
        connection.commit()
    except sqlite3.Error as exc:
        connection.rollback()
        raise RuntimeError("Failed to archive existing alerts at startup") from exc
    finally:
        connection.close()


def _load_alerts(payloads=None) -> List[Dict[str, Any]]:
    if payloads is None:
        payloads = _load_result_payloads()
    alerts = [alert for payload in payloads for alert in _payload_alerts(payload)]
    connection = _open_alert_db()
    try:
        states = {row["alert_id"]: row for row in connection.execute("SELECT * FROM alert_state")}
        archives = {row["alert_id"]: row["archived_at"] for row in connection.execute("SELECT * FROM alert_archive")}
        for alert in alerts:
            if alert["id"] in archives:
                alert["archivedAt"] = archives[alert["id"]]
            state = states.get(alert["id"])
            if state is not None:
                alert.update(status=state["status"], updatedAt=state["updated_at"], history=json.loads(state["history"]))
    except (sqlite3.Error, ValueError, TypeError) as exc:
        raise HTTPException(status_code=500, detail="Failed to read persistent alert states") from exc
    finally:
        connection.close()
    return alerts


def _task_id(payload: Dict[str, Any]) -> str:
    return str(payload.get("task_id") or Path(payload.get("_result_file", "")).parent.name)


def _alerts_by_task(payloads) -> Dict[str, List[Dict[str, Any]]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for alert in _load_alerts(payloads):
        grouped.setdefault(alert["taskId"], []).append(alert)
    return grouped


def _payload_to_log(payload: Dict[str, Any], alerts=None) -> Dict[str, Any]:
    task_id = _task_id(payload)
    if alerts is None:
        alerts = _load_alerts([payload])
    effective_alerts = [alert for alert in alerts if alert["status"] != "false_positive"]
    false_positive_count = len(alerts) - len(effective_alerts)
    raw_status = str(payload.get("status") or "")
    is_alert = bool(effective_alerts)
    review_status = (
        "false_positive" if alerts and not effective_alerts
        else "partial_false_positive" if false_positive_count
        else "alert" if is_alert else "normal"
    )
    source = str(payload.get("source") or "")
    source_name = Path(source).name if source else task_id
    detections = payload.get("detections") if isinstance(payload.get("detections"), list) else []
    label_counts = Counter(
        str(det.get("display_label") or det.get("label") or "object").lower()
        for det in detections
        if isinstance(det, dict)
    )
    detections_text = ", ".join(f"{label}:{count}" for label, count in label_counts.items()) or "-"
    api_files = payload.get("api_files") if isinstance(payload.get("api_files"), dict) else {}

    risk_order = {"low": 0, "medium": 1, "high": 2}
    risk_level = max(
        (alert["riskLevel"] for alert in effective_alerts), key=risk_order.get,
        default="none" if review_status == "false_positive" else "low",
    )
    timestamp = _payload_datetime(payload).strftime("%Y-%m-%d %H:%M:%S")
    source_type = _source_type(payload)
    timeline = _timeline(payload)
    event_states = {alert.get("eventId"): alert for alert in alerts}
    reviewed_timeline = []
    for index, event in enumerate(timeline, start=1):
        state = event_states.get(str(event.get("event_id") or f"fall_{index:03d}"))
        reviewed_timeline.append({
            **event,
            "reviewStatus": state["status"] if state else "pending",
            "excluded": state is not None and state["status"] == "false_positive",
        })
    first_event = timeline[0] if timeline else {}
    alert_count = len(effective_alerts)

    return {
        "id": task_id,
        "taskId": task_id,
        "timestamp": timestamp,
        "source": source_name,
        "sourceType": source_type,
        "outputVideo": _output_video_url(task_id),
        "alertCount": alert_count,
        "originalAlertCount": len(alerts),
        "falsePositiveCount": false_positive_count,
        "alertTimeline": reviewed_timeline,
        "frame": (first_event.get("frame") or first_event.get("first_frame") or 0) if source_type == "video" else 0,
        "status": review_status,
        "rawStatus": raw_status or ("FALL_ALERT" if is_alert else "NORMAL"),
        "riskLevel": risk_level,
        "detections": detections_text,
        "alertImage": api_files.get("alert_image") or first_event.get("alert_image") or "",
        "resultImage": api_files.get("result_image") or "",
        "resultJson": api_files.get("result_json") or "",
        "pipelineMode": payload.get("pipeline_mode") or "",
        "elapsedMs": payload.get("timings_ms", {}).get("total", 0),
    }


def _filter_logs(
    logs: List[Dict[str, Any]],
    *,
    status: str,
    risk_level: str,
    search: str,
) -> List[Dict[str, Any]]:
    status = (status or "all").lower()
    risk_level = (risk_level or "all").lower()
    search = (search or "").strip().lower()

    if status != "all":
        matching_statuses = {"alert", "partial_false_positive"} if status == "alert" else {status}
        logs = [log for log in logs if str(log.get("status", "")).lower() in matching_statuses]
    if risk_level != "all":
        logs = [log for log in logs if str(log.get("riskLevel", "")).lower() == risk_level]
    if search:
        logs = [
            log
            for log in logs
            if search in str(log.get("source", "")).lower()
            or search in str(log.get("detections", "")).lower()
            or search in str(log.get("taskId", "")).lower()
        ]
    return logs
