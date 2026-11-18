"""Impact calculator that keeps two ideas strictly separate:

1. EMISSION REDUCTION - less pollution actually released (e.g. fewer car-km). Estimated in kg CO2e.
2. PERSONAL EXPOSURE REDUCTION - less pollution *you breathe*. This does not reduce emissions.

All factors are indicative, rounded values and are returned to the UI as `assumptions`.
"""
from typing import Any
from . import decision_engine as engine

# grams CO2e per passenger-km (tailpipe, rounded, indicative; real values vary by vehicle, load and fuel)
EMISSION_FACTORS_G_PKM: dict[str, float] = {
    "car_petrol": 170.0,
    "car_diesel": 165.0,
    "two_wheeler": 90.0,
    "bus": 80.0,
    "metro": 35.0,
    "walk_cycle": 0.0,
}
WEEKS_PER_MONTH: float = 4.33
WEEKS_PER_YEAR: float = 52.0

# Illustrative exposure model: share of outdoor PM2.5 found indoors.
INDOOR_RATIO: float = 0.6            # typical homes with normal ventilation (assumption)
INDOOR_RATIO_PURIFIER: float = 0.3   # same home with a correctly sized purifier running (assumption)


def calc_emissions(e: dict[str, Any]) -> dict[str, Any]:
    """Calculate weekly, monthly, and yearly CO2e saved by switching commute mode.

    Args:
        e: Validated emission dictionary containing from_mode, to_mode, one_way_km, days_per_week.

    Returns:
        Dictionary with baseline, new, saved kg CO2e, distance, and percentage reduction.
    """
    km_week = e["one_way_km"] * 2 * e["days_per_week"]
    old = EMISSION_FACTORS_G_PKM[e["from_mode"]]
    if e["to_mode"] == "carpool":
        new = old / e["carpool_people"]
        new_label = f"carpool of {e['carpool_people']} people"
    else:
        new = EMISSION_FACTORS_G_PKM[e["to_mode"]]
        new_label = e["to_mode"].replace("_", "/")
    saved_week = max(0.0, (old - new) * km_week / 1000)
    return {
        "distance_km_per_week": round(km_week, 1),
        "baseline_kg_co2e_week": round(old * km_week / 1000, 2),
        "new_kg_co2e_week": round(new * km_week / 1000, 2),
        "saved_kg_co2e_week": round(saved_week, 2),
        "saved_kg_co2e_month": round(saved_week * WEEKS_PER_MONTH, 1),
        "saved_kg_co2e_year": round(saved_week * WEEKS_PER_YEAR, 0),
        "percent_reduction": round(100 * (1 - new / old), 0) if old else 0,
        "from": e["from_mode"].replace("_", " "),
        "to": new_label,
    }


def calc_exposure(x: dict[str, Any], air: dict[str, Any]) -> dict[str, Any]:
    """Compare a 24-hour personal PM2.5 exposure index for baseline vs recommended behavior.

    Args:
        x: Validated exposure choices (outdoor_hours, use_cleaner_window, use_purifier).
        air: Air quality forecast data.

    Returns:
        Dictionary with baseline and scenario exposure index and percentage reduction.
    """
    hours = engine.future_hours(air, 24)
    daytime = [h["pm2_5"] for h in hours if 6 <= engine._hour(h) < 21 and h["pm2_5"] is not None]
    window = engine.best_window(hours)
    if not daytime or not window or window["mean_pm2_5"] is None:
        return {"available": False, "reason": "Forecast PM2.5 is not available for this location."}
    typical = sum(daytime) / len(daytime)
    outdoor_h = x["outdoor_hours"]
    out_pm = window["mean_pm2_5"] if x["use_cleaner_window"] else typical
    ratio = INDOOR_RATIO_PURIFIER if x["use_purifier"] else INDOOR_RATIO
    baseline = outdoor_h * typical + (24 - outdoor_h) * typical * INDOOR_RATIO
    scenario = outdoor_h * out_pm + (24 - outdoor_h) * typical * ratio
    return {
        "available": True,
        "baseline_index": round(baseline),
        "scenario_index": round(scenario),
        "percent_reduction": round(100 * (baseline - scenario) / baseline) if baseline else 0,
        "typical_daytime_pm2_5": round(typical, 1),
        "cleaner_window_pm2_5": round(window["mean_pm2_5"], 1),
        "emission_reduction_kg_co2e": 0,
        "note": "These choices change what you breathe. They do not reduce the pollution released into the city.",
    }


def calculate(clean: dict[str, Any], air: dict[str, Any] | None) -> dict[str, Any]:
    """Calculate combined emissions and exposure metrics with transparent assumptions.

    Args:
        clean: Validated impact payload.
        air: Optional air quality data for exposure modeling.

    Returns:
        Dictionary containing emissions, exposure, assumptions, and explanation.
    """
    result = {
        "emissions": calc_emissions(clean["emissions"]),
        "exposure": None,
        "assumptions": {
            "emission_factors_g_co2e_per_passenger_km": EMISSION_FACTORS_G_PKM,
            "indoor_to_outdoor_pm25_ratio": INDOOR_RATIO,
            "indoor_to_outdoor_pm25_ratio_with_purifier": INDOOR_RATIO_PURIFIER,
            "caveats": [
                "Emission factors are indicative averages; your vehicle may differ.",
                "Only CO2e is estimated. PM2.5 and NOx savings depend on vehicle age and fuel and are not quantified.",
                "The exposure index is an illustration (ug/m3 x hours), not a health risk score."
            ]
        },
        "explanation": "Emission reduction means less pollution released. Exposure reduction means less pollution you breathe. They are different and are shown separately."
    }
    if clean["exposure"] is not None and air is not None:
        result["exposure"] = calc_exposure(clean["exposure"], air)
    return result
