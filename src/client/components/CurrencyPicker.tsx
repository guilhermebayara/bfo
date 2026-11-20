import { useEffect, useState } from 'react';
import { api } from '../api';
export function CurrencyPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [codes, setCodes] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    api<{ currencies_in_use: string[] }>('/preferences')
      .then((p) => {
        if (alive) setCodes(p.currencies_in_use);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const names = new Intl.DisplayNames(['pt-BR'], { type: 'currency' });
  return (
    <select
      aria-label="Moeda"
      value={value}
      disabled={disabled || !codes.length}
      onChange={(e) => onChange(e.target.value)}
    >
      {codes.map((code) => (
        <option key={code} value={code}>
          {code} · {names.of(code)}
        </option>
      ))}
    </select>
  );
}
