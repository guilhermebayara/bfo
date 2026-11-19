function monthDay(month: string, offset: number, day: number) {
  const [year, number] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, number + offset, 0)).getUTCDate();
  return new Date(Date.UTC(year, number + offset - 1, Math.min(day, last)))
    .toISOString()
    .slice(0, 10);
}

export function statementCycle(
  day: string,
  closingDay: number,
  dueDay: number,
  installment = 0,
) {
  const month = day.slice(0, 7);
  const offset = Number(day > monthDay(month, 0, closingDay)) + installment;
  const previousClose = monthDay(month, offset - 1, closingDay);
  const periodStart = new Date(Date.parse(previousClose) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  const closingDate = monthDay(month, offset, closingDay);
  const sameMonthDue = monthDay(month, offset, dueDay);
  const projected = monthDay(month, installment, Number(day.slice(8)));
  return {
    periodStart,
    closingDate,
    dueDate:
      sameMonthDue > closingDate
        ? sameMonthDue
        : monthDay(month, offset + 1, dueDay),
    date: installment ? [periodStart, projected, closingDate].sort()[1] : day,
  };
}

export function installmentAmount(total: number, count: number, index: number) {
  return Math.floor(total / count) + (index === count - 1 ? total % count : 0);
}
