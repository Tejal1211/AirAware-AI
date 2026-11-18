import pytest

from app.errors import ValidationError
from app import validation as v


def test_valid_profile_passes(profile):
    clean = v.validate_profile(profile)
    assert clean["location"]["latitude"] == 28.61
    assert clean["household"]["children"] == 1


def test_defaults_fill_optional_sections():
    clean = v.validate_profile({"location": {"latitude": 10, "longitude": 20}})
    assert clean["commute"]["mode"] == "bus" and clean["indoor"]["cooking_fuel"] == "lpg"


@pytest.mark.parametrize("lat,lon", [(91, 0), (-91, 0), (0, 181), ("x", 0), (True, 0), (float("nan"), 0), (None, 5)])
def test_bad_coordinates_rejected(lat, lon):
    with pytest.raises(ValidationError):
        v.validate_coordinates(lat, lon)


def test_coordinates_rounded():
    assert v.validate_coordinates(28.6139123, 77.2090456) == (28.61, 77.21)


def test_invalid_fields_report_each_path(profile):
    profile["household"]["children"] = -1
    profile["commute"]["mode"] = "teleport"
    profile["indoor"]["has_purifier"] = "yes"
    with pytest.raises(ValidationError) as exc:
        v.validate_profile(profile)
    assert {"household.children", "commute.mode", "indoor.has_purifier"} <= set(exc.value.details)


def test_non_object_profile_rejected():
    with pytest.raises(ValidationError):
        v.validate_profile("nope")


def test_text_sanitised():
    assert v.clean_text("  <script>alert(1)</script>\n\tHello  ", 50) == "script alert(1) /script Hello"
    assert len(v.clean_text("a" * 500, 80)) == 80


def test_question_validation():
    assert v.validate_question({"question": "  Can kids play?  "}) == "Can kids play?"
    for bad in ({"question": "hi"}, {}, None, {"question": 5}):
        with pytest.raises(ValidationError):
            v.validate_question(bad)


def test_report_validation():
    ok = v.validate_report({"category": "burning_waste", "severity": 2, "area": "Rohini", "note": "smoke"})
    assert ok["severity"] == 2
    for bad in ({"category": "x", "severity": 2, "area": "Rohini"}, {"category": "other", "severity": 9, "area": "Rohini"},
                {"category": "other", "severity": 1, "area": "a"}):
        with pytest.raises(ValidationError):
            v.validate_report(bad)


def test_impact_validation_requires_location_for_exposure():
    body = {"emissions": {"from_mode": "car_petrol", "to_mode": "metro", "one_way_km": 10, "days_per_week": 5},
            "exposure": {"outdoor_hours": 2, "use_cleaner_window": True, "use_purifier": False}}
    with pytest.raises(ValidationError):
        v.validate_impact(body)
    body["location"] = {"latitude": 1, "longitude": 2}
    assert v.validate_impact(body)["exposure"]["outdoor_hours"] == 2
