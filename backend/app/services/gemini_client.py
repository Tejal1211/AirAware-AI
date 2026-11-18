"""Minimal Gemini REST client (uses `requests`; no heavy SDK). The key is sent in a header, never in logs."""
import requests

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class GeminiError(Exception):
    """Gemini could not produce a usable answer."""


def generate(prompt: str, system: str, api_key: str, model: str, timeout: int = 15, http=None) -> str:
    if not api_key:
        raise GeminiError("no_api_key")
    body = {"systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 700}}
    try:
        resp = (http or requests).post(ENDPOINT.format(model=model), json=body, timeout=timeout,
                                       headers={"x-goog-api-key": api_key, "Content-Type": "application/json"})
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        raise GeminiError("request_failed") from exc
    try:
        text = "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"]).strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise GeminiError("empty_or_blocked_response") from exc
    if not text:
        raise GeminiError("empty_or_blocked_response")
    return text
