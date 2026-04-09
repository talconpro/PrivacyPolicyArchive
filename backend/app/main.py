#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
--------------------------------------
    Author:     JiChao_Song
    Date  :     2026-04-08 20:07
    Name  :     main.py
    Desc  :
--------------------------------------
"""
from __future__ import annotations

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import settings
from app.core.errors import AppError, app_error_handler, generic_error_handler, validation_error_handler
from app.services.appstore_batch import start_appstore_batch_worker, stop_appstore_batch_worker


@asynccontextmanager
async def lifespan(_: FastAPI):
    start_appstore_batch_worker()
    try:
        yield
    finally:
        await stop_appstore_batch_worker()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, generic_error_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/ready')
def ready():
    return {'status': 'ok'}


app.include_router(api_router)


if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8000)
