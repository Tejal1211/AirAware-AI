"""US AQI categories and a PM2.5 -> AQI conversion (US EPA 2024 breakpoints).

Open-Meteo reports the *US AQI*. India's official CPCB AQI uses different breakpoints,
so values here are not directly comparable with local government dashboards.
"""
from typing import Any

CATEGORIES: tuple[tuple[float, str, str], ...] = (
    (50.0, "Good", "good"),
    (100.0, "Moderate", "moderate"),
    (150.0, "Unhealthy for sensitive groups", "usg"),
    (200.0, "Unhealthy", "unhealthy"),
    (300.0, "Very unhealthy", "very_unhealthy"),
    (float("inf"), "Hazardous", "hazardous"),
)

# (pm_low, pm_high, aqi_low, aqi_high)
_PM25_BREAKPOINTS: tuple[tuple[float, float, int, int], ...] = (
    (0.0, 9.0, 0, 50),
    (9.1, 35.4, 51, 100),
    (35.5, 55.4, 101, 150),
    (55.5, 125.4, 151, 200),
    (125.5, 225.4, 201, 300),
    (225.5, 500.4, 301, 500),
)

WHO_PM25_24H: float = 15.0  # ug/m3, WHO 2021 air quality guideline (24-hour mean)
WHO_PM10_24H: float = 45.0  # ug/m3, WHO 2021 air quality guideline (24-hour mean)


def category_index(aqi: float) -> int:
    """Find the zero-based index of the US AQI category for a given score.

    Args:
        aqi: Numerical US AQI score.

    Returns:
        int: Index from 0 (Good) to 5 (Hazardous).
    """
    for i, (upper, _, _) in enumerate(CATEGORIES):
        if aqi <= upper:
            return i
    return len(CATEGORIES) - 1


def categorize(aqi: float | None) -> dict[str, Any]:
    """Classify an AQI value into its standard category index, text label, and tone key.

    Args:
        aqi: Numerical US AQI or None if unavailable.

    Returns:
        dict: Mapping containing 'index', 'label', and 'key'.
    """
    if aqi is None:
        return {"index": None, "label": "Unavailable", "key": "unknown"}
    i = category_index(aqi)
    return {"index": i, "label": CATEGORIES[i][1], "key": CATEGORIES[i][2]}


def aqi_from_pm25(pm25: float) -> int:
    """Convert PM2.5 concentration (ug/m3) to US AQI using US EPA 2024 linear interpolation.

    Args:
        pm25: PM2.5 particulate mass concentration in ug/m3.

    Returns:
        int: Computed US AQI integer between 0 and 500.
    """
    pm25 = max(0.0, float(pm25))
    for lo, hi, a_lo, a_hi in _PM25_BREAKPOINTS:
        if pm25 <= hi:
            return round(a_lo + (a_hi - a_lo) * (max(pm25, lo) - lo) / (hi - lo))
    return 500
