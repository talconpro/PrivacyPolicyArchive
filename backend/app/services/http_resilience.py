from __future__ import annotations

import asyncio
import random
import time
from typing import Any

import httpx

# Small desktop/mobile UA pool to reduce fixed fingerprinting.
USER_AGENT_POOL = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
]

COUNTRY_LANG = {
    'cn': 'zh-CN,zh;q=0.9,en;q=0.8',
    'us': 'en-US,en;q=0.9',
    'jp': 'ja-JP,ja;q=0.9,en;q=0.8',
    'hk': 'zh-HK,zh;q=0.9,en;q=0.8',
}

RETRYABLE_STATUS_CODES = {403, 408, 409, 425, 429, 500, 502, 503, 504}

# Global pacing and concurrency limit for all outbound crawl traffic.
_REQUEST_SEMAPHORE = asyncio.Semaphore(3)
_PACE_LOCK = asyncio.Lock()
_LAST_REQUEST_AT = 0.0
_MIN_INTERVAL_SECONDS = 0.18


def build_headers(country: str = 'cn', referer: str | None = None) -> dict[str, str]:
    cc = (country or 'cn').lower()
    headers = {
        'User-Agent': random.choice(USER_AGENT_POOL),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
        'Accept-Language': COUNTRY_LANG.get(cc, COUNTRY_LANG['cn']),
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
    }
    if referer:
        headers['Referer'] = referer
    return headers


async def _pace() -> None:
    global _LAST_REQUEST_AT
    async with _PACE_LOCK:
        now = time.monotonic()
        wait_for = _MIN_INTERVAL_SECONDS - (now - _LAST_REQUEST_AT)
        if wait_for > 0:
            await asyncio.sleep(wait_for + random.uniform(0.03, 0.16))
        _LAST_REQUEST_AT = time.monotonic()


async def _backoff(attempt: int) -> None:
    # 0.4, 0.8, 1.6 ... with small jitter.
    delay = min(6.0, 0.4 * (2 ** max(0, attempt - 1)))
    await asyncio.sleep(delay + random.uniform(0.08, 0.45))


async def get_with_retry(
    url: str,
    *,
    params: dict[str, Any] | None = None,
    country: str = 'cn',
    timeout: float = 20.0,
    max_attempts: int = 4,
    referer: str | None = None,
) -> httpx.Response:
    last_error: Exception | None = None
    attempts = max(1, max_attempts)

    for attempt in range(1, attempts + 1):
        await _pace()
        headers = build_headers(country=country, referer=referer)
        try:
            async with _REQUEST_SEMAPHORE:
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as error:
            last_error = error
            status_code = error.response.status_code
            if status_code not in RETRYABLE_STATUS_CODES or attempt >= attempts:
                raise
            await _backoff(attempt)
        except (httpx.TimeoutException, httpx.RequestError) as error:
            last_error = error
            if attempt >= attempts:
                raise
            await _backoff(attempt)

    if last_error:
        raise last_error
    raise RuntimeError('get_with_retry failed without explicit error')
