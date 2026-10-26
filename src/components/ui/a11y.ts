import type React from 'react';

/**
 * Props that make a non-button element (for example a card that contains block content) behave
 * like a button for keyboard and screen-reader users: focusable, announced as a button, and
 * activated with Enter or Space as well as a click.
 */
export function asButton(onActivate: () => void, extra: { pressed?: boolean; expanded?: boolean; label?: string } = {}) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-pressed': extra.pressed,
    'aria-expanded': extra.expanded,
    'aria-label': extra.label,
    onClick: onActivate,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
