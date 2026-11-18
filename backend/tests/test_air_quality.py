import pytest
import requests

from app.services import air_quality as aq


class FakeResp:
    def __init__(self, payload, fail=False):
        self.payload, self.fail = payload, fail

    def raise_for_status(self):
        if self.fail:
            raise requests.HTTPError("boom")

    def json(self):
        if self.payload is ValueError:
            raise ValueError("bad json")
        return self.payload


class FakeHttp:
    def __init__(self, payload, fail=False):
        self.payload, self.fail, self.calls = payload, fail, 0

    def get(self, url, params=None, timeout=None):
        self.calls += 1
        if self.fail == "network":
            raise requests.ConnectionError("down")
        return FakeResp(self.payload, self.fail is True)


def raw_payload(n=96):
    times = [f"2026-11-{17 + i // 24:02d}T{i % 24:02d}:00" for i in range(n)]
    return {"current": {"time": "2026-11-18T08:00", "us_aqi": 160, "pm2_5": 70.0, "pm10": None, "ozone": 30, "nitrogen_dioxide": None},
            "current_units": {"pm2_5": "μg/m³"},
            "hourly": {"time": times, "us_aqi": [100 + i for i in range(n)], "pm2_5": [40.0] * n, "pm10": [None] * n}}


def test_normalize_trims_and_computes():
    out = aq.normalize(raw_payload(), 28.6, 77.2)
    assert out["hourly"][out["now_index"]]["time"] == "2026-11-18T08:00"
    assert out["current"]["us_aqi"] == 160 and out["current"]["category_key"] == "unhealthy"
    assert out["current"]["who_pm25_multiple"] == 4.7 and out["source"]["is_sample"] is False
    assert len(out["hourly"]) <= 73


def test_missing_values_do_not_crash():
    out = aq.normalize(raw_payload(), 1, 2)
    assert out["current"]["pm10"] is None and out["current"]["nitrogen_dioxide"] is None


def test_empty_hourly_is_an_error():
    with pytest.raises(aq.AirDataError):
        aq.normalize({"current": {}, "hourly": {"time": []}}, 1, 2)


def test_fetch_caches_requests():
    http = FakeHttp(raw_payload())
    a = aq.fetch_air_quality(28.61, 77.21, http=http)
    b = aq.fetch_air_quality(28.61, 77.21, http=http)
    assert a is b and http.calls == 1


@pytest.mark.parametrize("mode", [True, "network"])
def test_upstream_failures_raise_clear_error(mode):
    with pytest.raises(aq.AirDataError) as exc:
        aq.fetch_air_quality(1.0, 2.0, http=FakeHttp(raw_payload(), fail=mode))
    assert exc.value.status == 502 and "unavailable" in exc.value.message


def test_bad_json_raises():
    with pytest.raises(aq.AirDataError):
        aq.fetch_air_quality(3.0, 4.0, http=FakeHttp(ValueError))


def test_geocode_parsing():
    http = FakeHttp({"results": [{"name": "Delhi", "admin1": "Delhi", "country": "India", "latitude": 28.6519, "longitude": 77.2315}, {"name": "bad"}]})
    res = aq.search_places("Delhi", http=http)
    assert res == [{"name": "Delhi, Delhi, India", "latitude": 28.65, "longitude": 77.23}]
