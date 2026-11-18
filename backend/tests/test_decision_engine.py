import copy

import pytest

from app.services import aqi, decision_engine as de, sample_data
from tests.conftest import make_air

PEAKY = lambda h: ((220, 160.0) if 7 <= h <= 10 or 19 <= h <= 22 else ((95, 30.0) if 13 <= h <= 15 else (150, 55.0)))


def test_category_boundaries():
    assert aqi.categorize(50)["key"] == "good" and aqi.categorize(51)["key"] == "moderate"
    assert aqi.categorize(150)["key"] == "usg" and aqi.categorize(301)["key"] == "hazardous"
    assert aqi.categorize(None)["key"] == "unknown"


def test_pm25_conversion_monotonic_and_known_points():
    assert aqi.aqi_from_pm25(0) == 0 and aqi.aqi_from_pm25(9.0) == 50 and aqi.aqi_from_pm25(35.4) == 100
    assert aqi.aqi_from_pm25(300) > aqi.aqi_from_pm25(100) > aqi.aqi_from_pm25(20)


def test_sensitive_household_adjusts_moderate_only():
    assert de.risk_level(80, True)["index"] == 2 and de.risk_level(80, False)["index"] == 1
    assert de.risk_level(180, True)["index"] == de.risk_level(180, False)["index"] == 3


def test_best_window_picks_cleanest_daytime_slot():
    hours = de.future_hours(make_air(PEAKY, now_hour=6), 24)
    w = de.best_window(hours)
    assert w["start"].endswith("13:00") and w["mean_aqi"] == 95
    worst = de.best_window(hours, worst=True)
    assert worst["mean_aqi"] >= 200


def test_trend_detection():
    rising = make_air(lambda h: (60, 20.0) if h < 12 else (200, 100.0), now_hour=11)
    steady = make_air(lambda h: (100, 35.0), now_hour=11)
    assert de.compute_trend(rising)["direction"] == "rising"
    assert de.compute_trend(steady)["direction"] == "steady"


def test_every_recommendation_explains_itself(profile):
    plan = de.build_plan(profile, make_air(PEAKY, 7))
    recs = plan["planner"]["recommendations"] + plan["indoor"]["recommendations"] + plan["alternatives"] + plan["community"]
    assert recs
    for r in recs:
        assert r["why"] and r["expected_impact"] and r["action"]
        assert r["effect_type"] in {"personal_exposure", "emission_reduction", "both", "awareness"}


def test_exposed_commuter_gets_warning_at_high_aqi(profile):
    plan = de.build_plan(profile, make_air(PEAKY, 7))
    ids = {r["id"] for r in plan["planner"]["recommendations"]}
    assert "commute-exposed" in ids and "school-indoor" in ids and "exercise-indoor" in ids


def test_clean_air_gives_no_restrictions(profile):
    plan = de.build_plan(profile, make_air(lambda h: (30, 6.0), 7))
    ids = {r["id"] for r in plan["planner"]["recommendations"]}
    assert "commute-ok" in ids and "exercise-ok" in ids and "school-ok" in ids
    assert plan["alerts"][0]["severity"] == "ok"


def test_no_children_means_no_school_advice(profile):
    profile["household"]["children"] = 0
    plan = de.build_plan(profile, make_air(PEAKY, 7))
    assert not any(r["area"] == "school" for r in plan["planner"]["recommendations"])


def test_biomass_cooking_is_top_priority(profile):
    profile["indoor"]["cooking_fuel"] = "biomass"
    plan = de.build_plan(profile, make_air(PEAKY, 7))
    cook = next(r for r in plan["indoor"]["recommendations"] if r["area"] == "cooking")
    assert cook["id"] == "cook-biomass" and cook["priority"] == 1 and cook["effect_type"] == "both"


def test_purifier_owner_vs_non_owner(profile):
    air = make_air(PEAKY, 7)
    no = {r["id"] for r in de.build_plan(profile, air)["indoor"]["recommendations"]}
    p2 = copy.deepcopy(profile); p2["indoor"]["has_purifier"] = True
    yes = {r["id"] for r in de.build_plan(p2, air)["indoor"]["recommendations"]}
    assert "filter-get" in no and "filter-use" in yes and "filter-get" not in yes


def test_ventilation_changes_with_aqi(profile):
    closed = de.build_plan(profile, make_air(lambda h: (200, 100.0), 7))["indoor"]["recommendations"]
    opened = de.build_plan(profile, make_air(lambda h: (30, 6.0), 7))["indoor"]["recommendations"]
    assert any(r["id"] == "vent-closed" for r in closed) and any(r["id"] == "vent-open" for r in opened)


def test_alerts_for_peak_and_missing_data(profile):
    plan = de.build_plan(profile, make_air(PEAKY, 7))
    assert plan["alerts"][0]["severity"] in {"danger", "warning"}
    gap = make_air(lambda h: (None, None), 7)
    plan = de.build_plan(profile, gap)
    assert plan["risk"]["index"] is None and plan["alerts"] == []


def test_car_users_get_alternatives_walkers_less(profile):
    profile["commute"]["mode"] = "car"
    ids = {r["id"] for r in de.build_plan(profile, make_air(PEAKY, 7))["alternatives"]}
    assert {"alt-transit", "alt-carpool"} <= ids
    profile["commute"]["mode"] = "walk"
    ids = {r["id"] for r in de.build_plan(profile, make_air(PEAKY, 7))["alternatives"]}
    assert "alt-transit" not in ids


def test_sample_data_is_labelled(profile):
    s = sample_data.build_sample(28.6, 77.2)
    assert s["source"]["is_sample"] is True and "SAMPLE" in s["source"]["name"]
    assert de.build_plan(profile, s)["air"]["source"]["is_sample"] is True
