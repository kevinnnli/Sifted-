export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 'YYYY-MM-DD' values are calendar dates: parse them in local time. new Date('2026-08-04') is UTC
// midnight, which displays as the previous day for users west of UTC.
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function formatLocalDate(value?: string): string {
  const date = value ? parseLocalDate(value) : null;
  return date ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending Assignment';
}

export function isPastDeadline(deadline?: string): boolean {
  const date = deadline ? parseLocalDate(deadline) : null;
  if (!date) return false;
  date.setHours(23, 59, 59, 999);
  return Date.now() > date.getTime();
}

export function formatTime(totalSeconds: number) {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Evaluates calculator input restricted to digits, arithmetic operators, parentheses, '.' and '%'
export function evaluateArithmetic(expression: string): string {
  const sanitized = expression.replace(/[^0-9+\-*/().%]/g, '');
  if (!sanitized) return '';
  try {
    const result = new Function(`"use strict"; return (${sanitized});`)();
    return typeof result === 'number' && Number.isFinite(result) ? String(Math.round(result * 1e10) / 1e10) : 'Error';
  } catch {
    return 'Error';
  }
}
