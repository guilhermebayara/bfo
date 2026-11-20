import { useEffect, useRef, useState, type ReactNode } from 'react';

type Move = 'next' | 'previous' | 'down' | 'up' | 'left' | 'right';
function neighbor(cell: HTMLElement, direction: Move) {
  const table = cell.closest('table')!;
  const cells = [...table.querySelectorAll<HTMLElement>('[data-sheet-cell]')];
  if (direction === 'next' || direction === 'previous') {
    const editable = cells.filter((c) => c.dataset.editable === 'true');
    const index = editable.indexOf(cell);
    return editable[index + (direction === 'next' ? 1 : -1)];
  }
  const row = cell.parentElement!;
  const rows = [
    ...table.querySelectorAll<HTMLElement>('tr[data-transaction-id]'),
  ];
  const column = Number(cell.dataset.sheetCell);
  if (direction === 'left' || direction === 'right')
    return (
      row.querySelector<HTMLElement>(
        `[data-sheet-cell="${column + (direction === 'right' ? 1 : -1)}"]`,
      ) ?? undefined
    );
  return (
    rows[
      rows.indexOf(row) + (direction === 'down' ? 1 : -1)
    ]?.querySelector<HTMLElement>(`[data-sheet-cell="${column}"]`) ?? undefined
  );
}

export function SpreadsheetCell({
  column,
  label,
  value,
  display,
  locked,
  save,
  editor,
  open,
}: {
  column: number;
  label: string;
  value: string;
  display: ReactNode;
  locked?: string;
  save?: (value: string) => Promise<void>;
  editor?: (
    draft: string,
    change: (value: string, immediate?: boolean) => void,
  ) => ReactNode;
  open?: () => void;
}) {
  const ref = useRef<HTMLTableCellElement>(null);
  const saving = useRef(false);
  const editing = useRef(false);
  const [active, setActive] = useState(false);
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setShown(value);
    if (!editing.current) setDraft(value);
  }, [value]);
  useEffect(() => {
    if (active)
      ref.current?.querySelector<HTMLElement>('input,select')?.focus();
  }, [active]);
  function positionEditor() {
    const cell = ref.current;
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    cell.style.setProperty(
      '--editor-left',
      `${Math.min(rect.left, window.innerWidth - 260)}px`,
    );
    cell.style.setProperty(
      '--editor-top',
      `${Math.min(rect.top, window.innerHeight - 160)}px`,
    );
    cell.style.setProperty('--editor-width', `${rect.width}px`);
    cell.style.setProperty(
      '--message-top',
      `${Math.min(rect.top + 100, window.innerHeight - 60)}px`,
    );
  }
  function start() {
    positionEditor();
    if (locked) {
      setError(locked);
      return;
    }
    if (saving.current) return;
    if (open) {
      open();
      return;
    }
    if (editing.current) return;
    editing.current = true;
    setDraft(shown);
    setError('');
    setActive(true);
  }
  async function commit(next: string, move?: Move) {
    if (saving.current) return;
    const target = move && ref.current ? neighbor(ref.current, move) : null;
    const retainFocus = ref.current?.contains(document.activeElement);
    if (!editing.current) {
      target?.focus();
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      if (next !== shown) await save?.(next);
      setShown(next);
      editing.current = false;
      setActive(false);
      const focusStayed =
        document.activeElement === document.body ||
        ref.current?.contains(document.activeElement);
      if (retainFocus && focusStayed) {
        if (target) target.focus();
        else ref.current?.focus();
      }
    } catch (e) {
      setError((e as Error).message);
      ref.current?.querySelector<HTMLElement>('input,select')?.focus();
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <td
      ref={ref}
      tabIndex={0}
      data-sheet-cell={column}
      data-editable={!locked}
      aria-readonly={Boolean(locked)}
      aria-label={label}
      aria-busy={busy}
      title={`${typeof display === 'string' ? `${display}\n` : ''}${locked ?? 'Clique para editar. Salva ao sair da célula.'}`}
      className={`sheet-cell ${active ? 'sheet-editing' : ''} ${locked ? 'sheet-locked' : ''}`}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('a,button')) start();
      }}
      onBlur={(e) => {
        if (locked) setError('');
        if (!e.currentTarget.contains(e.relatedTarget)) void commit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          if (saving.current) return;
          editing.current = false;
          setDraft(shown);
          setActive(false);
          setError('');
          ref.current?.focus();
        } else if (e.key === 'Tab' || (e.key === 'Enter' && active)) {
          e.preventDefault();
          void commit(
            draft,
            e.key === 'Enter'
              ? e.shiftKey
                ? 'up'
                : 'down'
              : e.shiftKey
                ? 'previous'
                : 'next',
          );
        } else if (e.key === 'Enter' && !active) {
          e.preventDefault();
          start();
        } else if (
          e.key.startsWith('Arrow') &&
          (e.target === e.currentTarget ||
            (active && (e.target as HTMLElement).tagName !== 'SELECT'))
        ) {
          e.preventDefault();
          const direction = e.key.slice(5).toLowerCase() as Move;
          if (active) void commit(draft, direction);
          else neighbor(e.currentTarget, direction)?.focus();
        }
      }}
    >
      {active ? (
        <fieldset disabled={busy} className="cell-editor">
          {editor?.(draft, (next, immediate = false) => {
            setDraft(next);
            if (immediate) void commit(next);
          })}
        </fieldset>
      ) : (
        <span className="cell-value">{display}</span>
      )}

      {error && (
        <small className="cell-message" role="alert">
          {error}
        </small>
      )}
    </td>
  );
}
