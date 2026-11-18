import cv2
import numpy as np
import pytest

from app.errors import ApiError
from app.services import haze_analyzer as hz


def test_clear_scores_higher_than_hazy(clear_image, hazy_image):
    clear, hazy = hz.analyze_image(clear_image), hz.analyze_image(hazy_image)
    assert clear["clarity_score"] > hazy["clarity_score"] + 25
    assert hazy["tone"] == "avoid" and clear["tone"] == "good"


def test_result_shape_and_disclaimer_never_claims_aqi(clear_image):
    r = hz.analyze_image(clear_image)
    assert {"contrast_rms", "edge_sharpness", "dark_channel_mean", "saturation_mean"} <= set(r["metrics"])
    assert 0 <= r["clarity_score"] <= 100
    assert "does not measure AQI or PM2.5" in r["disclaimer"]
    assert r["dark_channel_preview"].startswith("data:image/png;base64,")
    assert "aqi" not in r["label"].lower() and "pm2.5" not in r["summary"].lower().replace("cannot tell you the pollution level", "")


def test_large_images_are_downscaled():
    big = cv2.imencode(".png", np.random.default_rng(0).integers(0, 255, (1500, 2000, 3), dtype=np.uint8))[1].tobytes()
    r = hz.analyze_image(big)
    assert max(r["analyzed_size"].values()) == hz.MAX_SIDE


def test_dark_image_adds_note():
    dark = cv2.imencode(".png", np.full((100, 100, 3), 5, np.uint8))[1].tobytes()
    assert any("dark" in n for n in hz.analyze_image(dark)["notes"])


@pytest.mark.parametrize("payload,status", [(b"not an image at all", 415), (b"", 415), (b"\x89PNG\r\n\x1a\ncorrupt", 422)])
def test_invalid_files_rejected(payload, status):
    with pytest.raises(ApiError) as exc:
        hz.analyze_image(payload)
    assert exc.value.status == status


def test_tiny_image_rejected():
    tiny = cv2.imencode(".png", np.zeros((10, 10, 3), np.uint8))[1].tobytes()
    with pytest.raises(ApiError):
        hz.analyze_image(tiny)


def test_signature_check():
    assert hz.has_valid_signature(b"\xff\xd8\xff\xe0abc") and not hz.has_valid_signature(b"GIF89a....")
