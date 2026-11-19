export const RENEWAL_NOTICE_DAYS = 30;
export function currentMonth() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
}
export function validMonth(value: string) {
  return (
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
    Number(value.slice(0, 4)) >= 1900 &&
    Number(value.slice(0, 4)) <= 9998
  );
}
export function shiftMonth(month: string, offset: number) {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
}
export function monthBounds(month: string) {
  return {
    from: `${month}-01`,
    to: new Date(Date.parse(`${shiftMonth(month, 1)}-01T12:00:00Z`) - 86400000)
      .toISOString()
      .slice(0, 10),
  };
}
export type Schedule = {
  next_date: string;
  cadence: string;
  interval_days?: number | null;
};
function occurrence(r: Schedule, index: number) {
  const anchor = new Date(`${r.next_date}T12:00:00Z`);
  if (r.cadence === 'monthly' || r.cadence === 'yearly') {
    const d = new Date(anchor);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + index * (r.cadence === 'yearly' ? 12 : 1));
    const end = new Date(d);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
    d.setUTCDate(Math.min(anchor.getUTCDate(), end.getUTCDate()));
    return d.toISOString().slice(0, 10);
  }
  anchor.setUTCDate(
    anchor.getUTCDate() +
      index * (r.cadence === 'weekly' ? 7 : r.interval_days || 1),
  );
  return anchor.toISOString().slice(0, 10);
}
export function datesInMonth(r: Schedule, month: string) {
  const { from, to } = monthBounds(month);
  // next_date é a âncora inicial. Não se prevê antes dela.
  let index = Math.max(
    0,
    r.cadence === 'monthly' || r.cadence === 'yearly'
      ? Math.floor(
          ((Number(month.slice(0, 4)) - Number(r.next_date.slice(0, 4))) * 12 +
            Number(month.slice(5)) -
            Number(r.next_date.slice(5, 7))) /
            (r.cadence === 'yearly' ? 12 : 1),
        ) - 1
      : Math.floor(
          (Date.parse(from) - Date.parse(r.next_date)) /
            86400000 /
            (r.cadence === 'weekly' ? 7 : r.interval_days || 1),
        ) - 1,
  );
  const dates: string[] = [];
  for (let n = 0; n < 65; n++, index++) {
    const day = occurrence(r, index);
    if (day > to) break;
    if (day >= from) dates.push(day);
  }
  return dates;
}
export function nextOccurrence(r: Schedule, day: string) {
  let index = Math.max(
    0,
    r.cadence === 'monthly' || r.cadence === 'yearly'
      ? Math.floor(
          ((Number(day.slice(0, 4)) - Number(r.next_date.slice(0, 4))) * 12 +
            Number(day.slice(5, 7)) -
            Number(r.next_date.slice(5, 7))) /
            (r.cadence === 'yearly' ? 12 : 1),
        )
      : Math.floor(
          (Date.parse(day) - Date.parse(r.next_date)) /
            86400000 /
            (r.cadence === 'weekly' ? 7 : r.interval_days || 1),
        ),
  );
  if (occurrence(r, index) < day) index++;
  return occurrence(r, index);
}
export function monthlyEquivalent(
  amount: number,
  cadence: string,
  intervalDays?: number | null,
) {
  return Math.round(
    cadence === 'yearly'
      ? amount / 12
      : cadence === 'weekly'
        ? (amount * 52) / 12
        : cadence === 'custom'
          ? (amount * 365) / (12 * (intervalDays || 1))
          : amount,
  );
}
export function renewalSoon(
  renewal: string | null,
  day: string,
  noticeDays = RENEWAL_NOTICE_DAYS,
) {
  if (!renewal) return false;
  const days = (Date.parse(renewal) - Date.parse(day)) / 86400000;
  return days >= 0 && days <= noticeDays;
}
