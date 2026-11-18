"""HTTP routes. Thin layer: validate input, call services, return JSON."""
from typing import Any
from flask import Blueprint, Response, current_app, jsonify, request
from werkzeug.utils import secure_filename

from ..errors import ApiError, ValidationError
from ..services import air_quality, assistant, decision_engine, haze_analyzer, impact, reports, sample_data
from ..services.rate_limit import rate_limit
from .. import validation as v

bp = Blueprint("api", __name__, url_prefix="/api")


def _num(raw: Any) -> float | None:
    """Safely convert raw query parameter to float or return None.

    Args:
        raw: Raw string, integer, or float representation.

    Returns:
        float if conversion succeeds, None otherwise.
    """
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _json_body() -> dict[str, Any]:
    """Extract and validate that the request body is a JSON object.

    Returns:
        dict: Parsed JSON dictionary.

    Raises:
        ApiError: If request body is missing or not a valid JSON object.
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("Send a JSON object in the request body.", 400)
    return data


def _air_for(lat: float, lon: float, demo: bool) -> dict[str, Any]:
    """Retrieve air quality data: live Open-Meteo by default, sample data only when requested.

    Args:
        lat: Latitude in decimal degrees [-90, 90].
        lon: Longitude in decimal degrees [-180, 180].
        demo: Flag indicating whether to use labelled simulated sample data.

    Returns:
        dict: Normalized air quality data structure.
    """
    if demo:
        return sample_data.build_sample(lat, lon)
    cfg = current_app.config
    return air_quality.fetch_air_quality(lat, lon, cfg["AIR_CACHE_TTL_S"], cfg["UPSTREAM_TIMEOUT_S"])


@bp.get("/health")
def health() -> Response:
    """Return backend health status and Gemini AI configuration state.

    Returns:
        JSON response with system health and AI readiness flags.
    """
    return jsonify({"status": "ok", "gemini_configured": bool(current_app.config["GEMINI_API_KEY"])})


@bp.get("/geocode")
def geocode() -> Response:
    """Search geographical coordinates for a city or area name.

    Query Args:
        q (str): City or place query string (minimum 2 characters).

    Returns:
        JSON response with list of matched locations (name, lat, lon).

    Raises:
        ValidationError: If query parameter is shorter than 2 characters.
    """
    q = v.clean_text(request.args.get("q", ""), 80)
    if len(q) < 2:
        raise ValidationError({"q": "Enter at least 2 characters of a place name."})
    return jsonify({"results": air_quality.search_places(q, current_app.config["UPSTREAM_TIMEOUT_S"])})


@bp.get("/air-quality")
def air() -> Response:
    """Retrieve multi-pollutant concentrations, AQI, and atmospheric trend.

    Query Args:
        lat/latitude (float): Latitude coordinate.
        lon/longitude (float): Longitude coordinate.
        demo (str, optional): '1' to preview with labelled sample data.

    Returns:
        JSON response with current pollutants, AQI category, and trend.
    """
    raw_lat = request.args.get("latitude") if request.args.get("latitude") is not None else request.args.get("lat")
    raw_lon = request.args.get("longitude") if request.args.get("longitude") is not None else request.args.get("lon")
    lat, lon = v.validate_coordinates(*(_num(raw_lat), _num(raw_lon)))
    data = _air_for(lat, lon, request.args.get("demo") == "1")
    return jsonify({**data, "trend": decision_engine.compute_trend(data)})


@bp.get("/forecast")
def forecast() -> Response:
    """Retrieve 48-72 hour hourly air quality forecast series and optimal windows.

    Query Args:
        lat/latitude (float): Latitude coordinate.
        lon/longitude (float): Longitude coordinate.
        demo (str, optional): '1' for sample data.

    Returns:
        JSON response with hourly array, cleanest window, and worst window.
    """
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


@bp.post("/plan")
def plan() -> Response:
    """Generate a comprehensive, personalized air quality safety and daily routine plan.

    Request Body:
        profile (dict): Household profile including location, members, commute, indoor factors.
        demo (bool, optional): Whether to use demo data.

    Returns:
        JSON response with complete plan, daily schedule, alerts, and recommendations.
    """
    body = _json_body()
    profile = v.validate_profile(body.get("profile"))
    loc = profile["location"]
    data = _air_for(loc["latitude"], loc["longitude"], body.get("demo") is True)
    return jsonify(decision_engine.build_plan(profile, data))


@bp.post("/recommendations")
def recommendations() -> Response:
    """Generate structured, prioritized decision-engine recommendations.

    Request Body:
        profile (dict): Household profile.
        demo (bool, optional): Whether to use demo data.

    Returns:
        JSON response with prioritized recommendation objects and risk level.
    """
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
def assistant_route() -> Response:
    """Process natural-language air quality inquiry using Gemini AI or rule engine.

    Request Body:
        question (str): User inquiry string.
        profile (dict): Household context profile.
        demo (bool, optional): Whether to use demo data.

    Returns:
        JSON response with assistant answer, attribution source, and supporting facts.
    """
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
def haze() -> Response:
    """Perform OpenCV visual clarity and dark-channel prior analysis on an uploaded image.

    Multipart Form Data:
        image (file): JPG, PNG, or WebP photo (max 5 MB).

    Returns:
        JSON response with visual clarity score, contrast, edge sharpness, and dark channel.

    Raises:
        ApiError: If no file uploaded (400), invalid type (415), or file exceeds limit (413).
    """
    file = request.files.get("image")
    if file is None or not file.filename:
        raise ApiError("Choose an image to upload.", 400, {"image": "No file received."})
    try:
        clean_name = secure_filename(file.filename)
        ext = clean_name.rsplit(".", 1)[-1].lower() if "." in clean_name else ""
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
def impact_route() -> Response:
    """Calculate carbon emission reductions and personal exposure reductions separately.

    Request Body:
        emissions (dict, optional): Mode shift details (from_mode, to_mode, km, days).
        exposure (dict, optional): Exposure intervention details (hours, purifier, window).

    Returns:
        JSON response with emission savings (kg CO2e) and exposure index comparison.
    """
    body = _json_body()
    clean = v.validate_impact(body)
    air_data = None
    if clean["exposure"] is not None:
        loc = clean["exposure"]["location"]
        air_data = _air_for(loc["latitude"], loc["longitude"], body.get("demo") is True)
    return jsonify(impact.calculate(clean, air_data))


@bp.get("/reports")
@bp.get("/community/reports")
def reports_list() -> Response:
    """List anonymized community pollution and haze reports.

    Query Args:
        area (str, optional): Neighborhood or area filter.

    Returns:
        JSON response with list of reports and category breakdown.
    """
    return jsonify(reports.list_reports(request.args.get("area", "")))


@bp.post("/reports")
@bp.post("/community/reports")
@rate_limit("reports", 10, 3600)
def reports_create() -> tuple[Response, int]:
    """Submit an anonymous, sanitized community pollution observation.

    Request Body:
        category (str): Pollution category (e.g. burning_waste, industrial, dust).
        severity (int): Severity ranking (1-5).
        area (str): Neighborhood or locality name.
        note (str, optional): Additional context note.

    Returns:
        Tuple of JSON response and HTTP 201 status code.
    """
    return jsonify(reports.add_report(v.validate_report(_json_body()))), 201
