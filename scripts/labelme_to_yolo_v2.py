import base64
import json
import random
import shutil
from pathlib import Path

# ================= 路径配置区域（彻底移除"标注"子目录） =================
PROJECT_ROOT = Path(__file__).resolve().parents[1]

# 原始数据集根目录（你的 png 和 json 都在这里）
RAW_ROOT = PROJECT_ROOT / "datasets/camera_fall_v2"

# 强行让这两个变量等于根目录，实现就地扫描
JSON_DIR = RAW_ROOT 
IMAGE_DIR = RAW_ROOT 

# YOLO 训练集最终干净输出的目录
OUT_DIR = PROJECT_ROOT / "datasets/camera_fall_v2_yolo"
# ===================================================================

CLASS_MAP = {
    "fall": 0, "fallen": 0, "down": 0, "lying": 0,
    "standing": 1, "stand": 1, "normal": 1, "walk": 1, "walking": 1,
    "other": 2, "sit": 2, "sitting": 2, "crouch": 2, "crouching": 2, "bend": 2, "bending": 2,
}

CLASS_NAMES = {0: "fall", 1: "standing", 2: "other"}
IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".bmp", ".webp"]


def find_or_restore_image(json_path: Path, data: dict) -> Path:
    stem = json_path.stem
    image_path_text = data.get("imagePath")
    candidates = []

    if image_path_text:
        image_name = Path(str(image_path_text).replace("\\", "/")).name
        candidates.append(json_path.parent / image_name)
        candidates.append(IMAGE_DIR / image_name)
        candidates.append(RAW_ROOT / image_name)

    for ext in IMAGE_EXTS:
        candidates.append(json_path.parent / f"{stem}{ext}")
        candidates.append(IMAGE_DIR / f"{stem}{ext}")
        candidates.append(RAW_ROOT / f"{stem}{ext}")

    for candidate in candidates:
        if candidate.exists():
            return candidate

    for ext in IMAGE_EXTS:
        matches = list(RAW_ROOT.rglob(f"{stem}{ext}"))
        matches = [m for m in matches if "camera_fall_v2_yolo" not in str(m)]
        if matches:
            return matches[0]

    image_data = data.get("imageData")
    if image_data:
        out_path = IMAGE_DIR / f"{stem}.png"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(base64.b64decode(image_data))
        return out_path

    raise FileNotFoundError(f"找不到对应图片: {json_path}")


def shape_to_bbox(points):
    xs = [float(p[0]) for p in points]
    ys = [float(p[1]) for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def bbox_to_yolo(x1, y1, x2, y2, img_w, img_h):
    xc = ((x1 + x2) / 2) / img_w
    yc = ((y1 + y2) / 2) / img_h
    bw = (x2 - x1) / img_w
    bh = (y2 - y1) / img_h
    return xc, yc, bw, bh


def convert_one(json_path: Path, image_path: Path, image_out: Path, label_out: Path):
    data = json.loads(json_path.read_text(encoding="utf-8"))
    img_w = data.get("imageWidth")
    img_h = data.get("imageHeight")

    if not img_w or not img_h:
        raise RuntimeError(f"json 缺少 imageWidth/imageHeight: {json_path}")

    lines = []
    unknown_labels = []

    for shape in data.get("shapes", []):
        raw_label = str(shape.get("label", "")).strip().lower()
        if raw_label not in CLASS_MAP:
            unknown_labels.append(raw_label)
            continue

        points = shape.get("points", [])
        if len(points) < 2:
            continue

        x1, y1, x2, y2 = shape_to_bbox(points)
        x1 = max(0, min(x1, img_w - 1))
        y1 = max(0, min(y1, img_h - 1))
        x2 = max(0, min(x2, img_w - 1))
        y2 = max(0, min(y2, img_h - 1))

        if x2 <= x1 or y2 <= y1:
            continue

        cls_id = CLASS_MAP[raw_label]
        xc, yc, bw, bh = bbox_to_yolo(x1, y1, x2, y2, img_w, img_h)
        lines.append(f"{cls_id} {xc:.6f} {yc:.6f} {bw:.6f} {bh:.6f}")

    shutil.copy2(image_path, image_out)
    label_out.write_text("\n".join(lines), encoding="utf-8")
    return len(lines), unknown_labels


def main():
    # 只扫描当前目录下的 json，不往下层递归
    json_files = sorted(JSON_DIR.glob("*.json"))

    if not json_files:
        raise RuntimeError(f"没有找到 labelme json: {JSON_DIR}")

    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)

    random.seed(42)
    random.shuffle(json_files)

    val_count = max(1, round(len(json_files) * 0.2))
    val_set = set(json_files[:val_count])

    for split in ["train", "val"]:
        (OUT_DIR / "images" / split).mkdir(parents=True, exist_ok=True)
        (OUT_DIR / "labels" / split).mkdir(parents=True, exist_ok=True)

    total_boxes = 0
    unknown_all = {}

    for idx, json_path in enumerate(json_files, start=1):
        split = "val" if json_path in val_set else "train"

        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
            image_path = find_or_restore_image(json_path, data)
        except Exception as e:
            print(f"[ERROR] 读取或寻找图片失败 {json_path.name}: {e}")
            continue

        img_ext = image_path.suffix
        new_base_name = f"frame_{idx:06d}"
        
        image_out = OUT_DIR / "images" / split / f"{new_base_name}{img_ext}"
        label_out = OUT_DIR / "labels" / split / f"{new_base_name}.txt"

        n, unknown_labels = convert_one(json_path, image_path, image_out, label_out)
        total_boxes += n

        if unknown_labels:
            unknown_all[json_path.name] = sorted(set(unknown_labels))

        print(f"[OK] {split}: {json_path.name} -> {new_base_name}{img_ext}, boxes={n}")

    yaml_path = OUT_DIR / "data.yaml"
    yaml_path.write_text(
        f"""path: {OUT_DIR}
train: images/train
val: images/val

names:
  0: fall
  1: standing
  2: other
""",
        encoding="utf-8",
    )

    print("")
    print("[DONE] labelme v2 转 YOLO 完成（已自动启用安全重命名清洗机制）")
    print(f"[OK] json files: {len(json_files)}")
    print(f"[OK] total boxes: {total_boxes}")
    print(f"[OK] dataset: {OUT_DIR}")
    print(f"[OK] yaml: {yaml_path}")

    if unknown_all:
        print("")
        print("[WARN] 以下类别未识别，已跳过：")
        for filename, labels in unknown_all.items():
            print(filename, labels)


if __name__ == "__main__":
    main()