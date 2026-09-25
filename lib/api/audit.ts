import { apiFetchEnvelope } from './client';
import { withRefresh } from '@/lib/auth/session';

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditPage {
  data: AuditEntry[];
  meta: { nextCursor: string | null };
}

export function fetchAuditLogs(filters: {
  actorId?: string;
  action?: string;
  entityType?: string;
  cursor?: string;
  limit?: number;
} = {}): Promise<AuditPage> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const suffix = qs.toString() ? `?${qs}` : '';
  return withRefresh(() => apiFetchEnvelope<AuditEntry[], { nextCursor: string | null }>(
    `/audit-logs${suffix}`,
  ));
}
