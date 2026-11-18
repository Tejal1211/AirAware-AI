"""Tiny in-memory sliding-window rate limiter (per client address). No addresses are persisted."""
import time
from collections import defaultdict, deque
from functools import wraps

from flask import current_app, request

from ..errors import ApiError

_hits: dict[tuple, deque] = defaultdict(deque)


def reset() -> None:
    _hits.clear()


def rate_limit(name: str, limit: int, window_s: int = 3600):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if current_app.config.get("RATE_LIMIT_ENABLED", True):
                now = time.monotonic()
                q = _hits[(name, request.remote_addr)]
                while q and now - q[0] > window_s:
                    q.popleft()
                if len(q) >= limit:
                    raise ApiError("Too many requests. Please wait a while and try again.", 429)
                q.append(now)
            return fn(*args, **kwargs)
        return wrapper
    return decorator
