"""HTTP routes. Thin layer: validate input, call services, return JSON."""
from flask import Blueprint, current_app, jsonify, request

from ..errors import ApiError, ValidationError
from ..services import air_quality, assistant, decision_engine, haze_analyzer, impact, reports, sample_data
from ..services.rate_limit import rate_limit
from .. import validation as v

bp = Blueprint("api", __name__, url_prefix="/api")


def _json_body() -> dict:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("Send a JSON object in the request body.", 400)
    return data


def _air_for(lat: float, lon: float, demo: bool) -> dict:
    """Real data by default. Sample data only when the user explicitly asked (demo=True)."""
    if demo:
        return sample_data.build_sample(lat, lon)
    cfg = current_app.config
    return air_quality.fetch_air_quality(lat, lon, cfg["AIR_CACHE_TTL_S"], cfg["UPSTREAM_TIMEOUT_S"])


@bp.get("/health")
def health():
    return jsonify({"status": "ok", "gemini_configured": bool(current_app.config["GEMINI_API_KEY"])})


@bp.get("/geocode")
def geocode():
    q = v.clean_text(request.args.get("q", ""), 80)
    if len(q) < 2:
        raise ValidationError({"q": "Enter at least 2 characters of a place name."})
    return jsonify({"results": air_quality.search_places(q, current_app.config["UPSTREAM_TIMEOUT_S"])})


@bp.get("/air-quality")
def air():
    raw_lat = request.args.get("latitude") if request.args.get("latitude") is not None else request.args.get("lat")
    raw_lon = request.args.get("longitude") if request.args.get("longitude") is not None else request.args.get("lon")
    lat, lon = v.validate_coordinates(*(_num(raw_lat), _num(raw_lon)))
    data = _air_for(lat, lon, request.args.get("demo") == "1")
    return jsonify({**data, "trend": decision_engine.compute_trend(data)})


@bp.get("/forecast")
def forecast():
    raw_lat = request.args.get("latitude") if request.args.get("latitude") is not None else request.args.get("lat")
    raw_lon = request.args.get("longitude") if request.args.get("longitude") is not None else request.args.get("lon")
    lat, lon = v.validate_coordinates(*(_num(raw_lat), _num(raw_lon)))
    data = _air_for(lat, lon, request.args.get("demo") == "1")
    hours = decision_engine.future_hours(data, 48)
    return jsonify({
        "location": data["location"],
        "hourly": hours,
        "best_window": decision_engine.best_window(hours),
        "worst_window": decision_engine.best_window(hours, worst=True),
        "trend": decision_engine.compute_trend(data),
    })


def _num(raw):
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


@bp.post("/plan")
def plan():
    body = _json_body()
    profile = v.validate_profile(body.get("profile"))
    loc = profile["location"]
    data = _air_for(loc["latitude"], loc["longitude"], body.get("demo") is True)
    return jsonify(decision_engine.build_plan(profile, data))


@bp.post("/recommendations")
def recommendations():
    body = _json_body()
    profile = v.validate_profile(body.get("profile"))
    loc = profile["location"]
    data = _air_for(loc["latitude"], loc["longitude"], body.get("demo") is True)
    full_plan = decision_engine.build_plan(profile, data)
    all_recs = (
        full_plan["top_actions"]
        + full_plan["planner"]["recommendations"]
        + full_plan["indoor"]["recommendations"]
        + full_plan["alternatives"]
    )
    seen = set()
    deduped = []
    for r in all_recs:
        if r["title"] not in seen:
            seen.add(r["title"])
            deduped.append(r)
    return jsonify({
        "recommendations": deduped,
        "risk_level": full_plan["risk"],
        "us_aqi": full_plan["air"]["current"]["us_aqi"],
        "headline": full_plan["headline"]
    })


@bp.post("/assistant")
@bp.post("/assistant/chat")
@rate_limit("assistant", 20, 3600)
def assistant_route():
    body = _json_body()
    profile = v.validate_profile(body.get("profile"))
    question = v.validate_question(body)
    loc = profile["location"]
    plan_ = decision_engine.build_plan(profile, _air_for(loc["latitude"], loc["longitude"], body.get("demo") is True))
    cfg = current_app.config
    return jsonify(assistant.answer(question, plan_, cfg["GEMINI_API_KEY"], cfg["GEMINI_MODEL"]))


@bp.post("/haze/analyze")
@bp.post("/vision/analyze")
@rate_limit("haze", 30, 3600)
def haze():
    file = request.files.get("image")
    if file is None or not file.filename:
        raise ApiError("Choose an image to upload.", 400, {"image": "No file received."})
    try:
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in haze_analyzer.ALLOWED_EXTENSIONS:
            raise ApiError("Only JPG, PNG or WebP images are accepted.", 415, {"image": "Unsupported file type."})
        data = file.read(current_app.config["MAX_CONTENT_LENGTH"] + 1)  # processed in memory, never saved to disk
        if len(data) > current_app.config["MAX_CONTENT_LENGTH"]:
            raise ApiError(f"File is too large. The limit is {current_app.config['UPLOAD_LIMIT_MB']} MB.", 413)
        return jsonify(haze_analyzer.analyze_image(data))
    finally:
        try:
            file.close()
        except Exception:
            pass


@bp.post("/impact")
@bp.post("/impact/calculate")
def impact_route():
    body = _json_body()
    clean = v.validate_impact(body)
    air_data = None
    if clean["exposure"] is not None:
        loc = clean["exposure"]["location"]
        air_data = _air_for(loc["latitude"], loc["longitude"], body.get("demo") is True)
    return jsonify(impact.calculate(clean, air_data))


@bp.get("/reports")
@bp.get("/community/reports")
def reports_list():
    return jsonify(reports.list_reports(request.args.get("area", "")))


@bp.post("/reports")
@bp.post("/community/reports")
@rate_limit("reports", 10, 3600)
def reports_create():
    return jsonify(reports.add_report(v.validate_report(_json_body()))), 201
