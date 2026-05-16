export function todayISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function monthStartISO(date = new Date()) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return todayISO(firstDay);
}

export function monthEndISO(date = new Date()) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return todayISO(lastDay);
}

export function currentMonthLabel(date = new Date()) {
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;
}

export function currentDateLabel(date = new Date()) {
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
}

export function currentWeekdayLabel(date = new Date()) {
  return `星期${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}`;
}

export function monthRange(date = new Date()) {
  return {
    start: monthStartISO(date),
    end: monthEndISO(date),
  };
}

export function addDaysISO(offset: number, date = new Date()) {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return todayISO(next);
}
