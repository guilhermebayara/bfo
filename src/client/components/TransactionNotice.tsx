import { useMoney } from '../privacy';
import { useEffect, useRef, useState } from 'react';
import type { TransactionNotice as NoticeData } from '../../shared/transaction-notice';
import { Button, Notice } from './index';

export function TransactionNotice({
  notice,
  onUndo,
  busy,
}: {
  notice: NoticeData;
  onUndo?: () => void;
  busy: boolean;
}) {
  const formatMoney = useMoney();
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const remaining = useRef(7000);
  const paused = hover || focused || busy;
  useEffect(() => {
    if (paused || !visible) return;
    const since = performance.now();
    const timer = setTimeout(() => setVisible(false), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (performance.now() - since),
      );
    };
  }, [paused, visible]);

  if (!visible) return null;
  return (
    <Notice
      tone="success"
      className="transaction-notice"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <div role="status" aria-label="Aviso de transação">
        <strong>{notice.message}</strong>
        {notice.accounts.map((account) => (
          <div key={account.id}>
            {account.name} · Saldo:{' '}
            <span className="numeric">
              {formatMoney(account.balance_cents, account.currency)}
            </span>
          </div>
        ))}
      </div>
      <div className="inline-actions">
        {onUndo && (
          <Button onClick={onUndo} disabled={busy}>
            Desfazer
          </Button>
        )}
        <Button
          variant="quiet"
          onClick={() => setVisible(false)}
          aria-label="Fechar aviso"
        >
          Fechar
        </Button>
      </div>
    </Notice>
  );
}
