"""In-memory community pollution reports. Anonymous: no IP, device or user identifier is stored.

Reports are unverified and reset on restart. This keeps the app dependency-free and private.
"""
from typing import Any
from collections import Counter, deque
from datetime import datetime, timezone
from threading import Lock

MAX_REPORTS: int = 200
_reports: deque[dict[str, Any]] = deque(maxlen=MAX_REPORTS)
_lock: Lock = Lock()
_next_id: int = 1


def clear() -> None:
    """Clear all stored reports and reset the sequence counter (used for test teardown)."""
    global _next_id
    with _lock:
        _reports.clear()
        _next_id = 1


def add_report(clean: dict[str, Any]) -> dict[str, Any]:
    """Store an anonymized citizen pollution report in memory.

    Args:
        clean: Validated report dictionary with category, severity, area, and optional note.

    Returns:
        The created report record with unique id and ISO timestamp.
    """
    global _next_id
    with _lock:
        item = {
            "id": _next_id,
            **clean,
            "created_at": datetime.now(timezone.utc).isoformat(timespec="minutes")
        }
        _next_id += 1
        _reports.appendleft(item)
    return item


def list_reports(area: str = "", limit: int = 30) -> dict[str, Any]:
    """Retrieve filtered community pollution reports with summary statistics.

    Args:
        area: Optional neighborhood/area filter string.
        limit: Maximum number of recent reports to return.

    Returns:
        Dictionary with reports array, total count, and category breakdown.
    """
    area = area.strip().lower()[:60]
    with _lock:
        items = [r for r in _reports if not area or area in r["area"].lower()]
    return {
        "reports": items[:limit],
        "total": len(items),
        "by_category": dict(Counter(r["category"] for r in items)),
        "note": "Community reports are anonymous, unverified and stored only in server memory."
    }
