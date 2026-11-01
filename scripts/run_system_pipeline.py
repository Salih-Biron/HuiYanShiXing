import subprocess
import sys
from pathlib import Path


SYSTEM_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = SYSTEM_ROOT / "scripts"

RTMO_TO_EVENTS = SCRIPTS_DIR / "rtmo_to_pose_events.py"
FUSION_SCRIPT = SCRIPTS_DIR / "system_output_fusion.py"

POSE_EVENTS_JSON = SYSTEM_ROOT / "rtmo_pose_events" / "pose_events.json"
FUSION_OUTPUT_JSON = SYSTEM_ROOT / "outputs" / "system_fusion_output.json"


def run_script(script_path: Path):
    if not script_path.exists():
        raise FileNotFoundError(f"script not found: {script_path}")

    print("=" * 80)
    print(f"Running: {script_path}")
    print("=" * 80)

    subprocess.run(
        [sys.executable, str(script_path)],
        check=True
    )


def main():
    print("Huiyan vision system pipeline started.")

    run_script(RTMO_TO_EVENTS)
    run_script(FUSION_SCRIPT)

    print("=" * 80)
    print("Pipeline finished.")
    print(f"Pose events: {POSE_EVENTS_JSON}")
    print(f"Fusion output: {FUSION_OUTPUT_JSON}")
    print("=" * 80)


if __name__ == "__main__":
    main()
