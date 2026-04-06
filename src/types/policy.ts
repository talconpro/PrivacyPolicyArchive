export type ContentType = 'text/html' | 'application/pdf' | 'unknown';

export type ParserUsed = 'cheerio' | 'pdf-parse' | 'fallback';

export type FetchStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'NEEDS_REVIEW';
