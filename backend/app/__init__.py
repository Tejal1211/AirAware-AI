"""AirAware AI backend application factory."""
import os

from flask import Flask, abort, jsonify, request, send_from_directory

from .config import Config
from .errors import register_error_handlers
from .routes.api import bp as api_bp

DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))


def create_app(overrides: dict | None = None) -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)
    app.config.update(overrides or {})
    register_error_handlers(app)
    app.register_blueprint(api_bp)

    @app.after_request
    def _security_headers(resp):
        origin = None
        req_origin = request.headers.get("Origin")
        if req_origin and req_origin in app.config.get("ALLOWED_ORIGINS", []):
            origin = req_origin
        if origin:
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            resp.headers["Access-Control-Max-Age"] = "86400"
            resp.headers["Vary"] = "Origin"

        # Comprehensive OWASP & Industry-Standard Security Headers
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["X-XSS-Protection"] = "1; mode=block"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        resp.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        resp.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        resp.headers["Permissions-Policy"] = "accelerometer=(), camera=(), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
        resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        if request.path.startswith("/api"):
            resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            resp.headers["Pragma"] = "no-cache"
            resp.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        else:
            resp.headers.setdefault(
                "Content-Security-Policy",
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com; frame-ancestors 'none'"
            )
        return resp

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def spa(path):
        """Serve the built frontend if present (single-process deployment)."""
        if path.startswith("api/"):
            abort(404)
        if os.path.isdir(DIST):
            target = os.path.join(DIST, path)
            if path and os.path.isfile(target) and os.path.abspath(target).startswith(DIST):
                return send_from_directory(DIST, path)
            return send_from_directory(DIST, "index.html")
        return jsonify({"message": "AirAware AI API is running. Start the frontend with `npm run dev`."})

    return app
