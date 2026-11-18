"""Open-Meteo Air Quality + Geocoding clients with a small in-memory TTL cache.

Data are modelled estimates (CAMS), not readings from a local sensor. This is stated in the
`source` block returned to the UI.
"""
import time
from datetime import datetime, timezone

import requests

from . import aqi as aqi_mod
from ..errors import ApiError

AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
GEO_URL = "https://geocoding-api.open-meteo.com/v1/search"
CURRENT_FIELDS = "us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone"
HOURLY_FIELDS = "us_aqi,pm10,pm2_5"
POLLUTANTS = ("pm2_5", "pm10", "ozone", "nitrogen_dioxide", "sulphur_dioxide", "carbon_monoxide")

_cache: dict[tuple, tuple[float, dict]] = {}
_CACHE_MAX = 200


class AirDataError(ApiError):
    """Upstream air-quality data could not be retrieved."""

    def __init__(self, message: str):
        super().__init__(message, 502)


def clear_cache() -> None:
    _cache.clear()


def _get_json(url: str, params: dict, timeout: int, http=None) -> dict:
    try:
        resp = (http or requests).get(url, params=params, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        raise AirDataError("Live air-quality data is unavailable right now. Try again shortly, or use labelled sample data.") from exc
    except ValueError as exc:
        raise AirDataError("The air-quality service returned an unreadable response.") from exc


def search_places(query: str, timeout: int = 10, http=None) -> list[dict]:
    data = _get_json(GEO_URL, {"name": query, "count": 5, "language": "en", "format": "json"}, timeout, http)
    return [
        {"name": ", ".join(p for p in (r.get("name"), r.get("admin1"), r.get("country")) if p),
         "latitude": round(r["latitude"], 2), "longitude": round(r["longitude"], 2)}
        for r in data.get("results", []) if "latitude" in r and "longitude" in r
    ]


def normalize(raw: dict, lat: float, lon: float) -> dict:
    """Turn the raw Open-Meteo payload into the compact structure used by the engine and UI."""
    hourly_raw = raw.get("hourly") or {}
    times = hourly_raw.get("time") or []
    if not times:
        raise AirDataError("The air-quality service returned no hourly data for this location.")
    hourly = [
        {"time": t,
         "us_aqi": (hourly_raw.get("us_aqi") or [None] * len(times))[i],
         "pm2_5": (hourly_raw.get("pm2_5") or [None] * len(times))[i],
         "pm10": (hourly_raw.get("pm10") or [None] * len(times))[i]}
        for i, t in enumerate(times)
    ]
    cur_raw = raw.get("current") or {}
    cur_time = cur_raw.get("time") or times[0]
    hour_key = cur_time[:13]
    now_idx = next((i for i, h in enumerate(hourly) if h["time"][:13] >= hour_key), len(hourly) - 1)
    # keep 24 h of history and 48 h of forecast to stay light
    start, end = max(0, now_idx - 24), min(len(hourly), now_idx + 49)
    hourly, now_idx = hourly[start:end], now_idx - start

    current = {p: cur_raw.get(p) for p in POLLUTANTS}
    current["us_aqi"] = cur_raw.get("us_aqi") if cur_raw.get("us_aqi") is not None else hourly[now_idx]["us_aqi"]
    if current["pm2_5"] is None:
        current["pm2_5"] = hourly[now_idx]["pm2_5"]
    if current["pm10"] is None:
        current["pm10"] = hourly[now_idx]["pm10"]
    current["time"] = cur_time
    current.update({f"category_{k}": v for k, v in aqi_mod.categorize(current["us_aqi"]).items()})
    current["who_pm25_multiple"] = None if current["pm2_5"] is None else round(current["pm2_5"] / aqi_mod.WHO_PM25_24H, 1)
    current["who_pm10_multiple"] = None if current["pm10"] is None else round(current["pm10"] / aqi_mod.WHO_PM10_24H, 1)
    return {
        "source": {
            "name": "Open-Meteo Air Quality API", "is_sample": False,
            "note": "Modelled estimates (CAMS) on a coarse grid. They are not readings from a nearby monitor and can differ from local sensors.",
            "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "location": {"latitude": lat, "longitude": lon},
        "units": raw.get("current_units") or {},
        "current": current, "hourly": hourly, "now_index": now_idx,
    }


def fetch_air_quality(lat: float, lon: float, ttl: int = 600, timeout: int = 10, http=None) -> dict:
    """Fetch (and briefly cache) air quality for coordinates already validated and rounded."""
    key = (lat, lon)
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < ttl:
        return hit[1]
    params = {"latitude": lat, "longitude": lon, "current": CURRENT_FIELDS, "hourly": HOURLY_FIELDS,
              "past_days": 1, "forecast_days": 3, "timezone": "auto"}
    result = normalize(_get_json(AIR_URL, params, timeout, http), lat, lon)
    if len(_cache) >= _CACHE_MAX:
        _cache.clear()
    _cache[key] = (time.monotonic(), result)
    return result
