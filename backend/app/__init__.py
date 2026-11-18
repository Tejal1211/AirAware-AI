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
        if request.headers.get("Origin") in app.config["ALLOWED_ORIGINS"]:
            origin = request.headers["Origin"]
        if origin:
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
            resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            resp.headers["Vary"] = "Origin"
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["Referrer-Policy"] = "no-referrer"
        if request.path.startswith("/api"):
            resp.headers["Cache-Control"] = "no-store"
        else:
            resp.headers.setdefault("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'")
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
