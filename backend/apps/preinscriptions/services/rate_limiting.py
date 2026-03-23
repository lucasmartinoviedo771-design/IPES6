import logging
import requests
from django.conf import settings
from django.core.cache import cache
from ninja.errors import HttpError

logger = logging.getLogger(__name__)


def client_ip(request) -> str:
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0].strip()
        if ip:
            return ip
    return request.META.get("REMOTE_ADDR", "") or ""


def check_rate_limit(request) -> None:
    limit = getattr(settings, "PREINS_RATE_LIMIT_PER_HOUR", 0)
    if not limit:
        return
    ip = client_ip(request) or "unknown"
    cache_key = f"preins:rate:{ip}"
    added = cache.add(cache_key, 1, timeout=3600)
    if added:
        return
    try:
        count = cache.incr(cache_key)
    except ValueError:
        cache.set(cache_key, 1, timeout=3600)
        count = 1
    if count > limit:
        raise HttpError(
            429,
            "Demasiadas preinscripciones desde tu red. Intentá nuevamente más tarde.",
        )


def verify_recaptcha(token: str | None, remote_ip: str) -> bool:
    secret = getattr(settings, "RECAPTCHA_SECRET_KEY", "")
    if not secret:
        return True
    if not token:
        return False
    try:
        response = requests.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={
                "secret": secret,
                "response": token,
                "remoteip": remote_ip,
            },
            timeout=5,
        )
        data = response.json()
    except requests.RequestException as exc:
        logger.warning("No se pudo verificar reCAPTCHA: %s", exc)
        return False
    if not data.get("success"):
        logger.info("reCAPTCHA rechazado: %s", data)
        return False
    score = data.get("score")
    min_score = getattr(settings, "RECAPTCHA_MIN_SCORE", 0.3)
    if score is not None and score < min_score:
        logger.info("reCAPTCHA score bajo (%s)", score)
        return False
    return True
