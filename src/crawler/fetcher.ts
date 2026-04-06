import axios, { type AxiosInstance } from 'axios';

import { normalizeText } from '../lib/text';
import type { FetchPolicyOptions, FetchResult, FetchStatus, SupportedContentType } from '../types/fetch';
import { extractHtmlText } from './htmlExtractor';
import { extractPdfText } from './pdfExtractor';

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MIN_TEXT_LENGTH = 200;

function normalizeContentType(headerValue?: string): SupportedContentType {
  if (!headerValue) {
    return 'unknown';
  }

  const lowered = headerValue.toLowerCase();
  if (lowered.includes('application/pdf')) {
    return 'application/pdf';
  }

  if (lowered.includes('text/html') || lowered.includes('application/xhtml+xml')) {
    return 'text/html';
  }

  return 'unknown';
}

function detectContentType(url: string, headerValue?: string): SupportedContentType {
  const fromHeader = normalizeContentType(headerValue);
  if (fromHeader !== 'unknown') {
    return fromHeader;
  }

  if (url.toLowerCase().endsWith('.pdf')) {
    return 'application/pdf';
  }

  return 'text/html';
}

function resolveFetchStatus(normalizedText: string, minTextLength: number): FetchStatus {
  return normalizedText.length < minTextLength ? 'NEEDS_REVIEW' : 'SUCCESS';
}

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  return Buffer.from(data as ArrayBuffer);
}

/**
 * Fetches privacy policy content by URL and returns a structured parse result.
 */
export async function fetchPolicyByUrl(
  url: string,
  options: FetchPolicyOptions = {},
): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const minTextLength = options.minTextLength ?? DEFAULT_MIN_TEXT_LENGTH;

  const httpClient: AxiosInstance = axios.create({
    timeout: timeoutMs,
    maxRedirects: 5,
    responseType: 'arraybuffer',
    validateStatus: () => true,
    headers: {
      Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.8',
      'User-Agent': 'PrivacyPolicyArchiveBot/1.0',
      ...options.requestHeaders,
    },
  });

  try {
    const response = await httpClient.get(url);
    const headerContentType =
      typeof response.headers['content-type'] === 'string'
        ? response.headers['content-type']
        : undefined;

    if (response.status < 200 || response.status >= 300) {
      return {
        rawText: '',
        normalizedText: '',
        contentType: detectContentType(url, headerContentType),
        parserUsed: 'fallback',
        fetchStatus: 'FAILED',
        sourceUrl: url,
        httpStatus: response.status,
        errorMessage: `Request failed with status ${response.status}`,
      };
    }

    const contentType = detectContentType(url, headerContentType);
    const bodyBuffer = toBuffer(response.data);

    if (contentType === 'application/pdf') {
      const extracted = await extractPdfText(bodyBuffer);
      return {
        ...extracted,
        contentType,
        fetchStatus: resolveFetchStatus(extracted.normalizedText, minTextLength),
        sourceUrl: url,
        httpStatus: response.status,
      };
    }

    const html = bodyBuffer.toString('utf-8');
    const extracted = extractHtmlText(html);

    return {
      ...extracted,
      contentType: 'text/html',
      fetchStatus: resolveFetchStatus(extracted.normalizedText, minTextLength),
      sourceUrl: url,
      httpStatus: response.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error';

    return {
      rawText: '',
      normalizedText: normalizeText(''),
      contentType: 'unknown',
      parserUsed: 'fallback',
      fetchStatus: 'FAILED',
      sourceUrl: url,
      errorMessage,
    };
  }
}
