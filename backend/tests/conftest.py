import io

try:
    import pyreadline3.console
    pyreadline3.console.Console.__del__ = lambda self: None
except Exception:
    pass

import cv2
import numpy as np
import pytest

from app import create_app
from app.services import air_quality, rate_limit, reports, sample_data


@pytest.fixture(autouse=True)
def _clean_state():
    air_quality.clear_cache()
    reports.clear()
    rate_limit.reset()
    yield


@pytest.fixture
def app():
    return create_app({"TESTING": True, "GEMINI_API_KEY": "", "RATE_LIMIT_ENABLED": True})


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def profile():
    return {
        "location": {"name": "Delhi", "latitude": 28.61, "longitude": 77.21},
        "household": {"adults": 2, "children": 1, "older_adults": 0, "respiratory_condition": False},
        "commute": {"mode": "two_wheeler", "minutes_one_way": 30},
        "lifestyle": {"outdoor_exercise": "regular", "works_from_home": False},
        "indoor": {"cooking_fuel": "lpg", "has_purifier": False, "windows": "leaky", "near_busy_road": True, "has_range_hood": False},
    }


def make_air(aqi_by_hour, now_hour=7):
    """Build an air dict with a flat 'today' day from a function hour->(aqi, pm2.5)."""
    from datetime import datetime, timedelta
    base = datetime(2026, 11, 18, 0, 0)
    hourly = []
    for i in range(-24 + now_hour, 72):
        t = base + timedelta(hours=i)
        aqi, pm = aqi_by_hour(t.hour)
        hourly.append({"time": t.strftime("%Y-%m-%dT%H:00"), "us_aqi": aqi, "pm2_5": pm, "pm10": pm * 1.5 if pm is not None else None})
    now_idx = 24 - now_hour + now_hour - 0
    now_idx = next(i for i, h in enumerate(hourly) if h["time"] == f"2026-11-18T{now_hour:02d}:00")
    cur = hourly[now_idx]
    from app.services import aqi as a
    current = {"us_aqi": cur["us_aqi"], "pm2_5": cur["pm2_5"], "pm10": cur["pm10"], "time": cur["time"]}
    current.update({f"category_{k}": v for k, v in a.categorize(cur["us_aqi"]).items()})
    return {"source": {"name": "test", "is_sample": True, "note": "", "fetched_at": ""}, "location": {}, "units": {},
            "current": current, "hourly": hourly, "now_index": now_idx}


def png_bytes(img):
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


@pytest.fixture
def clear_image():
    rng = np.random.default_rng(1)
    img = np.zeros((240, 320, 3), np.uint8)
    img[:] = (rng.integers(0, 255, (240, 320, 3))).astype(np.uint8)
    cv2.rectangle(img, (20, 20), (150, 200), (0, 0, 255), -1)
    cv2.circle(img, (230, 120), 60, (0, 200, 0), -1)
    return png_bytes(img)


@pytest.fixture
def hazy_image():
    rng = np.random.default_rng(2)
    img = (200 + rng.integers(0, 8, (240, 320, 3))).astype(np.uint8)
    return png_bytes(img)
