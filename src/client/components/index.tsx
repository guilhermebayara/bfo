import { positionMenu } from './menu';
import { createPortal } from 'react-dom';
import type { Transaction } from '../../shared/types';
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button {...props} className={`button button-${variant} ${className}`} />
  );
}

const states = {
  open: 'Aberta',
  closed: 'Fechada',
  paid: 'Paga',
  imported: 'Importada',
  manual: 'Manual',
  adjustment: 'Ajuste',
  retroactive: 'Retroativa',
} as const;

export function Badge({
  state,
  title,
  label,
}: {
  state: keyof typeof states;
  title?: string;
  label?: string;
}) {
  return (
    <span className={`badge badge-${state}`} title={title}>
      {label ?? states[state]}
    </span>
  );
}

export function PageHeader({
  title,
  context,
  actions,
}: {
  title: string;
  context?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-heading">
        <h1>{title}</h1>
        {context && <div className="page-context">{context}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Panel({
  className = '',
  ...props
}: ComponentPropsWithoutRef<'section'>) {
  return <section {...props} className={`panel ${className}`} />;
}

export function SidePanel({
  className = '',
  ...props
}: ComponentPropsWithoutRef<'aside'>) {
  return <aside {...props} className={`panel side-panel ${className}`} />;
}

export function Field(props: ComponentPropsWithoutRef<'input'>) {
  return <input {...props} />;
}

export function Select(props: ComponentPropsWithoutRef<'select'>) {
  return <select {...props} />;
}

export function Truncated({ children }: { children: string }) {
  return (
    <span className="cell-value" title={children}>
      {children}
    </span>
  );
}

export function Notice({
  tone = 'neutral',
  children,
  className = '',
  ...props
}: ComponentPropsWithoutRef<'div'> & {
  tone?: 'neutral' | 'warning' | 'success' | 'error';
}) {
  return (
    <div {...props} className={`notice notice-${tone} ${className}`}>
      {children}
    </div>
  );
}

export function ConfirmationNotice({
  children,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
  busy = false,
}: {
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
}) {
  return (
    <Notice tone="warning" className="confirmation-notice">
      <strong>{children}</strong>
      <div className="inline-actions">
        <Button
          type="button"
          variant="danger"
          disabled={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button
          type="button"
          variant="quiet"
          disabled={busy}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
      </div>
    </Notice>
  );
}

export function State({
  kind,
  children,
  action,
}: {
  kind: 'empty' | 'loading' | 'error';
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Notice
      tone={kind === 'error' ? 'error' : 'neutral'}
      role={
        kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined
      }
      className={`state state-${kind}`}
    >
      <span>{children}</span>
      {action}
    </Notice>
  );
}

export function Menu({
  label,
  trigger,
  children,
  className = '',
  panelClassName = '',
  ...props
}: ComponentPropsWithoutRef<'details'> & {
  label?: string;
  trigger: ReactNode;
  panelClassName?: string;
}) {
  return (
    <details
      {...props}
      className={`row-menu ${className}`}
      onToggle={positionMenu}
    >
      <summary aria-label={label}>{trigger}</summary>
      <div className={`menu-panel ${panelClassName}`}>{children}</div>
    </details>
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
      <Field
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
  widths,
  numeric = [],
}: {
  headers: string[];
  widths?: string[];
  numeric?: number[];
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={label}>
      <table className={widths ? 'table-fixed' : undefined}>
        {widths && (
          <colgroup>
            {widths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
        )}
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {headers.map((h, index) => (
              <th
                key={h}
                scope="col"
                className={numeric.includes(index) ? 'numeric' : undefined}
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
  const titleId = useId();
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
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close.current();
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <Button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Fechar"
          variant="quiet"
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
