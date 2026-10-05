const NUMBER = new Intl.NumberFormat('en-GB');

export function displayName(user: { username: string | null }): string {
  return user.username ?? 'Not claimed yet';
}

export function formatCredits(n: number): string {
  return NUMBER.format(n);
}

/** `+5`, `−12` (a real minus sign, U+2212, not a hyphen), `0`. */
export function formatSigned(n: number): string {
  if (n > 0) return `+${formatCredits(n)}`;
  if (n < 0) return `−${formatCredits(-n)}`;
  return '0';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** A user's page; an active list search rides along so the page's Back link can restore it. */
export function userHref(id: string, q?: string): string {
  const base = `/users/${encodeURIComponent(id)}`;
  return q ? `${base}?${new URLSearchParams({ q })}` : base;
}
