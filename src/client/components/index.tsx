import { createPortal } from 'react-dom';
import type { Transaction } from '../../shared/types';
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
  label = 'Saldo de abertura (R$)',
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
}) {
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        aria-label={label}
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
  return createPortal(
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
    </dialog>,
    document.body,
  );
}

export function CategoryOptions({
  categories,
}: {
  categories: import('../../shared/types').Category[];
}) {
  return (
    <>
      {[...new Set(categories.map((c) => c.group_name))].map((group) => (
        <optgroup key={group} label={group}>
          {categories
            .filter((c) => c.group_name === group)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

export function InstallmentLink({
  item,
}: {
  item: Pick<
    Transaction,
    'installment_plan_id' | 'installment_number' | 'installment_count'
  >;
}) {
  if (!item.installment_plan_id) return null;
  return (
    <>
      {' '}
      <a
        href={`/parceladas/${encodeURIComponent(item.installment_plan_id)}`}
        aria-label={`Compra original, parcela ${item.installment_number} de ${item.installment_count}`}
      >
        {item.installment_number && item.installment_count
          ? `${item.installment_number}/${item.installment_count}`
          : 'Compra original'}
      </a>
    </>
  );
}
