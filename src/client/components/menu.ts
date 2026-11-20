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

// Um menu aberto por vez: abrir outro, clicar fora, Esc ou escolher uma ação fecha.
function closeMenus(except?: Element | null) {
  document
    .querySelectorAll<HTMLDetailsElement>('details.row-menu[open]')
    .forEach((menu) => {
      if (menu !== except && !menu.contains(except ?? null)) menu.open = false;
    });
}
if (typeof document !== 'undefined') {
  document.addEventListener(
    'toggle',
    (e) => {
      const menu = e.target as HTMLDetailsElement;
      if (menu.matches?.('details.row-menu') && menu.open) closeMenus(menu);
    },
    true,
  );
  document.addEventListener('pointerdown', (e) => {
    const target = e.target as Element;
    closeMenus(target.closest?.('details.row-menu'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('details.row-menu[open]');
    if (!open) return;
    const hadFocus = open.contains(document.activeElement);
    closeMenus();
    if (hadFocus) open.querySelector('summary')?.focus();
  });
  document.addEventListener('click', (e) => {
    const item = (e.target as Element).closest?.(
      '.menu-panel > button, .menu-panel > a',
    );
    const menu = item?.closest('details.row-menu') as HTMLDetailsElement;
    if (menu) menu.open = false;
  });
}
