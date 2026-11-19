import type { SyntheticEvent } from 'react';
export function positionMenu(e: SyntheticEvent<HTMLDetailsElement>) {
  const element = e.currentTarget;
  if (!element.open) return;
  const rect = element.querySelector('summary')!.getBoundingClientRect();
  element.style.setProperty(
    '--menu-left',
    `${Math.max(8, Math.min(rect.left, window.innerWidth - 260))}px`,
  );
  element.style.setProperty(
    '--menu-top',
    `${Math.min(rect.bottom, window.innerHeight - 240)}px`,
  );
}
