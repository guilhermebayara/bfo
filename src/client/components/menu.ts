import type { SyntheticEvent } from 'react';
export function positionMenu(e: SyntheticEvent<HTMLDetailsElement>) {
  const element = e.currentTarget;
  if (!element.open) return;
  const trigger = element.querySelector('summary')!.getBoundingClientRect();
  const panel = element.querySelector<HTMLElement>('.menu-panel')!;
  const { width, height } = panel.getBoundingClientRect();
  const margin = 8;
  const left = Math.max(
    margin,
    Math.min(trigger.left, window.innerWidth - width - margin),
  );
  const top =
    trigger.bottom + height + margin <= window.innerHeight
      ? trigger.bottom
      : Math.max(margin, trigger.top - height);
  element.style.setProperty('--menu-left', `${left}px`);
  element.style.setProperty('--menu-top', `${top}px`);
}
