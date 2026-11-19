import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`button ${props.className ?? ''}`} />;
}
export function Badge({
  origin,
}: {
  origin: 'imported' | 'manual' | 'adjustment';
}) {
  return (
    <span className="badge">
      {
        { imported: 'Importado', manual: 'Manual', adjustment: 'Ajuste' }[
          origin
        ]
      }
    </span>
  );
}
export function MoneyField({
  value,
  onChange,
  id = 'opening-balance',
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <label htmlFor={id}>
      Saldo de abertura (R$)
      <input
        id={id}
        inputMode="decimal"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-help`}
      />
      <small id={`${id}-help`}>
        Use vírgula nos centavos. Saldo devedor leva sinal negativo.
      </small>
    </label>
  );
}
export function Table({
  headers,
  children,
  label,
}: {
  headers: string[];
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={label}>
      <table>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className={h === 'Valor' || h === 'Saldo' ? 'numeric' : ''}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close.current();
      }}
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <Button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Fechar"
        >
          Fechar
        </Button>
      </div>
      {children}
    </dialog>
  );
}
