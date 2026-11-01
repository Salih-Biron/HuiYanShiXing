from datetime import datetime
from zoneinfo import ZoneInfo


BUSINESS_TIMEZONE = ZoneInfo("Asia/Shanghai")


def local_now() -> datetime:
    return datetime.now(BUSINESS_TIMEZONE)


def local_now_iso() -> str:
    return local_now().isoformat(timespec="seconds")


def local_now_str() -> str:
    return local_now().strftime("%Y-%m-%d %H:%M:%S")


def local_timezone_name() -> str:
    return BUSINESS_TIMEZONE.key
