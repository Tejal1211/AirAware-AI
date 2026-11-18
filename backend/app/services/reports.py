"""In-memory community pollution reports. Anonymous: no IP, device or user identifier is stored.

Reports are unverified and reset on restart. This keeps the app dependency-free and private.
"""
from collections import Counter, deque
from datetime import datetime, timezone
from threading import Lock

MAX_REPORTS = 200
_reports: deque = deque(maxlen=MAX_REPORTS)
_lock = Lock()
_next_id = 1


def clear() -> None:
    global _next_id
    with _lock:
        _reports.clear()
        _next_id = 1


def add_report(clean: dict) -> dict:
    global _next_id
    with _lock:
        item = {"id": _next_id, **clean, "created_at": datetime.now(timezone.utc).isoformat(timespec="minutes")}
        _next_id += 1
        _reports.appendleft(item)
    return item


def list_reports(area: str = "", limit: int = 30) -> dict:
    area = area.strip().lower()[:60]
    with _lock:
        items = [r for r in _reports if not area or area in r["area"].lower()]
    return {"reports": items[:limit], "total": len(items), "by_category": dict(Counter(r["category"] for r in items)),
            "note": "Community reports are anonymous, unverified and stored only in server memory."}
