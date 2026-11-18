"""Strict input validation. All user input is validated and sanitised here, once."""
import math
import re

from .errors import ValidationError

_CONTROL = re.compile(r"[\x00-\x1f\x7f<>]")
_SPACES = re.compile(r"\s+")

COMMUTE_MODES = ("walk", "bicycle", "two_wheeler", "car", "bus", "metro", "other")
EXERCISE_LEVELS = ("none", "occasional", "regular")
COOKING_FUELS = ("electric", "lpg", "biomass")
WINDOW_TIGHTNESS = ("sealed", "normal", "leaky")
REPORT_CATEGORIES = ("visible_smog", "burning_waste", "construction_dust", "vehicle_smoke", "industrial_smoke", "other")
FROM_MODES = ("car_petrol", "car_diesel", "two_wheeler")
TO_MODES = ("bus", "metro", "carpool", "walk_cycle")


def clean_text(value, max_len: int) -> str:
    """Remove control characters and angle brackets, collapse whitespace, cap length."""
    if not isinstance(value, str):
        return ""
    return _SPACES.sub(" ", _CONTROL.sub(" ", value)).strip()[:max_len]


class _Collector:
    def __init__(self):
        self.errors: dict[str, str] = {}

    def number(self, data, key, path, lo, hi, default=None, integer=False):
        value = data.get(key, default)
        if value is None:
            self.errors[path] = "This field is required."
            return None
        ok_type = isinstance(value, int) if integer else isinstance(value, (int, float))
        if isinstance(value, bool) or not ok_type or (isinstance(value, float) and not math.isfinite(value)):
            self.errors[path] = "Enter a whole number." if integer else "Enter a number."
            return None
        if not lo <= value <= hi:
            self.errors[path] = f"Enter a value between {lo} and {hi}."
            return None
        return value

    def boolean(self, data, key, path, default=False):
        value = data.get(key, default)
        if not isinstance(value, bool):
            self.errors[path] = "Choose yes or no."
            return default
        return value

    def choice(self, data, key, path, options, default=None):
        value = data.get(key, default)
        if value not in options:
            self.errors[path] = "Choose one of: " + ", ".join(options) + "."
            return default
        return value

    def done(self):
        if self.errors:
            raise ValidationError(self.errors)


def _section(data, key, c, required=False):
    section = data.get(key, {} if not required else None)
    if not isinstance(section, dict):
        c.errors[key] = "This section is required." if required else "Must be an object."
        return {}
    return section


def validate_coordinates(lat, lon) -> tuple[float, float]:
    """Validate coordinates and round to 2 decimals (~1 km) to avoid storing precise locations."""
    c = _Collector()
    la = c.number({"v": lat}, "v", "latitude", -90, 90)
    lo = c.number({"v": lon}, "v", "longitude", -180, 180)
    c.done()
    return round(float(la), 2), round(float(lo), 2)


def validate_location(data: dict, c: _Collector) -> dict:
    loc = _section(data, "location", c, required=True)
    lat = c.number(loc, "latitude", "location.latitude", -90, 90)
    lon = c.number(loc, "longitude", "location.longitude", -180, 180)
    name = clean_text(loc.get("name", ""), 80) or "Selected location"
    return {"name": name, "latitude": None if lat is None else round(float(lat), 2),
            "longitude": None if lon is None else round(float(lon), 2)}


def validate_profile(data) -> dict:
    """Validate the onboarding profile. Contains no names or identifiers by design."""
    if not isinstance(data, dict):
        raise ValidationError({"profile": "Profile must be an object."})
    c = _Collector()
    location = validate_location(data, c)
    hh, cm, ls, ind = (_section(data, k, c) for k in ("household", "commute", "lifestyle", "indoor"))
    profile = {
        "location": location,
        "household": {
            "adults": c.number(hh, "adults", "household.adults", 0, 12, 1, integer=True),
            "children": c.number(hh, "children", "household.children", 0, 12, 0, integer=True),
            "older_adults": c.number(hh, "older_adults", "household.older_adults", 0, 12, 0, integer=True),
            "respiratory_condition": c.boolean(hh, "respiratory_condition", "household.respiratory_condition"),
        },
        "commute": {
            "mode": c.choice(cm, "mode", "commute.mode", COMMUTE_MODES, "bus"),
            "minutes_one_way": c.number(cm, "minutes_one_way", "commute.minutes_one_way", 0, 240, 30, integer=True),
        },
        "lifestyle": {
            "outdoor_exercise": c.choice(ls, "outdoor_exercise", "lifestyle.outdoor_exercise", EXERCISE_LEVELS, "occasional"),
            "works_from_home": c.boolean(ls, "works_from_home", "lifestyle.works_from_home"),
        },
        "indoor": {
            "cooking_fuel": c.choice(ind, "cooking_fuel", "indoor.cooking_fuel", COOKING_FUELS, "lpg"),
            "has_purifier": c.boolean(ind, "has_purifier", "indoor.has_purifier"),
            "windows": c.choice(ind, "windows", "indoor.windows", WINDOW_TIGHTNESS, "normal"),
            "near_busy_road": c.boolean(ind, "near_busy_road", "indoor.near_busy_road"),
            "has_range_hood": c.boolean(ind, "has_range_hood", "indoor.has_range_hood"),
        },
    }
    c.done()
    return profile


def validate_question(data) -> str:
    q = clean_text(data.get("question", "") if isinstance(data, dict) else "", 500)
    if len(q) < 3:
        raise ValidationError({"question": "Ask a question of at least 3 characters (max 500)."})
    return q


def validate_report(data) -> dict:
    if not isinstance(data, dict):
        raise ValidationError({"report": "Report must be an object."})
    c = _Collector()
    category = c.choice(data, "category", "category", REPORT_CATEGORIES)
    severity = c.number(data, "severity", "severity", 1, 3, None, integer=True)
    area = clean_text(data.get("area", ""), 60)
    if len(area) < 2:
        c.errors["area"] = "Enter a neighbourhood or city (2-60 characters)."
    c.done()
    return {"category": category, "severity": severity, "area": area, "note": clean_text(data.get("note", ""), 200)}


def validate_impact(data) -> dict:
    """Validate the impact-calculator request (emissions part and optional exposure part)."""
    if not isinstance(data, dict):
        raise ValidationError({"impact": "Request must be an object."})
    c = _Collector()
    em = _section(data, "emissions", c, required=True)
    clean = {"emissions": {
        "from_mode": c.choice(em, "from_mode", "emissions.from_mode", FROM_MODES),
        "to_mode": c.choice(em, "to_mode", "emissions.to_mode", TO_MODES),
        "one_way_km": c.number(em, "one_way_km", "emissions.one_way_km", 0.1, 100),
        "days_per_week": c.number(em, "days_per_week", "emissions.days_per_week", 1, 7, integer=True),
        "carpool_people": c.number(em, "carpool_people", "emissions.carpool_people", 2, 6, 2, integer=True),
    }, "exposure": None}
    if data.get("exposure") is not None:
        ex = _section(data, "exposure", c)
        loc_raw = data.get("location") or (ex.get("location") if isinstance(ex, dict) else None)
        loc = validate_location({"location": loc_raw}, c)
        clean["exposure"] = {
            "outdoor_hours": c.number(ex, "outdoor_hours", "exposure.outdoor_hours", 0, 12),
            "use_cleaner_window": c.boolean(ex, "use_cleaner_window", "exposure.use_cleaner_window"),
            "use_purifier": c.boolean(ex, "use_purifier", "exposure.use_purifier"),
            "location": loc,
        }
    c.done()
    return clean
