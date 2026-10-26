// App-wide status messages. Components call notify() instead of window.alert(); the
// <Notifications /> region in App renders them and announces them to screen readers.

export type NoticeKind = 'success' | 'error' | 'info';
export interface Notice {
  id: number;
  kind: NoticeKind;
  message: string;
}

type Listener = (notices: Notice[]) => void;

let notices: Notice[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(notices));

export function notify(message: string, kind: NoticeKind = 'success', durationMs = kind === 'error' ? 8000 : 5000) {
  const notice = { id: nextId++, kind, message };
  notices = [...notices.slice(-3), notice];
  emit();
  setTimeout(() => dismiss(notice.id), durationMs);
}

export function dismiss(id: number) {
  notices = notices.filter((n) => n.id !== id);
  emit();
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  listener(notices);
  return () => {
    listeners.delete(listener);
  };
}
