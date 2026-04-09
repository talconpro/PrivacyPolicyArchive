import hashlib

import httpx

from app.core.config import settings
from app.core.errors import AppError


async def verify_captcha(token: str | None):
    if not settings.turnstile_secret or not token:
        return

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            data={'secret': settings.turnstile_secret, 'response': token},
        )

    if not response.json().get('success'):
        raise AppError(400, 'CAPTCHA_FAILED', '验证码校验失败')


def hash_ip(ip: str) -> str:
    return hashlib.sha256((ip or '0.0.0.0').encode('utf-8')).hexdigest()
