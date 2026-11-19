export function CurrencyPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const names = new Intl.DisplayNames(['pt-BR'], { type: 'currency' });
  const codes = Intl.supportedValuesOf('currency');
  return (
    <select
      aria-label="Moeda"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {['BRL', ...codes.filter((c) => c !== 'BRL')].map((code) => (
        <option key={code} value={code}>
          {code} · {names.of(code)}
        </option>
      ))}
    </select>
  );
}
