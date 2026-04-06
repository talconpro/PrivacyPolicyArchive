export type SupportedContentType = 'text/html' | 'application/pdf' | 'unknown';

export type ParserUsed = 'cheerio' | 'pdf-parse' | 'fallback';

export type FetchStatus = 'SUCCESS' | 'FAILED' | 'NEEDS_REVIEW';

export interface FetchResult {
  rawText: string;
  normalizedText: string;
  contentType: SupportedContentType;
  parserUsed: ParserUsed;
  fetchStatus: FetchStatus;
  sourceUrl: string;
  httpStatus?: number;
  errorMessage?: string;
}

export interface FetchPolicyOptions {
  timeoutMs?: number;
  minTextLength?: number;
  requestHeaders?: Record<string, string>;
}
