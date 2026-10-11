export type ToastKind = 'success' | 'reward' | 'event' | 'disaster' | 'error' | 'info';
export type ToastInput = {
  id?: string; kind?: ToastKind; title: string; detail?: string; icon?: string;
  amount?: number; currency?: 'coins' | 'diamonds' | 'XP'; thumbnail?: string;
  variant?: 'moment'; duration?: number; action?: {label: string; onClick: () => void | Promise<void>};
  onDismiss?: () => void;
};
export type Toast = ToastInput & {id: string; kind: ToastKind; duration: number};

// Timers belong to visible cards: queued notices (especially errors) never expire unseen.
export function createToastStore() {
  let items: Toast[] = [], sequence = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(fn => fn());
  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    snapshot: () => items,
    push(input: ToastInput | string) {
      const value: ToastInput = typeof input === 'string' ? {title: input} : input;
      const id = value.id ?? `toast-${++sequence}`;
      if (items.some(item => item.id === id)) return id;
      const kind = value.kind ?? 'success';
      items = [{...value, id, kind, duration: kind === 'error' ? 0 : value.duration ?? (value.variant === 'moment' ? 2500 : 4000)}, ...items];
      emit(); return id;
    },
    dismiss(id: string, notify = true) {
      const item = items.find(item => item.id === id);
      if (!item) return;
      items = items.filter(item => item.id !== id); emit(); if (notify) item.onDismiss?.();
    },
    clear() { const previous = items; items = []; emit(); previous.forEach(item => item.onDismiss?.()); },
  };
}
export const toastStore = createToastStore();
export const toast = toastStore.push;
export const dismissToast = toastStore.dismiss;
