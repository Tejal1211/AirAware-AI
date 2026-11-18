"""Deterministic, clearly-labelled SAMPLE air-quality data for demos and offline use.

Never used unless the user explicitly asks for sample data. The UI shows a banner when it is active.
"""
import math
from datetime import datetime, timedelta

from . import aqi as aqi_mod


def build_sample(lat: float, lon: float, now: datetime | None = None) -> dict:
    now = (now or datetime.now()).replace(minute=0, second=0, microsecond=0)
    hourly = []
    for offset in range(-24, 49):
        t = now + timedelta(hours=offset)
        # winter-smog-like pattern: peaks near 08:00 and 21:00, cleaner mid-afternoon
        pm25 = 95 + 45 * math.cos((t.hour - 8) / 24 * 2 * math.pi) * 0.6 + 35 * math.cos((t.hour - 21) / 24 * 2 * math.pi) * 0.4
        pm25 = round(max(10.0, pm25 - (25 if 12 <= t.hour <= 16 else 0)), 1)
        hourly.append({"time": t.strftime("%Y-%m-%dT%H:00"), "pm2_5": pm25, "pm10": round(pm25 * 1.6, 1),
                       "us_aqi": aqi_mod.aqi_from_pm25(pm25)})
    cur = hourly[24]
    current = {"us_aqi": cur["us_aqi"], "pm2_5": cur["pm2_5"], "pm10": cur["pm10"], "ozone": 38.0,
               "nitrogen_dioxide": 42.0, "sulphur_dioxide": 12.0, "carbon_monoxide": 640.0, "time": cur["time"]}
    current.update({f"category_{k}": v for k, v in aqi_mod.categorize(current["us_aqi"]).items()})
    current["who_pm25_multiple"] = round(current["pm2_5"] / aqi_mod.WHO_PM25_24H, 1)
    current["who_pm10_multiple"] = round(current["pm10"] / aqi_mod.WHO_PM10_24H, 1)
    return {
        "source": {"name": "SAMPLE DATA (not real)", "is_sample": True,
                   "note": "Synthetic values for demonstration only. They do not describe real air quality anywhere.",
                   "fetched_at": now.isoformat(timespec="seconds")},
        "location": {"latitude": lat, "longitude": lon},
        "units": {"pm2_5": "ug/m3", "pm10": "ug/m3", "ozone": "ug/m3", "nitrogen_dioxide": "ug/m3",
                  "sulphur_dioxide": "ug/m3", "carbon_monoxide": "ug/m3"},
        "current": current, "hourly": hourly, "now_index": 24,
    }
