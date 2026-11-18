"""OpenCV visual-clarity analysis.

IMPORTANT: this measures how clear the *photo* looks (contrast, edge sharpness, dark-channel haze cue,
colour saturation). It does NOT measure AQI or PM2.5. Fog, night, indoor scenes, lens blur and filters
all change the result.
"""
from typing import Any
import base64
import os

os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS", str(30_000_000))  # guard against decompression bombs

try:
    import cv2
    import numpy as np
    CV2_AVAILABLE: bool = True
    _CV2_ERROR: str | None = None
except Exception as _e:
    cv2 = None
    np = None
    CV2_AVAILABLE = False
    _CV2_ERROR = str(_e)

from ..errors import ApiError

ALLOWED_EXTENSIONS: set[str] = {"jpg", "jpeg", "png", "webp"}
MAX_SIDE: int = 640
DISCLAIMER: str = (
    "This is a visual clarity estimate from one photo. It does not measure AQI or PM2.5. "
    "Fog, lighting, time of day, lens quality and filters all affect it."
)


def has_valid_signature(data: bytes) -> bool:
    """Check magic bytes so a renamed file cannot slip through on extension alone.

    Args:
        data: Binary image payload.

    Returns:
        bool: True if signature matches JPG, PNG, or WebP.
    """
    return (
        data[:3] == b"\xff\xd8\xff"
        or data[:8] == b"\x89PNG\r\n\x1a\n"
        or (data[:4] == b"RIFF" and data[8:12] == b"WEBP")
    )


def _clip01(x: float) -> float:
    """Clamp a floating point number to the [0.0, 1.0] range.

    Args:
        x: Raw floating point number.

    Returns:
        float: Clamped value between 0.0 and 1.0.
    """
    return float(min(1.0, max(0.0, x)))


def _decode(data: bytes) -> Any:
    """Validate and decode uploaded image bytes into a resized BGR image matrix.

    Args:
        data: Raw binary image payload.

    Returns:
        numpy.ndarray: Decoded and scaled OpenCV image matrix.

    Raises:
        ApiError: If OpenCV is unavailable (503), invalid magic bytes (415),
                 unreadable/corrupt image (422), or image is too small (422).
    """
    if not CV2_AVAILABLE:
        raise ApiError(f"OpenCV image processing is unavailable ({_CV2_ERROR}). Please run: pip install 'numpy<2'", 503)
    if not has_valid_signature(data):
        raise ApiError("Upload a JPG, PNG or WebP photo.", 415)
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ApiError("That image could not be read. Try another photo.", 422)
    h, w = img.shape[:2]
    if min(h, w) < 32:
        raise ApiError("The image is too small to analyse (minimum 32 px).", 422)
    if max(h, w) > MAX_SIDE:
        scale = MAX_SIDE / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def analyze_image(data: bytes) -> dict[str, Any]:
    """Calculate visual clarity metrics, score, findings, and dark-channel preview.

    Args:
        data: Raw binary image payload.

    Returns:
        dict: Analysis results containing clarity_score, tone, metrics, and base64 preview.

    Raises:
        ApiError: On format, decoding, or sizing failures.
    """
    img = _decode(data)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    contrast = float(gray.std())                                     # RMS contrast, 0-~128
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())         # edge detail
    dark = cv2.erode(img.min(axis=2), cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15)))
    dark_mean = float(dark.mean()) / 255                              # high = hazy cue (He et al. dark channel prior)
    saturation = float(cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[..., 1].mean()) / 255
    mean_brightness = float(gray.mean()) / 255

    parts = {
        "contrast": _clip01(contrast / 60),
        "sharpness": _clip01(np.log1p(sharpness) / np.log1p(600)),
        "dark_channel": 1 - _clip01(dark_mean / 0.55),
        "saturation": _clip01(saturation / 0.35),
    }
    score = round(100 * (0.30 * parts["contrast"] + 0.25 * parts["sharpness"] + 0.30 * parts["dark_channel"] + 0.15 * parts["saturation"]))
    if score >= 65:
        label, tone = "High visual clarity", "good"
        text = "The photo shows strong contrast and crisp distant detail, which is typical of clear conditions."
    elif score >= 40:
        label, tone = "Moderate visual clarity", "caution"
        text = "The photo shows some loss of contrast or detail. This can come from light haze, but also from lighting or camera settings."
    else:
        label, tone = "Low visual clarity (hazy-looking)", "avoid"
        text = "The photo looks washed out with low contrast. That is consistent with haze or fog, but it cannot tell you the pollution level."
    notes = []
    if mean_brightness < 0.2:
        notes.append("The photo is very dark, so the result is less reliable. Try daylight.")
    if sharpness < 20:
        notes.append("The photo looks blurry, which lowers the score regardless of haze.")
    prev = cv2.resize(dark, (min(240, dark.shape[1]), max(1, int(dark.shape[0] * min(240, dark.shape[1]) / dark.shape[1]))), interpolation=cv2.INTER_AREA)
    ok, png = cv2.imencode(".png", cv2.applyColorMap(prev, cv2.COLORMAP_VIRIDIS))
    return {
        "clarity_score": score,
        "label": label,
        "tone": tone,
        "summary": text,
        "notes": notes,
        "metrics": {
            "contrast_rms": round(contrast, 1),
            "edge_sharpness": round(sharpness, 1),
            "dark_channel_mean": round(dark_mean, 3),
            "saturation_mean": round(saturation, 3),
            "brightness_mean": round(mean_brightness, 3)
        },
        "component_scores": {k: round(v, 2) for k, v in parts.items()},
        "dark_channel_preview": "data:image/png;base64," + base64.b64encode(png.tobytes()).decode() if ok else None,
        "analyzed_size": {"width": int(img.shape[1]), "height": int(img.shape[0])},
        "disclaimer": DISCLAIMER,
    }
