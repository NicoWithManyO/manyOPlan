export function pluralSuffix(n: number): string {
  return n > 1 ? "s" : "";
}

export function pluralFr(n: number, word: string): string {
  return `${n} ${word}${pluralSuffix(n)}`;
}
