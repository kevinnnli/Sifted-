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

// Evaluates calculator input: numbers, + - * / % (remainder), parentheses and unary minus.
// A small parser rather than eval/new Function, so the page can run under a strict
// Content-Security-Policy without 'unsafe-eval'.
export function evaluateArithmetic(expression: string): string {
  const input = expression.replace(/\s+/g, '');
  if (!input) return '';
  let pos = 0;
  const peek = () => input[pos];
  const fail = (): never => {
    throw new Error('invalid');
  };

  const number = (): number => {
    const match = /^(\d+\.?\d*|\.\d+)/.exec(input.slice(pos));
    if (!match) fail();
    pos += match![0].length;
    return parseFloat(match![0]);
  };
  const factor = (): number => {
    if (peek() === '-') {
      pos++;
      return -factor();
    }
    if (peek() === '+') {
      pos++;
      return factor();
    }
    if (peek() === '(') {
      pos++;
      const value = sum();
      if (peek() !== ')') fail();
      pos++;
      return value;
    }
    return number();
  };
  const product = (): number => {
    let value = factor();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = input[pos++];
      const rhs = factor();
      value = op === '*' ? value * rhs : op === '/' ? value / rhs : value % rhs;
    }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      const op = input[pos++];
      const rhs = product();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  };

  try {
    const result = sum();
    if (pos !== input.length) fail();
    return Number.isFinite(result) ? String(Math.round(result * 1e10) / 1e10) : 'Error';
  } catch {
    return 'Error';
  }
}
