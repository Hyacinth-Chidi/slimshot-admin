'use client';

import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  message: string;
  variant: 'default' | 'error' | 'success';
}

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

function emit() {
  listeners.forEach((l) => l());
}

export function toast(message: string, variant: Toast['variant'] = 'default'): void {
  const item: Toast = { id: nextId++, message, variant };
  toasts = [...toasts, item];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== item.id);
    emit();
  }, 5000);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => toasts,
  );
}
