export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] as const;
export const MONTHS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
] as const;

export function padZero(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function isLeapYear(year: number): boolean {
  if (year % 4 !== 0) return false;
  if (year % 100 !== 0) return true;
  return year % 400 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

export function isMonthDisabled(year: number, month: number, min?: string, max?: string): boolean {
  const ym = `${year}-${padZero(month)}`;
  if (min && ym < min.slice(0, 7)) return true;
  if (max && ym > max.slice(0, 7)) return true;
  return false;
}

export function isValidIsoDate(str: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(str)) {
    return false;
  }
  const [year, month, day] = str.split('-').map(Number);
  if (year < 1000 || year > 9999) return false;
  const maxDays = getDaysInMonth(year, month);
  return day >= 1 && day <= maxDays;
}

export function isValidIsoMonth(str: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(str)) {
    return false;
  }
  const [year, month] = str.split('-').map(Number);
  return year >= 1000 && year <= 9999 && month >= 1 && month <= 12;
}

export function normalizeDateInput(raw: string, type: 'date' | 'month' = 'date'): string {
  const trimmed = raw.trim();
  if (type === 'date' && /^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  if (type === 'month' && /^\d{6}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}`;
  }
  return trimmed;
}

export function isIncompleteDateInput(val: string, type: 'date' | 'month' = 'date'): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  const targetLen = type === 'month' ? 7 : 10;
  return trimmed.length < targetLen;
}

export interface DateValidationResult {
  valid: boolean;
  error: string;
}

export function validateDateInput(
  val: string,
  options: {
    type?: 'date' | 'month';
    required?: boolean;
    min?: string;
    max?: string;
  } = {}
): DateValidationResult {
  const { type = 'date', required = false, min, max } = options;
  const trimmed = normalizeDateInput(val, type);

  if (!trimmed) {
    if (required) {
      return { valid: false, error: '请填写此字段' };
    }
    return { valid: true, error: '' };
  }

  if (isIncompleteDateInput(trimmed, type)) {
    return { valid: false, error: type === 'month' ? '请输入完整的月份 (YYYY-MM)' : '请输入完整的日期 (YYYY-MM-DD)' };
  }

  if (type === 'month') {
    if (!isValidIsoMonth(trimmed)) {
      return { valid: false, error: '请输入有效的月份格式 (YYYY-MM)' };
    }
    const minMonth = min ? min.slice(0, 7) : undefined;
    if (minMonth && trimmed < minMonth) {
      return { valid: false, error: `月份不能早于 ${minMonth}` };
    }
    const maxMonth = max ? max.slice(0, 7) : undefined;
    if (maxMonth && trimmed > maxMonth) {
      return { valid: false, error: `月份不能晚于 ${maxMonth}` };
    }
    return { valid: true, error: '' };
  }

  if (!isValidIsoDate(trimmed)) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 1 && m <= 12) {
        const daysInMonth = getDaysInMonth(y, m);
        if (m === 2 && d === 29 && !isLeapYear(y)) {
          return { valid: false, error: `${y}年不是闰年，2月只有28天` };
        }
        if (d > daysInMonth) {
          return { valid: false, error: `${y}年${m}月只有${daysInMonth}天` };
        }
      }
    }
    return { valid: false, error: '请输入有效的日期格式 (YYYY-MM-DD)' };
  }

  if (min && trimmed < min) {
    return { valid: false, error: `日期不能早于 ${min}` };
  }
  if (max && trimmed > max) {
    return { valid: false, error: `日期不能晚于 ${max}` };
  }

  return { valid: true, error: '' };
}

export function getTodayString(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
  }
}

export function getTodayMonthString(): string {
  return getTodayString().slice(0, 7);
}

export function parseDateParts(value?: string): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const parts = value.trim().split('-');
  if (parts.length < 2 || parts.length > 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parts[2] ? parseInt(parts[2], 10) : 1;
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  if (y < 1000 || y > 9999 || m < 1 || m > 12) return null;
  const maxDays = getDaysInMonth(y, m);
  if (d < 1 || d > maxDays) return null;
  return { year: y, month: m, day: d };
}

export interface PopoverPlacement {
  openUpward: boolean;
  alignRight: boolean;
  horizontalOffset: number;
}

export function computePopoverPlacement(
  containerRect: { left: number; right: number; top: number; bottom: number },
  viewport: { width: number; height: number },
  type: 'date' | 'month' = 'date',
  measuredPopoverWidth?: number
): PopoverPlacement {
  const defaultWidth = type === 'month' ? 240 : 280;
  const popoverWidth = measuredPopoverWidth && measuredPopoverWidth > 0 ? measuredPopoverWidth : defaultWidth;
  const popoverHeight = type === 'month' ? 220 : 320;
  const spaceBelow = viewport.height - containerRect.bottom;
  const openUpward = spaceBelow < popoverHeight && containerRect.top > popoverHeight;

  let alignRight = false;
  let horizontalOffset = 0;

  // Horizontal collision with right edge of viewport
  if (containerRect.left + popoverWidth > viewport.width - 8) {
    if (containerRect.right - popoverWidth >= 8) {
      alignRight = true;
      horizontalOffset = 0;
    } else {
      // Narrow screen: clamp so popover right does not exceed viewport.width - 8
      const maxAllowedLeftOffset = (viewport.width - 8) - containerRect.left - popoverWidth;
      const minAllowedLeftOffset = 8 - containerRect.left;
      horizontalOffset = Math.min(0, Math.max(minAllowedLeftOffset, maxAllowedLeftOffset));
      alignRight = false;
    }
  }

  return { openUpward, alignRight, horizontalOffset };
}

export interface CalendarCell {
  day: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isDisabled: boolean;
  isSelected: boolean;
  isToday: boolean;
}

export function buildCalendarDays(options: {
  viewYear: number;
  viewMonth: number;
  value?: string;
  min?: string;
  max?: string;
  todayStr: string;
}): CalendarCell[] {
  const { viewYear, viewMonth, value, min, max, todayStr } = options;
  const firstDayOfWeek = (new Date(viewYear, viewMonth - 1, 1).getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  const totalDaysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth - 1, 0).getDate();

  const isDateDisabled = (dateStr: string) => {
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    return false;
  };

  const cells: CalendarCell[] = [];

  // Preceding days from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevY = viewMonth === 1 ? viewYear - 1 : viewYear;
    const prevM = viewMonth === 1 ? 12 : viewMonth - 1;
    const dStr = `${prevY}-${padZero(prevM)}-${padZero(d)}`;
    cells.push({
      day: d,
      dateStr: dStr,
      isCurrentMonth: false,
      isDisabled: isDateDisabled(dStr),
      isSelected: value === dStr,
      isToday: todayStr === dStr,
    });
  }

  // Days in current month
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dStr = `${viewYear}-${padZero(viewMonth)}-${padZero(d)}`;
    cells.push({
      day: d,
      dateStr: dStr,
      isCurrentMonth: true,
      isDisabled: isDateDisabled(dStr),
      isSelected: value === dStr,
      isToday: todayStr === dStr,
    });
  }

  // Trailing days to fill the grid (multiple of 7)
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    const nextY = viewMonth === 12 ? viewYear + 1 : viewYear;
    const nextM = viewMonth === 12 ? 1 : viewMonth + 1;
    for (let d = 1; d <= remaining; d++) {
      const dStr = `${nextY}-${padZero(nextM)}-${padZero(d)}`;
      cells.push({
        day: d,
        dateStr: dStr,
        isCurrentMonth: false,
        isDisabled: isDateDisabled(dStr),
        isSelected: value === dStr,
        isToday: todayStr === dStr,
      });
    }
  }

  return cells;
}
