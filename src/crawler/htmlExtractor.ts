import { load, type CheerioAPI } from 'cheerio';

import { normalizeText } from '../lib/text';

const MAIN_CONTENT_SELECTORS = [
  'article',
  'main',
  '[role="main"]',
  '.privacy-policy',
  '.policy-content',
  '.content',
  '.main-content',
  '#content',
  '#main',
];

const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'svg',
  'img',
  'video',
  'audio',
  'iframe',
  'header',
  'footer',
  'nav',
  'aside',
  'form',
  'button',
  'input',
  'textarea',
  'select',
];

function pickBestContentRoot($: CheerioAPI) {
  for (const selector of MAIN_CONTENT_SELECTORS) {
    const candidate = $(selector).first();
    if (candidate.length > 0 && normalizeText(candidate.text()).length > 0) {
      return candidate;
    }
  }

  return $('body').first();
}

/**
 * Extracts readable policy text from HTML using cheerio.
 * The function is intentionally pure so it can be unit-tested with raw HTML fixtures.
 */
export function extractHtmlText(html: string): {
  rawText: string;
  normalizedText: string;
  parserUsed: 'cheerio';
} {
  const $ = load(html);

  for (const selector of NOISE_SELECTORS) {
    $(selector).remove();
  }

  const root = pickBestContentRoot($);
  const rawText = root.text().replace(/\u00a0/g, ' ').trim();

  return {
    rawText,
    normalizedText: normalizeText(rawText),
    parserUsed: 'cheerio',
  };
}
