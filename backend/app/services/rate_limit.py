"""Tiny in-memory sliding-window rate limiter (per client address). No addresses are persisted."""
from typing import Any, Callable
import time
from collections import defaultdict, deque
from functools import wraps

from flask import current_app, request

from ..errors import ApiError

_hits: dict[tuple[str, str | None], deque[float]] = defaultdict(deque)


def reset() -> None:
    """Clear all active sliding-window counters (useful for unit testing)."""
    _hits.clear()


def rate_limit(name: str, limit: int, window_s: int = 3600) -> Callable:
    """Decorate an endpoint with sliding-window rate limiting.

    Args:
        name: Unique rate limit bucket name.
        limit: Maximum requests permitted within window_s.
        window_s: Sliding window duration in seconds (defaults to 3600).

    Returns:
        Callable: Wrapped endpoint function enforcing rate limit.

    Raises:
        ApiError: HTTP 429 when client exceeds limit within window.
    """
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            if current_app.config.get("RATE_LIMIT_ENABLED", True):
                now = time.monotonic()
                client_ip = request.remote_addr or "127.0.0.1"
                q = _hits[(name, client_ip)]
                while q and now - q[0] > window_s:
                    q.popleft()
                if len(q) >= limit:
                    retry_after = int(window_s - (now - q[0])) + 1
                    raise ApiError(
                        "Too many requests. Please wait a while and try again.",
                        429,
                        {"retry_after": retry_after}
                    )
                q.append(now)
            return fn(*args, **kwargs)
        return wrapper
    return decorator
