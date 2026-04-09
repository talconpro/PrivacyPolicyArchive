from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details=None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


def error_payload(code: str, message: str, details=None):
    payload = {'code': code, 'message': message}
    if details is not None:
        payload['details'] = details
    return payload


async def app_error_handler(_: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content=error_payload(exc.code, exc.message, exc.details))


async def validation_error_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=error_payload('VALIDATION_ERROR', '请求参数校验失败', exc.errors()),
    )


async def generic_error_handler(_: Request, exc: Exception):
    return JSONResponse(status_code=500, content=error_payload('INTERNAL_ERROR', '服务端处理失败', {'error': str(exc)}))
