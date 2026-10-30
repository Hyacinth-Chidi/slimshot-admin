import { apiFetch } from './client';
import { withRefresh } from '@/lib/auth/session';

/**
 * Wraps the server's owner-only /notifications endpoints
 * (slimshot_server/src/modules/admin/admin-notifications.controller.ts; the contract is
 * slimshot_server/docs/admin-notifications-api.md): push notifications through Firebase.
 */
export interface PushMessage {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'user';
  userId: string | null;
  status: 'sending' | 'sent' | 'failed';
  targetCount: number;
  sentCount: number;
  failedCount: number;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface NotificationsOverview {
  /** False until FIREBASE_SERVICE_ACCOUNT_BASE64 is set on the server. */
  configured: boolean;
  /** Installs with notifications on. */
  devices: number;
  /** The latest 50, newest first. */
  messages: PushMessage[];
}

export interface NewNotification {
  title: string;
  body: string;
  /** One user, by id, email or username. Left out: everyone. */
  user?: string;
}

export const NOTIFICATIONS_KEY = ['notifications'] as const;

export function fetchNotifications(): Promise<NotificationsOverview> {
  return withRefresh(() => apiFetch<NotificationsOverview>('/notifications'));
}

/** Queues the message; the server sends it in the background. */
export function sendNotification(message: NewNotification): Promise<{ id: string }> {
  return withRefresh(() => apiFetch<{ id: string }>('/notifications', { method: 'POST', body: JSON.stringify(message) }));
}
