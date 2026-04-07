export interface ItunesAppMatch {
  trackId: number;
  trackName: string;
  artistName?: string;
  artworkUrl100?: string;
  sellerName?: string;
}

interface ItunesSearchResponse {
  resultCount: number;
  results: ItunesAppMatch[];
}

export async function findAppByNameFromItunes(appName: string, country = process.env.ITUNES_COUNTRY ?? 'cn'): Promise<ItunesAppMatch | null> {
  const params = new URLSearchParams({
    term: appName,
    country,
    entity: 'software',
    limit: '1',
  });

  const url = `https://itunes.apple.com/search?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PrivacyPolicyArchiveBot/1.0',
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as ItunesSearchResponse;
  if (!payload.resultCount || payload.results.length === 0) {
    return null;
  }

  return payload.results[0] ?? null;
}
