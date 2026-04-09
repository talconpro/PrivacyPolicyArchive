import hashlib
import re
from io import BytesIO
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader

from app.core.errors import AppError
from app.services.http_resilience import get_with_retry


def hash_text(text: str) -> str:
    return hashlib.md5(text.encode('utf-8')).hexdigest()


def clean_text(input_text: str) -> str:
    return re.sub(r'\s+', ' ', input_text or '').strip()


def parse_pdf(content: bytes) -> str:
    reader = PdfReader(BytesIO(content))
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or '')
    return '\n'.join(parts)


def _guess_country(url: str) -> str:
    host = (urlparse(url).hostname or '').lower()
    if host.endswith('.jp'):
        return 'jp'
    if host.endswith('.hk'):
        return 'hk'
    if host.endswith('.com') or host.endswith('.us'):
        return 'us'
    return 'cn'


async def fetch_policy_text(url: str) -> dict:
    country = _guess_country(url)
    try:
        response = await get_with_retry(
            url,
            country=country,
            timeout=30.0,
            max_attempts=4,
            referer='https://www.apple.com/',
        )
    except httpx.HTTPStatusError as error:
        raise AppError(400, 'POLICY_FETCH_FAILED', f'\u6293\u53d6\u5931\u8d25\uff0c\u76ee\u6807\u5730\u5740\u8fd4\u56de {error.response.status_code}')
    except httpx.TimeoutException:
        raise AppError(400, 'POLICY_FETCH_TIMEOUT', '\u6293\u53d6\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u6216\u66f4\u6362\u94fe\u63a5')
    except Exception as error:
        raise AppError(400, 'POLICY_FETCH_FAILED', f'\u6293\u53d6\u5931\u8d25: {error}')

    content_type = response.headers.get('content-type', '')

    try:
        if 'pdf' in content_type.lower() or url.lower().endswith('.pdf'):
            text = parse_pdf(response.content)
        else:
            html = response.text
            soup = BeautifulSoup(html, 'html.parser')
            for tag in soup(['script', 'style', 'noscript']):
                tag.decompose()
            root = soup.find('main') or soup.find('article') or soup.body or soup
            text = root.get_text(separator=' ', strip=True)

        cleaned = clean_text(text)
        if not cleaned:
            raise ValueError('\u672a\u63d0\u53d6\u5230\u6709\u6548\u6b63\u6587')
    except Exception:
        raise AppError(400, 'POLICY_PARSE_FAILED', '\u6293\u53d6\u6210\u529f\u4f46\u6b63\u6587\u63d0\u53d6\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u9690\u79c1\u653f\u7b56\u9875\u9762\u7ed3\u6784')

    return {
        'text': cleaned,
        'contentHash': hash_text(cleaned),
        'length': len(cleaned),
    }
