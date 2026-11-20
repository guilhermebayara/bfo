import type { TransactionNotice } from '../shared/transaction-notice';
export const transactionActions = new EventTarget();
const transactionSession = crypto.randomUUID();
let pendingWrite = Promise.resolve();
let writes = 0;
export const transactionWritePending = () => writes > 0;

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const write = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(
    options.method ?? '',
  );
  async function send() {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (write) {
      headers.set('X-BFO-Sessao', transactionSession);
      headers.set('X-BFO-Avisos', '1');
    }
    const response = await fetch(`/api${path}`, { ...options, headers });
    const body = (await response.json()) as T & {
      error?: string;
      transaction_notice?: TransactionNotice;
    };
    if (!response.ok)
      throw new Error(body.error ?? 'Não foi possível carregar os dados.');
    const actionId = response.headers.get('X-BFO-Acao');
    if (actionId) {
      if (path.startsWith('/transaction-actions/'))
        return { ...body, action_id: actionId };
      transactionActions.dispatchEvent(
        new CustomEvent('save', {
          detail: { id: actionId, notice: body.transaction_notice },
        }),
      );
    }
    return body;
  }
  if (!write) return send();
  writes++;
  const result = pendingWrite.then(send).finally(() => {
    writes--;
  });
  pendingWrite = result.then(
    () => {},
    () => {},
  );
  return result;
}
export const humanDate = (date: string) => date.split('-').reverse().join('/');
