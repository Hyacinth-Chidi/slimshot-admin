'use client';

import { useSyncExternalStore } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  message: string;
  variant: 'default' | 'error' | 'success';
  /** One button in the toast, e.g. Undo. Using it closes the toast. */
  action?: ToastAction;
}

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

function emit() {
  listeners.forEach((l) => l());
}

export function toast(message: string, variant: Toast['variant'] = 'default', action?: ToastAction): void {
  const item: Toast = { id: nextId++, message, variant, ...(action ? { action } : {}) };
  toasts = [...toasts, item];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== item.id);
    emit();
  }, 5000);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
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
