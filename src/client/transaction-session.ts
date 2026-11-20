import { useEffect, useRef, useState } from 'react';
import { api, transactionActions, transactionWritePending } from './api';

export function useTransactionSession(onSaved: () => Promise<void>) {
  const undo = useRef<string[]>([]);
  const redo = useRef<string[]>([]);
  const pending = useRef(false);
  const [latest, setLatest] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const record = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      undo.current.push(id);
      redo.current = [];
      setLatest(id);
      setError('');
    };
    transactionActions.addEventListener('save', record);
    return () => transactionActions.removeEventListener('save', record);
  }, []);

  async function reverse(direction: 'undo' | 'redo', expectedId?: string) {
    const from = direction === 'undo' ? undo : redo;
    const to = direction === 'undo' ? redo : undo;
    const id = from.current.at(-1);
    if (
      !id ||
      pending.current ||
      transactionWritePending() ||
      (expectedId && expectedId !== id)
    )
      return;
    pending.current = true;
    setError('');
    setBusy(true);
    try {
      const result = await api<{ action_id: string }>(
        `/transaction-actions/${id}/${direction}`,
        {
          method: 'POST',
          body: '{}',
        },
      );
      from.current.pop();
      to.current.push(result.action_id);
      setLatest(undo.current.at(-1) ?? null);
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const mac = /Mac|iPhone|iPad/.test(navigator.platform);
      if (
        event.key.toLowerCase() !== 'z' ||
        event.altKey ||
        !(mac ? event.metaKey : event.ctrlKey)
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input:not([type=checkbox]),textarea,[contenteditable=true]',
        )
      )
        return;
      if (!(event.shiftKey ? redo : undo).current.length) return;
      event.preventDefault();
      if (!event.repeat) void reverse(event.shiftKey ? 'redo' : 'undo');
    }
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onSaved]);

  return { latest, error, busy, reverse };
}
