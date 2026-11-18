"""Shared exception types and JSON error responses."""
from typing import Any
from flask import Flask, Response, jsonify


class ApiError(Exception):
    """An error that maps to a clear, user-facing JSON response.

    Attributes:
        message (str): Human-readable error description.
        status (int): HTTP status code.
        details (dict): Structured field-level error mapping.
    """

    def __init__(self, message: str, status: int = 400, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.details = details or {}


class ValidationError(ApiError):
    """Input failed validation. `details` maps field path -> error message."""

    def __init__(self, details: dict[str, Any]) -> None:
        super().__init__("Some inputs need attention.", 400, details)


def register_error_handlers(app: Flask) -> None:
    """Register application-wide JSON error handlers on the Flask app.

    Args:
        app: Flask application instance.
    """
    @app.errorhandler(ApiError)
    def _api_error(err: ApiError) -> tuple[Response, int]:
        resp = jsonify({"error": err.message, "details": err.details})
        if err.status == 429 and "retry_after" in err.details:
            resp.headers["Retry-After"] = str(err.details["retry_after"])
        return resp, err.status

    @app.errorhandler(413)
    def _too_large(_: Any) -> tuple[Response, int]:
        limit = app.config.get("UPLOAD_LIMIT_MB", 5)
        return jsonify({"error": f"File is too large. The limit is {limit} MB.", "details": {}}), 413

    @app.errorhandler(404)
    def _not_found(_: Any) -> tuple[Response, int]:
        return jsonify({"error": "That endpoint does not exist.", "details": {}}), 404

    @app.errorhandler(405)
    def _bad_method(_: Any) -> tuple[Response, int]:
        return jsonify({"error": "That method is not allowed here.", "details": {}}), 405

    @app.errorhandler(Exception)
    def _unexpected(err: Exception) -> tuple[Response, int]:
        app.logger.exception("Unhandled error: %s", err)
        return jsonify({"error": "Something went wrong on our side. Please try again.", "details": {}}), 500
