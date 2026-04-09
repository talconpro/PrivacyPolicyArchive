"""Fetch iOS app trackId and privacy policy URL by app name.

Usage:
  python scripts/fetch_ios_privacy_url.py "支付宝" --country cn --limit 5
"""

from __future__ import annotations

import argparse
from typing import Any

import httpx
from bs4 import BeautifulSoup

SEARCH_URL = "https://itunes.apple.com/search"
LOOKUP_URL = "https://itunes.apple.com/lookup"


def pick_best_match(results: list[dict[str, Any]], term: str) -> dict[str, Any] | None:
    if not results:
        return None

    lowered = term.strip().lower()

    for item in results:
        track_name = str(item.get("trackName", "")).strip().lower()
        if track_name == lowered:
            return item

    for item in results:
        track_name = str(item.get("trackName", "")).strip().lower()
        if lowered and lowered in track_name:
            return item

    return results[0]


def search_app(term: str, country: str, limit: int) -> dict[str, Any] | None:
    params = {
        "term": term,
        "country": country,
        "entity": "software",
        "limit": limit,
    }
    with httpx.Client(timeout=15.0, follow_redirects=True) as client:
        resp = client.get(SEARCH_URL, params=params)
        resp.raise_for_status()
        payload = resp.json()

    results = payload.get("results", [])
    if not isinstance(results, list):
        return None
    return pick_best_match(results, term)


def lookup_app(track_id: int, country: str) -> dict[str, Any] | None:
    params = {
        "id": track_id,
        "country": country,
        "entity": "software",
    }
    with httpx.Client(timeout=15.0, follow_redirects=True) as client:
        resp = client.get(LOOKUP_URL, params=params)
        resp.raise_for_status()
        payload = resp.json()

    results = payload.get("results", [])
    if not isinstance(results, list) or not results:
        return None

    # App detail is usually the first software record with matching trackId.
    for item in results:
        if item.get("trackId") == track_id and item.get("wrapperType") == "software":
            return item
    for item in results:
        if item.get("trackId") == track_id:
            return item
    return results[0]


def scrape_privacy_policy_url(track_view_url: str | None) -> str | None:
    if not track_view_url:
        return None

    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            resp = client.get(track_view_url)
            resp.raise_for_status()
    except Exception:
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    keywords = ("隐私政策", "Privacy Policy", "隐私权政策")

    for a in soup.find_all("a", href=True):
        text = " ".join(a.get_text(strip=True).split())
        href = str(a.get("href", "")).strip()
        if not href:
            continue
        if any(word.lower() in text.lower() for word in keywords):
            return href

    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Find iOS app trackId and privacy policy URL from App Store API.")
    parser.add_argument("term", help="App name keyword, e.g. 支付宝")
    parser.add_argument("--country", default="cn", help="Store country code, default: cn")
    parser.add_argument("--limit", type=int, default=5, help="Search result limit, default: 5")
    args = parser.parse_args()

    app = search_app(args.term, args.country, args.limit)
    if not app:
        print("未找到应用")
        return

    track_id = app.get("trackId")
    if not track_id:
        print("搜索结果中未包含 trackId")
        return

    detail = lookup_app(int(track_id), args.country)
    if not detail:
        print(f"找到 trackId={track_id}，但未获取到详情")
        return

    privacy_policy_url = detail.get("privacyPolicyUrl")
    if not privacy_policy_url:
        privacy_policy_url = scrape_privacy_policy_url(detail.get("trackViewUrl"))

    output = {
        "query": args.term,
        "country": args.country,
        "trackId": detail.get("trackId", track_id),
        "trackName": detail.get("trackName") or app.get("trackName"),
        "bundleId": detail.get("bundleId") or app.get("bundleId"),
        "artistName": detail.get("artistName") or app.get("artistName"),
        "privacyPolicyUrl": privacy_policy_url,
        "trackViewUrl": detail.get("trackViewUrl"),
        "sellerUrl": detail.get("sellerUrl"),
    }

    for key, value in output.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()
