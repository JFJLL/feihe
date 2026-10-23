'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

export interface CustomDatePickerProps {
  value?: string;
  onChange?: (e: { target: { value: string }; currentTarget: { value: string } }) => void;
  onValueChange?: (val: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  ariaLabel?: string;
  'aria-label'?: string;
  className?: string;
  style?: React.CSSProperties;
  type?: 'date' | 'month';
  placeholder?: string;
  id?: string;
  name?: string;
  title?: string;
  required?: boolean;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function padZero(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function getTodayString(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
  }
}

export function CustomDatePicker(props: CustomDatePickerProps) {
  const {
    value = '',
    onChange,
    onValueChange,
    min,
    max,
    disabled = false,
    ariaLabel,
    'aria-label': ariaLabelProp,
    className = '',
    style,
    type = 'date',
    placeholder,
    id,
    name,
    title,
    required = false,
  } = props;

  const effectiveAriaLabel = ariaLabel || ariaLabelProp;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const todayStr = useMemo(() => getTodayString(), []);
  const todayMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // View year and month state for calendar navigation
  const parsedValue = useMemo(() => {
    if (!value) return null;
    const parts = value.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parts[2] ? parseInt(parts[2], 10) : 1;
    if (isNaN(y) || isNaN(m)) return null;
    return { year: y, month: m, day: d };
  }, [value]);

  const defaultYear = parsedValue ? parsedValue.year : parseInt(todayStr.slice(0, 4), 10);
  const defaultMonth = parsedValue ? parsedValue.month : parseInt(todayStr.slice(5, 7), 10);

  const [viewYear, setViewYear] = useState<number>(defaultYear);
  const [viewMonth, setViewMonth] = useState<number>(defaultMonth);
  const [openUpward, setOpenUpward] = useState(false);

  // Sync viewing year/month when value changes and popover opens
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month);
    }
  }, [parsedValue, open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  // Detect available space below to flip upward if near viewport bottom
  const checkPosition = useCallback(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const popoverHeight = type === 'month' ? 220 : 320;
    setOpenUpward(spaceBelow < popoverHeight && rect.top > popoverHeight);
  }, [type]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!open) {
      checkPosition();
    }
    setOpen((prev) => !prev);
  };

  const emitValue = (nextVal: string) => {
    if (nextVal !== value) {
      onChange?.({
        target: { value: nextVal },
        currentTarget: { value: nextVal },
      });
      onValueChange?.(nextVal);
    }
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    onChange?.(e);
    onValueChange?.(nextVal);
  };

  // Range validation helpers
  const isDateDisabled = (dateStr: string) => {
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    return false;
  };

  const isMonthDisabled = (year: number, month: number) => {
    const ym = `${year}-${padZero(month)}`;
    if (min && ym < min.slice(0, 7)) return true;
    if (max && ym > max.slice(0, 7)) return true;
    return false;
  };

  // Header navigation
  const prevYear = () => setViewYear((y) => y - 1);
  const nextYear = () => setViewYear((y) => y + 1);
  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Calendar grid construction
  const calendarDays = useMemo(() => {
    if (type !== 'date') return [];
    const firstDayOfWeek = (new Date(viewYear, viewMonth - 1, 1).getDay() + 6) % 7; // 0 = Mon, 6 = Sun
    const totalDaysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth - 1, 0).getDate();

    const cells: Array<{
      day: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isDisabled: boolean;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

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
  }, [type, viewYear, viewMonth, value, min, max, todayStr]);

  return (
    <div
      ref={containerRef}
      className={`custom-date-picker-container ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', width: '100%', maxWidth: '100%', ...style }}
    >
      <div className="custom-date-trigger-wrap" style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type={type}
          id={id}
          name={name}
          title={title}
          value={value || ''}
          min={min}
          max={max}
          disabled={disabled}
          required={required}
          aria-label={effectiveAriaLabel}
          aria-expanded={open}
          placeholder={placeholder || (type === 'month' ? '选择月份' : '选择日期')}
          className="custom-date-input-field"
          onChange={handleNativeChange}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) {
              checkPosition();
              setOpen(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleOpen();
            } else if (e.key === 'Escape' && open) {
              e.preventDefault();
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          className="custom-date-icon-btn"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleOpen();
          }}
        >
          <svg className="custom-date-svg" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <rect x="2.5" y="4.5" width="15" height="13" rx="3" strokeWidth="1.5" />
            <path d="M2.5 8.5H17.5" strokeWidth="1.5" />
            <path d="M6.5 2.5V5.5" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M13.5 2.5V5.5" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="6.5" cy="11.5" r="1" fill="currentColor" />
            <circle cx="10" cy="11.5" r="1" fill="currentColor" />
            <circle cx="13.5" cy="11.5" r="1" fill="currentColor" />
            <circle cx="6.5" cy="14.5" r="1" fill="currentColor" />
            <circle cx="10" cy="14.5" r="1" fill="currentColor" />
          </svg>
        </button>
      </div>

      {open && !disabled && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="日历选择面板"
          className={`custom-date-popover ${openUpward ? 'popover-upward' : 'popover-downward'}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: 0,
            zIndex: 1000,
            ...(openUpward ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
          }}
        >
          {type === 'date' ? (
            <div className="custom-date-card">
              {/* Header: Year / Month Navigation */}
              <div className="custom-date-header">
                <button
                  type="button"
                  className="custom-date-nav-btn"
                  title="上一年"
                  aria-label="上一年"
                  onClick={prevYear}
                >
                  «
                </button>
                <button
                  type="button"
                  className="custom-date-nav-btn"
                  title="上一月"
                  aria-label="上一月"
                  onClick={prevMonth}
                >
                  ‹
                </button>
                <span className="custom-date-title">
                  {viewYear}年 {viewMonth}月
                </span>
                <button
                  type="button"
                  className="custom-date-nav-btn"
                  title="下一月"
                  aria-label="下一月"
                  onClick={nextMonth}
                >
                  ›
                </button>
                <button
                  type="button"
                  className="custom-date-nav-btn"
                  title="下一年"
                  aria-label="下一年"
                  onClick={nextYear}
                >
                  »
                </button>
              </div>

              {/* Weekdays */}
              <div className="custom-date-weekdays">
                {WEEKDAYS.map((wd) => (
                  <span key={wd} className="custom-date-weekday">
                    {wd}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="custom-date-grid">
                {calendarDays.map((cell, idx) => (
                  <button
                    key={`${cell.dateStr}-${idx}`}
                    type="button"
                    disabled={cell.isDisabled}
                    aria-label={cell.dateStr}
                    aria-selected={cell.isSelected}
                    onClick={() => !cell.isDisabled && emitValue(cell.dateStr)}
                    className={`custom-date-cell ${
                      !cell.isCurrentMonth ? 'is-outside' : ''
                    } ${cell.isSelected ? 'is-selected' : ''} ${
                      cell.isToday ? 'is-today' : ''
                    } ${cell.isDisabled ? 'is-disabled' : ''}`}
                  >
                    {cell.day}
                  </button>
                ))}
              </div>

              {/* Bottom Quick Bar */}
              <div className="custom-date-footer">
                <button
                  type="button"
                  className="custom-date-quick-btn"
                  disabled={isDateDisabled(todayStr)}
                  onClick={() => emitValue(todayStr)}
                >
                  今天
                </button>
                {max && (
                  <button
                    type="button"
                    className="custom-date-quick-btn"
                    disabled={isDateDisabled(max)}
                    onClick={() => emitValue(max)}
                  >
                    最新日期
                  </button>
                )}
                <button
                  type="button"
                  className="custom-date-quick-btn clear-btn"
                  onClick={() => emitValue('')}
                >
                  清空
                </button>
              </div>
            </div>
          ) : (
            /* Month Picker */
            <div className="custom-date-card month-mode">
              <div className="custom-date-header">
                <button
                  type="button"
                  className="custom-date-nav-btn"
                  title="上一年"
                  aria-label="上一年"
                  onClick={prevYear}
                >
                  «
                </button>
                <span className="custom-date-title">{viewYear}年</span>
                <button
                  type="button"
                  className="custom-date-nav-btn"
                  title="下一年"
                  aria-label="下一年"
                  onClick={nextYear}
                >
                  »
                </button>
              </div>

              <div className="custom-month-grid">
                {MONTHS.map((mLabel, idx) => {
                  const mNum = idx + 1;
                  const mStr = `${viewYear}-${padZero(mNum)}`;
                  const isSelected = value === mStr;
                  const isCurrent = todayMonthStr === mStr;
                  const disabledMonth = isMonthDisabled(viewYear, mNum);

                  return (
                    <button
                      key={mStr}
                      type="button"
                      disabled={disabledMonth}
                      aria-label={`${viewYear}年${mLabel}`}
                      aria-selected={isSelected}
                      onClick={() => !disabledMonth && emitValue(mStr)}
                      className={`custom-month-cell ${isSelected ? 'is-selected' : ''} ${
                        isCurrent ? 'is-today' : ''
                      } ${disabledMonth ? 'is-disabled' : ''}`}
                    >
                      {mLabel}
                    </button>
                  );
                })}
              </div>

              <div className="custom-date-footer">
                <button
                  type="button"
                  className="custom-date-quick-btn"
                  disabled={isMonthDisabled(
                    parseInt(todayMonthStr.slice(0, 4), 10),
                    parseInt(todayMonthStr.slice(5, 7), 10)
                  )}
                  onClick={() => emitValue(todayMonthStr)}
                >
                  本月
                </button>
                <button
                  type="button"
                  className="custom-date-quick-btn clear-btn"
                  onClick={() => emitValue('')}
                >
                  清空
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CustomDatePicker;
