export function useRiskScore(level?: string | null) {
  const order = { low: 1, medium: 2, high: 3, critical: 4 }
  return order[level as keyof typeof order] || 0
}
