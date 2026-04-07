const DROP_QUERY_PARAMS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'spm', 'ref']);

function normalizePath(pathname: string): string {
  if (!pathname) {
    return '/';
  }

  const trimmed = pathname.replace(/\/{2,}/g, '/');
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    return trimmed.slice(0, -1);
  }

  return trimmed;
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}

function normalizePort(protocol: string, port: string): string {
  if (!port) {
    return '';
  }

  if ((protocol === 'http:' && port === '80') || (protocol === 'https:' && port === '443')) {
    return '';
  }

  return port;
}

export function normalizeUrlFingerprint(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());
  const hostname = normalizeHostname(parsed.hostname);
  const protocol = parsed.protocol.toLowerCase();
  const port = normalizePort(protocol, parsed.port);
  const pathname = normalizePath(parsed.pathname);

  const entries = [...parsed.searchParams.entries()]
    .filter(([key]) => !DROP_QUERY_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b) || 0);

  const search = new URLSearchParams(entries);
  const hostWithPort = port ? `${hostname}:${port}` : hostname;
  const query = search.toString();

  return `${protocol}//${hostWithPort}${pathname}${query ? `?${query}` : ''}`;
}
