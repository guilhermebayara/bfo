import { currentMonth, shiftMonth, validMonth } from '../../shared/recurring';
import { Button } from './index';
export function MonthNavigation({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <section className="filters" aria-label="Navegação por mês">
      <Button
        disabled={month === '1900-01'}
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        Mês anterior
      </Button>
      <strong>
        {new Intl.DateTimeFormat('pt-BR', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${month}-01T12:00:00Z`))}
      </strong>
      <Button
        disabled={month === '9998-12'}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        Próximo mês
      </Button>
      <label>
        Ir para o mês
        <input
          type="month"
          min="1900-01"
          max="9998-12"
          value={month}
          onChange={(e) => {
            if (validMonth(e.target.value)) onChange(e.target.value);
          }}
        />
      </label>
      <Button onClick={() => onChange(currentMonth())}>
        Voltar para este mês
      </Button>
    </section>
  );
}
