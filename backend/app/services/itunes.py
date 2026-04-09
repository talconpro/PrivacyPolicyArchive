from __future__ import annotations

from typing import Any
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from app.services.http_resilience import get_with_retry

ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'
ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup'


async def search_software(term: str, country: str = 'cn', limit: int = 5) -> list[dict[str, Any]]:
    params = {
        'term': term,
        'country': country,
        'entity': 'software',
        'limit': max(1, min(limit, 20)),
    }
    resp = await get_with_retry(
        ITUNES_SEARCH_URL,
        params=params,
        country=country,
        timeout=15.0,
        max_attempts=4,
        referer='https://www.apple.com/',
    )
    payload = resp.json()
    results = payload.get('results', [])
    return results if isinstance(results, list) else []


def pick_best_match(results: list[dict[str, Any]], term: str) -> dict[str, Any] | None:
    if not results:
        return None

    needle = (term or '').strip().lower()
    if not needle:
        return results[0]

    for item in results:
        name = str(item.get('trackName') or '').strip().lower()
        if name == needle:
            return item

    for item in results:
        name = str(item.get('trackName') or '').strip().lower()
        if needle in name:
            return item

    return results[0]


async def lookup_software(track_id: int, country: str = 'cn') -> dict[str, Any] | None:
    params = {
        'id': track_id,
        'country': country,
        'entity': 'software',
    }
    resp = await get_with_retry(
        ITUNES_LOOKUP_URL,
        params=params,
        country=country,
        timeout=15.0,
        max_attempts=4,
        referer='https://www.apple.com/',
    )
    payload = resp.json()

    results = payload.get('results', [])
    if not isinstance(results, list) or not results:
        return None

    for item in results:
        if item.get('wrapperType') == 'software' and item.get('trackId') == track_id:
            return item
    for item in results:
        if item.get('trackId') == track_id:
            return item
    return results[0]


async def extract_privacy_policy_url(track_view_url: str | None, country: str = 'cn') -> str | None:
    if not track_view_url:
        return None

    resp = await get_with_retry(
        track_view_url,
        country=country,
        timeout=20.0,
        max_attempts=4,
        referer='https://apps.apple.com/',
    )

    soup = BeautifulSoup(resp.text, 'html.parser')
    keywords = ('\u9690\u79c1\u653f\u7b56', '\u9690\u79c1\u6743\u653f\u7b56', 'Privacy Policy')

    for a_tag in soup.find_all('a', href=True):
        text = ' '.join(a_tag.get_text(strip=True).split())
        href = str(a_tag.get('href') or '').strip()
        if not href:
            continue
        if any(keyword.lower() in text.lower() for keyword in keywords):
            return urljoin(track_view_url, href)

    return None
