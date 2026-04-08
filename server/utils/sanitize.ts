export function sanitizeText(input?: string | null) {
  return (input || '').replace(/[<>]/g, '').trim().slice(0, 2000)
}

export function sanitizeList(values: string[] = []) {
  return values.map((item) => sanitizeText(item)).filter(Boolean)
}
