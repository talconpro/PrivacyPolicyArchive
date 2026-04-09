import re


def sanitize_text(value: str | None, max_len: int = 2000) -> str:
    return (value or '').replace('<', '').replace('>', '').strip()[:max_len]


def sanitize_list(values: list[str] | None, max_len: int = 100) -> list[str]:
    arr = values or []
    out: list[str] = []
    for item in arr:
        cleaned = sanitize_text(item, max_len=max_len)
        if cleaned:
            out.append(cleaned)
    return out


def slugify_name(name: str) -> str:
    text = (name or '').strip().lower()
    text = re.sub(r'[^a-z0-9\u4e00-\u9fa5]+', '-', text)
    return text.strip('-') or 'app'
