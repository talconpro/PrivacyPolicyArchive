from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import clear_admin_cookie, create_admin_token, get_admin_user, set_admin_cookie

router = APIRouter(prefix='/auth', tags=['auth'])


class LoginInput(BaseModel):
    username: str
    password: str


@router.post('/login')
def login(payload: LoginInput, response: Response):
    if payload.username != settings.admin_username or payload.password != settings.admin_password:
        raise AppError(401, 'INVALID_CREDENTIALS', '用户名或密码错误')

    token = create_admin_token(payload.username)
    set_admin_cookie(response, token)
    return {'ok': True, 'username': payload.username}


@router.post('/logout')
def logout(response: Response):
    clear_admin_cookie(response)
    return {'ok': True}


@router.get('/me')
def me(request: Request):
    return {'user': get_admin_user(request)}
