/**
 * Levenshtein distance between two strings (case-insensitive).
 */
export function levenshtein(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  const m = s1.length;
  const n = s2.length;

  // dp[i][j] = edit distance between s1[0..i-1] and s2[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Normalized similarity score: 1.0 = identical, 0.0 = completely different.
 */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Returns true if two strings are "close enough" (similarity >= threshold).
 */
export function fuzzyMatch(a: string, b: string, threshold = 0.8): boolean {
  return similarity(a, b) >= threshold;
}

/**
 * Normalize a name: remove extra spaces, lowercase, drop common titles.
 */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(sri|shri|smt|km|kumari|mr|mrs|ms|dr)\b\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize a date to YYYY-MM-DD if possible, else return original string.
 * Handles: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD.
 */
export function normalizeDate(s: string): string {
  s = s.trim();
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const ymd = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  return s;
}
