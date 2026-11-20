import { createContext, useContext, useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { formatMoney } from '../shared/money';

const storageKey = 'bfo:privacy';
export const maskedMoney = 'R$ ••••';
export const Privacy = createContext(false);
const hideMoney = () => maskedMoney;

export function useMoney() {
  return useContext(Privacy) ? hideMoney : formatMoney;
}

export function usePrivacy() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });
  const toggle = () => setHidden((value) => !value);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(hidden));
    } catch {
      // A escolha continua valendo enquanto o aplicativo estiver aberto.
    }
  }, [hidden]);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        (mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey) &&
        e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === 'h'
      ) {
        e.preventDefault();
        if (!e.repeat) toggle();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mac]);
  return { hidden, toggle, shortcut: mac ? 'Meta+Shift+H' : 'Control+Shift+H' };
}

export function FinancialInput(props: ComponentProps<'input'>) {
  const hidden = useContext(Privacy);
  return (
    <input
      {...props}
      type={hidden ? 'password' : 'text'}
      autoComplete={hidden ? 'off' : props.autoComplete}
    />
  );
}
