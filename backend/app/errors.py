"""Shared exception types and JSON error responses."""
from flask import jsonify


class ApiError(Exception):
    """An error that maps to a clear, user-facing JSON response."""

    def __init__(self, message: str, status: int = 400, details: dict | None = None):
        super().__init__(message)
        self.message, self.status, self.details = message, status, details or {}


class ValidationError(ApiError):
    """Input failed validation. `details` maps field path -> message."""

    def __init__(self, details: dict):
        super().__init__("Some inputs need attention.", 400, details)


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def _api_error(err):
        return jsonify({"error": err.message, "details": err.details}), err.status

    @app.errorhandler(413)
    def _too_large(_):
        limit = app.config["UPLOAD_LIMIT_MB"]
        return jsonify({"error": f"File is too large. The limit is {limit} MB.", "details": {}}), 413

    @app.errorhandler(404)
    def _not_found(_):
        return jsonify({"error": "That endpoint does not exist.", "details": {}}), 404

    @app.errorhandler(405)
    def _bad_method(_):
        return jsonify({"error": "That method is not allowed here.", "details": {}}), 405

    @app.errorhandler(Exception)
    def _unexpected(err):
        app.logger.exception("Unhandled error: %s", err)
        return jsonify({"error": "Something went wrong on our side. Please try again.", "details": {}}), 500
