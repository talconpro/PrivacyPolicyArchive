export function isContentChanged(previousHash: string | null | undefined, currentHash: string): boolean {
  return !previousHash || previousHash !== currentHash;
}

export function getNextVersionNo(previousVersionNo: number | null | undefined): number {
  return (previousVersionNo ?? 0) + 1;
}
