'use client';

import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { OwnerOnly } from '@/components/system/owner-only';
import { SystemHeader } from '@/components/system/system-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import {
  fetchNotifications,
  NOTIFICATIONS_KEY,
  sendNotification,
  type NewNotification,
  type PushMessage,
} from '@/lib/api/notifications';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/use-toast';

const NUMBER = new Intl.NumberFormat('en-GB');
const TITLE_MAX = 100;
const BODY_MAX = 1000;

/** System › Notifications: the header outside the owner gate, everything else inside it. */
export function NotificationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <SystemHeader title="Notifications" subtitle="Send a message to everyone with the app, or to one user." />
      <OwnerOnly what="notifications">
        <NotificationsContent />
      </OwnerOnly>
    </div>
  );
}

function NotificationsContent() {
  // Polls every 3 s only while a message is still going out.
  const query = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: fetchNotifications,
    refetchInterval: (q) => (q.state.data?.messages.some((m) => m.status === 'sending') ? 3_000 : false),
  });
  const data = query.data;

  if (query.isPending) {
    return (
      <LoadingRegion label="Loading notifications" className="flex flex-col gap-6">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </LoadingRegion>
    );
  }
  if (!data) {
    return (
      <div role="alert" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 md:p-6">
        <p className="text-sm text-muted">Could not load the notifications.</p>
        <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!data.configured) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-text">
          Push notifications are not set up yet. Add FIREBASE_SERVICE_ACCOUNT_BASE64 to the server&apos;s .env (setup
          guide, step 8B), then redeploy.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
      <ComposeCard devices={data.devices} />
      <SentList messages={data.messages} />
    </div>
  );
}

function ComposeCard({ devices }: { devices: number }) {
  const queryClient = useQueryClient();
  const headingId = useId();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'user'>('all');
  const [user, setUser] = useState('');
  const [confirming, setConfirming] = useState(false);

  const ready = title.trim() !== '' && body.trim() !== '' && (audience === 'all' || user.trim() !== '');
  const message: NewNotification = {
    title: title.trim(),
    body: body.trim(),
    ...(audience === 'user' ? { user: user.trim() } : {}),
  };

  const send = useMutation({
    mutationFn: (m: NewNotification) => sendNotification(m),
    onSuccess: () => {
      setTitle('');
      setBody('');
      setUser('');
      toast('Sending. The list shows when it’s done.');
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) return;
      toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
    },
    onSettled: () => {
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });

  return (
    <section aria-labelledby={headingId} className="flex flex-col rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 id={headingId} className="flex items-center gap-2 text-[15px] font-semibold text-text">
          <Send size={16} aria-hidden="true" />
          New notification
        </h2>
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">
        <Field label="Title" count={title.length} max={TITLE_MAX}>
          {(id) => <Input id={id} value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Message" count={body.length} max={BODY_MAX}>
          {(id) => <Textarea id={id} value={body} maxLength={BODY_MAX} rows={4} onChange={(e) => setBody(e.target.value)} />}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Send to</span>
          <Select value={audience} onValueChange={(v) => setAudience(v as 'all' | 'user')}>
            <SelectTrigger aria-label="Send to" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="user">One user</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {audience === 'user' && (
          <Field label="User">
            {(id) => (
              <Input id={id} value={user} placeholder="Email, username or id" onChange={(e) => setUser(e.target.value)} />
            )}
          </Field>
        )}
      </div>
      <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-subtle">
        <span>{`${NUMBER.format(devices)} ${devices === 1 ? 'install has' : 'installs have'} notifications on.`}</span>
        <Button variant="primary" size="sm" disabled={!ready || send.isPending} onClick={() => setConfirming(true)}>
          Send…
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={(open) => !open && !send.isPending && setConfirming(false)}>
        <DialogContent role="alertdialog" showCloseButton={false} className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>{audience === 'all' ? 'Send to everyone?' : `Send to ${user.trim()}?`}</DialogTitle>
            <DialogDescription>
              {audience === 'all'
                ? `“${title.trim()}” goes to ${NUMBER.format(devices)} installs now. It can’t be taken back.`
                : `“${title.trim()}” goes to their installs now. It can’t be taken back.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" disabled={send.isPending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={send.isPending} onClick={() => send.mutate(message)}>
              {send.isPending ? 'Sending…' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Field({
  label,
  count,
  max,
  children,
}: {
  label: string;
  count?: number;
  max?: number;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
        {max !== undefined && <span className="text-xs text-subtle tabular-nums">{`${count ?? 0}/${max}`}</span>}
      </div>
      {children(id)}
    </div>
  );
}

function SentList({ messages }: { messages: PushMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-12 text-center text-sm text-subtle">
        Nothing sent yet.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="py-2.5 pr-3 pl-4 font-medium md:pl-5">Sent</th>
            <th className="py-2.5 pr-3 font-medium">Message</th>
            <th className="py-2.5 pr-3 font-medium">To</th>
            <th className="py-2.5 pr-4 font-medium md:pr-5">Delivered</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((m) => (
            <tr key={m.id} className="border-b border-border align-top last:border-0">
              <td className="py-2.5 pr-3 pl-4 whitespace-nowrap text-muted md:pl-5">{formatDateTime(m.createdAt)}</td>
              <td className="max-w-72 py-2.5 pr-3">
                <p className="font-medium text-text">{m.title}</p>
                <p className="line-clamp-2 text-xs text-subtle">{m.body}</p>
              </td>
              <td className="py-2.5 pr-3 whitespace-nowrap text-muted">{m.audience === 'all' ? 'Everyone' : 'One user'}</td>
              <td className="py-2.5 pr-4 md:pr-5">
                <Delivery message={m} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Delivery({ message: m }: { message: PushMessage }) {
  if (m.status === 'sending') return <span className="text-muted">Sending…</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('whitespace-nowrap tabular-nums', m.status === 'failed' ? 'text-muted' : 'text-text')}>
        {`${NUMBER.format(m.sentCount)} of ${NUMBER.format(m.targetCount)}`}
      </span>
      {m.status === 'failed' && <span className="text-xs text-error">{`Failed: ${m.error ?? 'no reason was recorded.'}`}</span>}
    </div>
  );
}
