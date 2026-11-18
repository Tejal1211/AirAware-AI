import io

import pytest

from app.services import air_quality, assistant
from tests.conftest import make_air


def post(client, url, body):
    return client.post(url, json=body)


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json == {"status": "ok", "gemini_configured": False}


def test_unknown_api_route_is_json_404(client):
    r = client.get("/api/nope")
    assert r.status_code == 404 and "error" in r.json


def test_plan_with_sample_data_is_labelled(client, profile):
    r = post(client, "/api/plan", {"profile": profile, "demo": True})
    assert r.status_code == 200
    assert r.json["air"]["source"]["is_sample"] is True
    assert r.json["planner"]["recommendations"] and r.json["disclaimer"]


def test_plan_uses_live_fetch_and_not_sample_by_default(client, profile, monkeypatch):
    seen = {}
    def fake(lat, lon, ttl, timeout):
        seen["coords"] = (lat, lon)
        return make_air(lambda h: (120, 45.0), 7)
    monkeypatch.setattr(air_quality, "fetch_air_quality", fake)
    r = post(client, "/api/plan", {"profile": profile})
    assert r.status_code == 200 and seen["coords"] == (28.61, 77.21) and r.json["air"]["current"]["us_aqi"] == 120


def test_plan_reports_upstream_outage_clearly(client, profile, monkeypatch):
    def boom(*a, **k):
        raise air_quality.AirDataError("Live air-quality data is unavailable right now.")
    monkeypatch.setattr(air_quality, "fetch_air_quality", boom)
    r = post(client, "/api/plan", {"profile": profile})
    assert r.status_code == 502 and "unavailable" in r.json["error"]


def test_plan_validation_errors(client, profile):
    profile["location"]["latitude"] = 500
    r = post(client, "/api/plan", {"profile": profile, "demo": True})
    assert r.status_code == 400 and "location.latitude" in r.json["details"]
    assert client.post("/api/plan", data="not json", content_type="text/plain").status_code == 400
    assert post(client, "/api/plan", {}).status_code == 400


def test_air_quality_endpoint_validates_query(client):
    assert client.get("/api/air-quality?lat=abc&lon=1").status_code == 400
    assert client.get("/api/air-quality?lat=95&lon=1").status_code == 400
    ok = client.get("/api/air-quality?lat=28.6&lon=77.2&demo=1")
    assert ok.status_code == 200 and ok.json["trend"]["direction"] in {"rising", "steady", "improving"}


def test_geocode_requires_query(client):
    assert client.get("/api/geocode?q=").status_code == 400


def test_assistant_falls_back_without_key(client, profile):
    r = post(client, "/api/assistant", {"profile": profile, "question": "Should the kids play outside?", "demo": True})
    assert r.status_code == 200 and r.json["source"] == "rules" and r.json["basis"]["is_sample_data"] is True


def test_assistant_uses_gemini_when_configured(profile, monkeypatch):
    from app import create_app
    monkeypatch.setattr("app.services.gemini_client.generate", lambda *a, **k: "Gemini says stay in.")
    c = create_app({"TESTING": True, "GEMINI_API_KEY": "k"}).test_client()
    r = c.post("/api/assistant", json={"profile": profile, "question": "What now?", "demo": True})
    assert r.json["source"] == "gemini" and r.json["answer"] == "Gemini says stay in."


def test_assistant_rejects_short_question(client, profile):
    assert post(client, "/api/assistant", {"profile": profile, "question": "?", "demo": True}).status_code == 400


def upload(client, data, name="photo.png"):
    return client.post("/api/haze/analyze", data={"image": (io.BytesIO(data), name)}, content_type="multipart/form-data")


def test_haze_upload_success(client, clear_image):
    r = upload(client, clear_image)
    assert r.status_code == 200 and "does not measure AQI" in r.json["disclaimer"]


def test_haze_upload_errors(client, clear_image):
    assert client.post("/api/haze/analyze", data={}, content_type="multipart/form-data").status_code == 400
    assert upload(client, clear_image, "evil.exe").status_code == 415
    assert upload(client, b"MZ not an image", "fake.png").status_code == 415
    assert upload(client, b"\x89PNG\r\n\x1a\nbroken", "broken.png").status_code == 422


def test_haze_upload_size_limit(profile):
    from app import create_app
    c = create_app({"TESTING": True, "MAX_CONTENT_LENGTH": 1000, "UPLOAD_LIMIT_MB": 1}).test_client()
    r = c.post("/api/haze/analyze", data={"image": (io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * 5000), "big.png")}, content_type="multipart/form-data")
    assert r.status_code == 413 and "too large" in r.json["error"]


def test_impact_endpoint_separates_emissions_and_exposure(client):
    body = {"emissions": {"from_mode": "car_petrol", "to_mode": "bus", "one_way_km": 8, "days_per_week": 5},
            "exposure": {"outdoor_hours": 2, "use_cleaner_window": True, "use_purifier": True},
            "location": {"latitude": 28.6, "longitude": 77.2}, "demo": True}
    r = post(client, "/api/impact", body)
    assert r.status_code == 200
    assert r.json["emissions"]["saved_kg_co2e_week"] > 0 and r.json["exposure"]["emission_reduction_kg_co2e"] == 0


def test_impact_validation(client):
    r = post(client, "/api/impact", {"emissions": {"from_mode": "jet", "to_mode": "bus", "one_way_km": -1, "days_per_week": 9}})
    assert r.status_code == 400 and len(r.json["details"]) == 3


def test_reports_roundtrip_and_privacy(client):
    r = post(client, "/api/reports", {"category": "burning_waste", "severity": 3, "area": "Rohini <b>", "note": "Smoke from a pile"})
    assert r.status_code == 201 and "<" not in r.json["area"]
    assert set(r.json) == {"id", "category", "severity", "area", "note", "created_at"}  # no IP / identifiers stored
    lst = client.get("/api/reports?area=rohini").json
    assert lst["total"] == 1 and lst["by_category"] == {"burning_waste": 1}
    assert client.get("/api/reports?area=zzz").json["reports"] == []


def test_reports_invalid_and_rate_limited(client):
    assert post(client, "/api/reports", {"category": "x", "severity": 1, "area": "Rohini"}).status_code == 400
    good = {"category": "other", "severity": 1, "area": "Rohini"}
    codes = [post(client, "/api/reports", good).status_code for _ in range(11)]
    # the invalid request above also counts toward the limit of 10/hour
    assert codes[:9] == [201] * 9 and codes[9] == 429


def test_security_headers_and_cors(client):
    r = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert r.headers["X-Content-Type-Options"] == "nosniff" and r.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert "Access-Control-Allow-Origin" not in client.get("/api/health", headers={"Origin": "https://evil.example"}).headers
