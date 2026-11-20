export function applyScheduledPayments(db: D1Database, day: string) {
  // O gatilho aplica a baixa e o saldo anterior no mesmo comando, inclusive
  // quando duas telas fazem a primeira consulta da data ao mesmo tempo.
  return db
    .prepare(
      'UPDATE scheduled_statement_payments SET applied=1 WHERE applied=0 AND payment_date<=?',
    )
    .bind(day)
    .run();
}
