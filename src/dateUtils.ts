const WEEKDAY_COUNT = 7;

export type CalendarDay = {
  date: Date;
  key: string;
  day: number;
  isCurrentMonth: boolean;
};

export const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayKey = () => formatDateKey(new Date());

export const getMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getMonthLabel = (date: Date) =>
  new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
  }).format(date);

export const getDateLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
};

export const moveMonth = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

export const buildCalendarDays = (monthDate: Date): CalendarDay[] => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  const days: CalendarDay[] = [];
  const visibleWeeks = 6;
  const visibleDays = visibleWeeks * WEEKDAY_COUNT;

  for (let index = 0; index < visibleDays; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    days.push({
      date,
      key: formatDateKey(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
    });
  }

  return days;
};
