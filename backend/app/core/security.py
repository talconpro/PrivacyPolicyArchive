from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Request, Response

from app.core.config import settings
from app.core.errors import AppError

COOKIE_NAME = 'ppa_admin_session'
ALGORITHM = 'HS256'


def create_admin_token(username: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        'sub': username,
        'iat': int(now.timestamp()),
        'exp': int((now + timedelta(seconds=settings.jwt_expire_seconds)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_admin_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except Exception:
        return None


def set_admin_cookie(response: Response, token: str):
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite='lax',
        secure=(settings.app_env == 'production'),
        path='/',
        max_age=settings.jwt_expire_seconds,
    )


def clear_admin_cookie(response: Response):
    response.delete_cookie(COOKIE_NAME, path='/')


def get_admin_user(request: Request) -> dict | None:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        payload = decode_admin_token(token)
        if payload and payload.get('sub'):
            return {'username': payload['sub']}

    auth = request.headers.get('authorization', '')
    if auth.lower().startswith('bearer '):
        bearer = auth[7:].strip()
        if bearer == settings.admin_token:
            return {'username': settings.admin_username}

    return None


def require_admin(request: Request) -> dict:
    user = get_admin_user(request)
    if not user:
        raise AppError(401, 'UNAUTHORIZED', 'Unauthorized')
    return user
