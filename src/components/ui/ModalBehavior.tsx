import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open dialogs, innermost last: only the top one reacts to Escape and Tab
const stack: HTMLElement[] = [];
let nextId = 1;

/**
 * Makes the element it is placed in behave as a modal dialog for keyboard and screen-reader users:
 * it is announced as a dialog named by its first heading, focus moves into it and stays inside
 * while Tab is pressed, Escape closes it, and focus returns to where it was when it closes.
 *
 * Place it as the first child of the dialog panel: <div className="panel"><ModalBehavior onClose={close} />…</div>
 */
export function ModalBehavior({ onClose, label }: { onClose: () => void; label?: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const panel = marker.current?.parentElement;
    if (!panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    if (label) {
      panel.setAttribute('aria-label', label);
    } else {
      const heading = panel.querySelector('h1, h2, h3');
      if (heading) {
        if (!heading.id) heading.id = `dialog-title-${nextId++}`;
        panel.setAttribute('aria-labelledby', heading.id);
      }
    }
    if (!panel.hasAttribute('tabindex')) panel.tabIndex = -1;
    panel.style.outline = 'none';
    stack.push(panel);
    panel.focus();

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== panel) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const index = stack.indexOf(panel);
      if (index >= 0) stack.splice(index, 1);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [label]);

  return <span ref={marker} hidden />;
}
