/**
 * The dashboard's one way of writing dates: "29 Oct 2026", "29 Oct 2026, 14:05",
 * "27 Oct". British order everywhere, in the viewer's own time zone unless one
 * is given (tests pass 'UTC'). Anything unparseable reads as a dash.
 */

function parse(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function format(iso: string, options: Intl.DateTimeFormatOptions, timeZone?: string): string {
  const date = parse(iso);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-GB', { ...options, ...(timeZone ? { timeZone } : {}) }).format(date);
}

export function formatDate(iso: string, timeZone?: string): string {
  return format(iso, { day: 'numeric', month: 'short', year: 'numeric' }, timeZone);
}

export function formatDateTime(iso: string, timeZone?: string): string {
  return format(
    iso,
    { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
    timeZone,
  );
}

export function formatShortDate(iso: string, timeZone?: string): string {
  return format(iso, { day: 'numeric', month: 'short' }, timeZone);
}
