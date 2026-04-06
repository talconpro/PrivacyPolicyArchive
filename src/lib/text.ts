export function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}
