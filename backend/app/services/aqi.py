"""US AQI categories and a PM2.5 -> AQI conversion (US EPA 2024 breakpoints).

Open-Meteo reports the *US AQI*. India's official CPCB AQI uses different breakpoints,
so values here are not directly comparable with local government dashboards.
"""

CATEGORIES = (
    (50, "Good", "good"),
    (100, "Moderate", "moderate"),
    (150, "Unhealthy for sensitive groups", "usg"),
    (200, "Unhealthy", "unhealthy"),
    (300, "Very unhealthy", "very_unhealthy"),
    (float("inf"), "Hazardous", "hazardous"),
)

# (pm_low, pm_high, aqi_low, aqi_high)
_PM25_BREAKPOINTS = (
    (0.0, 9.0, 0, 50), (9.1, 35.4, 51, 100), (35.5, 55.4, 101, 150),
    (55.5, 125.4, 151, 200), (125.5, 225.4, 201, 300), (225.5, 500.4, 301, 500),
)

WHO_PM25_24H = 15.0  # ug/m3, WHO 2021 air quality guideline (24-hour mean)
WHO_PM10_24H = 45.0  # ug/m3, WHO 2021 air quality guideline (24-hour mean)


def category_index(aqi: float) -> int:
    for i, (upper, _, _) in enumerate(CATEGORIES):
        if aqi <= upper:
            return i
    return len(CATEGORIES) - 1


def categorize(aqi: float | None) -> dict:
    """Return {index, label, key} for an AQI value (None -> unknown)."""
    if aqi is None:
        return {"index": None, "label": "Unavailable", "key": "unknown"}
    i = category_index(aqi)
    return {"index": i, "label": CATEGORIES[i][1], "key": CATEGORIES[i][2]}


def aqi_from_pm25(pm25: float) -> int:
    """Convert PM2.5 (ug/m3) to US AQI by linear interpolation within EPA breakpoints."""
    pm25 = max(0.0, float(pm25))
    for lo, hi, a_lo, a_hi in _PM25_BREAKPOINTS:
        if pm25 <= hi:
            return round(a_lo + (a_hi - a_lo) * (max(pm25, lo) - lo) / (hi - lo))
    return 500
