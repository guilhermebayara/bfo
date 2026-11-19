import type { Account } from '../../shared/types';
export function movementAccounts(accounts: Account[]) {
  return accounts.filter(
    (a) =>
      ['credit_card', 'checking', 'cash'].includes(a.kind) &&
      !a.closed_at &&
      !a.archived &&
      a.cutoff_date,
  );
}
export function AccountOptions({ accounts }: { accounts: Account[] }) {
  return (
    <>
      {(
        [
          ['credit_card', 'Cartões'],
          ['checking', 'Contas correntes'],
          ['cash', 'Dinheiro'],
        ] as const
      ).map(([kind, label]) => (
        <optgroup key={kind} label={label}>
          {movementAccounts(accounts)
            .filter((a) => a.kind === kind)
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
            .map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
                {a.institution_name ? ` · ${a.institution_name}` : ''}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}
