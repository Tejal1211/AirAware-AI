from app.services import impact
from tests.conftest import make_air

E = {"from_mode": "car_petrol", "to_mode": "metro", "one_way_km": 10, "days_per_week": 5, "carpool_people": 2}


def test_metro_switch_numbers():
    r = impact.calc_emissions(E)
    assert r["distance_km_per_week"] == 100.0
    assert r["saved_kg_co2e_week"] == 13.5          # (170-35) g * 100 km
    assert r["saved_kg_co2e_year"] == 702


def test_walk_saves_everything_and_carpool_halves():
    assert impact.calc_emissions({**E, "to_mode": "walk_cycle"})["new_kg_co2e_week"] == 0
    car = impact.calc_emissions({**E, "to_mode": "carpool", "carpool_people": 4})
    assert car["new_kg_co2e_week"] == 4.25 and car["percent_reduction"] == 75


def test_never_negative_savings():
    r = impact.calc_emissions({**E, "from_mode": "two_wheeler", "to_mode": "carpool", "carpool_people": 2})
    assert r["saved_kg_co2e_week"] >= 0


def test_exposure_reduces_but_emissions_stay_zero():
    air = make_air(lambda h: (150, 60.0) if h != 14 and h != 13 else (90, 28.0), 7)
    x = {"outdoor_hours": 2, "use_cleaner_window": True, "use_purifier": True}
    r = impact.calc_exposure(x, air)
    assert r["available"] and r["scenario_index"] < r["baseline_index"] and 0 < r["percent_reduction"] < 100
    assert r["emission_reduction_kg_co2e"] == 0 and "do not reduce the pollution" in r["note"]


def test_exposure_unavailable_without_pm25():
    r = impact.calc_exposure({"outdoor_hours": 2, "use_cleaner_window": False, "use_purifier": False}, make_air(lambda h: (None, None), 7))
    assert r["available"] is False


def test_calculate_lists_assumptions():
    out = impact.calculate({"emissions": E, "exposure": None}, None)
    assert out["exposure"] is None and out["assumptions"]["caveats"] and "different" in out["explanation"]
