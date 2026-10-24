'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback, useId } from 'react';
import {
  WEEKDAYS,
  MONTHS,
  isMonthDisabled,
  validateDateInput,
  normalizeDateInput,
  isIncompleteDateInput,
  getTodayString,
  getTodayMonthString,
  parseDateParts,
  computePopoverPlacement,
  buildCalendarDays,
} from './custom-date-picker-utils';

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
  const reactId = useId();
  const inputId = id || `date-picker-${reactId}`;
  const errorId = `${inputId}-error`;

  const [rawOpen, setRawOpen] = useState(false);
  const [prevDisabled, setPrevDisabled] = useState(disabled);
  if (prevDisabled !== disabled) {
    setPrevDisabled(disabled);
    if (disabled && rawOpen) {
      setRawOpen(false);
    }
  }
  const isOpen = rawOpen && !disabled;

  const [prevValue, setPrevValue] = useState(value);
  const [inputValue, setInputValue] = useState(value || '');
  const [validationMsg, setValidationMsg] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const todayStr = useMemo(() => getTodayString(), []);
  const todayMonthStr = useMemo(() => getTodayMonthString(), []);

  const parsedValue = useMemo(() => parseDateParts(value), [value]);

  const defaultYear = parsedValue ? parsedValue.year : parseInt(todayStr.slice(0, 4), 10);
  const defaultMonth = parsedValue ? parsedValue.month : parseInt(todayStr.slice(5, 7), 10);

  const [viewYear, setViewYear] = useState<number>(defaultYear);
  const [viewMonth, setViewMonth] = useState<number>(defaultMonth);
  const [placement, setPlacement] = useState<{
    openUpward: boolean;
    alignRight: boolean;
    horizontalOffset: number;
  }>({
    openUpward: false,
    alignRight: false,
    horizontalOffset: 0,
  });

  // Render-time state adjustment when prop value changes
  if (prevValue !== value) {
    setPrevValue(value);
    setInputValue(value || '');
    if (!value) {
      setValidationMsg('');
    } else {
      const res = validateDateInput(value, { type, required, min, max });
      setValidationMsg(res.valid ? '' : res.error);
    }
  }

  // Keep HTML5 form custom validity in sync with DOM without cascading state
  useEffect(() => {
    if (!inputRef.current) return;
    const trimmed = inputValue.trim();
    if (!trimmed) {
      inputRef.current.setCustomValidity(required ? '请填写此字段' : '');
    } else {
      const res = validateDateInput(trimmed, { type, required, min, max });
      inputRef.current.setCustomValidity(res.valid ? '' : res.error);
    }
  }, [inputValue, required, type, min, max]);

  // Sync viewing year/month to active date
  const syncViewDate = useCallback((targetValue?: string) => {
    const parts =
      parseDateParts(targetValue) ||
      parseDateParts(inputValue) ||
      parseDateParts(value) ||
      parseDateParts(todayStr);
    if (parts) {
      setViewYear(parts.year);
      setViewMonth(parts.month);
    }
  }, [inputValue, value, todayStr]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setRawOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Viewport collision detection
  const checkPosition = useCallback(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth || document.documentElement.clientWidth || 360,
      height: window.innerHeight || document.documentElement.clientHeight || 640,
    };
    const measuredWidth = popoverRef.current ? popoverRef.current.getBoundingClientRect().width : undefined;
    const computed = computePopoverPlacement(rect, viewport, type, measuredWidth);
    setPlacement(computed);
  }, [type]);

  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => checkPosition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, checkPosition]);

  // Focus management: when popover opens, focus selected -> today -> first selectable
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (!popoverRef.current) return;
      checkPosition();
      const targetBtn =
        popoverRef.current.querySelector<HTMLButtonElement>('.is-selected:not(:disabled)') ||
        popoverRef.current.querySelector<HTMLButtonElement>('.is-today:not(:disabled)') ||
        (type === 'date'
          ? popoverRef.current.querySelector<HTMLButtonElement>('.custom-date-cell:not(.is-outside):not(:disabled)')
          : popoverRef.current.querySelector<HTMLButtonElement>('.custom-month-cell:not(:disabled)')) ||
        popoverRef.current.querySelector<HTMLButtonElement>('.custom-date-cell:not(:disabled), .custom-month-cell:not(:disabled)');

      targetBtn?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, type, checkPosition]);

  const openCalendar = () => {
    if (disabled) return;
    syncViewDate();
    checkPosition();
    setRawOpen(true);
  };

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      openCalendar();
    } else {
      setRawOpen(false);
    }
  };

  const emitCommittedValue = (nextVal: string) => {
    const res = validateDateInput(nextVal, { type, required, min, max });
    if (!res.valid) {
      setValidationMsg(res.error);
      return;
    }
    setInputValue(nextVal);
    setValidationMsg('');
    if (nextVal !== value) {
      onChange?.({
        target: { value: nextVal },
        currentTarget: { value: nextVal },
      });
      onValueChange?.(nextVal);
    }
    syncViewDate(nextVal);
    setRawOpen(false);
    inputRef.current?.focus();
  };

  const commitInput = (rawText: string) => {
    const normalized = normalizeDateInput(rawText, type);
    if (!normalized) {
      if (required) {
        setValidationMsg('请填写此字段');
      } else {
        setValidationMsg('');
        if (value !== '') {
          onChange?.({
            target: { value: '' },
            currentTarget: { value: '' },
          });
          onValueChange?.('');
        }
      }
      return;
    }

    const res = validateDateInput(normalized, { type, required, min, max });
    if (res.valid) {
      setValidationMsg('');
      if (normalized !== rawText) {
        setInputValue(normalized);
      }
      if (normalized !== value) {
        onChange?.({
          target: { value: normalized },
          currentTarget: { value: normalized },
        });
        onValueChange?.(normalized);
      }
      syncViewDate(normalized);
    } else {
      setValidationMsg(res.error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    const normalized = normalizeDateInput(raw, type);

    // Synchronously set custom validity immediately on DOM input for incomplete values
    if (isIncompleteDateInput(normalized, type)) {
      if (validationMsg) {
        setValidationMsg('');
      }
      const err = type === 'month' ? '请输入完整的月份 (YYYY-MM)' : '请输入完整的日期 (YYYY-MM-DD)';
      inputRef.current?.setCustomValidity(err);
      return;
    }

    const res = validateDateInput(normalized, { type, required, min, max });
    if (res.valid) {
      setValidationMsg('');
      if (normalized !== raw) {
        setInputValue(normalized);
      }
      if (normalized !== value) {
        onChange?.({
          target: { value: normalized },
          currentTarget: { value: normalized },
        });
        onValueChange?.(normalized);
      }
      syncViewDate(normalized);
    } else {
      setValidationMsg(res.error);
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (containerRef.current && containerRef.current.contains(e.relatedTarget as Node)) {
      return;
    }
    commitInput(inputValue);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitInput(inputValue);
      const res = validateDateInput(inputValue, { type, required, min, max });
      if (res.valid) {
        setRawOpen(false);
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setRawOpen(false);
      }
    } else if (e.key === 'ArrowDown') {
      if (!isOpen && !disabled) {
        e.preventDefault();
        openCalendar();
      }
    }
  };

  const handlePopoverKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setRawOpen(false);
      inputRef.current?.focus();
    }
  };

  // Range validation helpers
  const isDateDisabled = (dateStr: string) => {
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
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
    return buildCalendarDays({
      viewYear,
      viewMonth,
      value,
      min,
      max,
      todayStr,
    });
  }, [type, viewYear, viewMonth, value, min, max, todayStr]);

  return (
    <div
      ref={containerRef}
      className={`custom-date-picker-container ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${validationMsg ? 'is-invalid' : ''} ${className}`}
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', width: '100%', maxWidth: '100%', ...style }}
    >
      <div className="custom-date-trigger-wrap" style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          id={inputId}
          name={name}
          title={title}
          value={inputValue}
          disabled={disabled}
          required={required}
          aria-label={effectiveAriaLabel}
          aria-invalid={Boolean(validationMsg)}
          aria-describedby={validationMsg ? errorId : undefined}
          placeholder={placeholder || (type === 'month' ? '选择月份' : '选择日期')}
          className={`custom-date-input-field ${validationMsg ? 'is-invalid' : ''}`}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          onInvalid={(e) => {
            e.preventDefault();
            const res = validateDateInput(inputValue, { type, required, min, max });
            setValidationMsg(res.error || (required ? '请填写此字段' : '请输入有效日期'));
            inputRef.current?.focus();
          }}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={type === 'month' ? '选择月份' : '选择日期'}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
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

      {validationMsg && (
        <span
          id={errorId}
          role="alert"
          className="custom-date-error-text"
          style={{
            position: 'absolute',
            bottom: '-16px',
            left: 0,
            fontSize: 12,
            color: '#ce2c31',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {validationMsg}
        </span>
      )}

      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="日历选择面板"
          className={`custom-date-popover ${placement.openUpward ? 'popover-upward' : 'popover-downward'}`}
          onKeyDown={handlePopoverKeyDown}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            zIndex: 1000,
            maxWidth: 'calc(100vw - 16px)',
            boxSizing: 'border-box',
            ...(placement.openUpward ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
            ...(placement.alignRight
              ? { right: 0, left: 'auto' }
              : {
                  left: placement.horizontalOffset !== 0 ? `${placement.horizontalOffset}px` : 0,
                  right: 'auto',
                }),
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
                    aria-pressed={cell.isSelected}
                    aria-current={cell.isToday ? 'date' : undefined}
                    onClick={() => !cell.isDisabled && emitCommittedValue(cell.dateStr)}
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
                  onClick={() => emitCommittedValue(todayStr)}
                >
                  今天
                </button>
                {max && (
                  <button
                    type="button"
                    className="custom-date-quick-btn"
                    disabled={isDateDisabled(max)}
                    onClick={() => emitCommittedValue(max)}
                  >
                    最新日期
                  </button>
                )}
                <button
                  type="button"
                  className="custom-date-quick-btn clear-btn"
                  onClick={() => emitCommittedValue('')}
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
                  const mStr = `${viewYear}-${mNum < 10 ? `0${mNum}` : mNum}`;
                  const isSelected = value === mStr;
                  const isCurrent = todayMonthStr === mStr;
                  const disabledMonth = isMonthDisabled(viewYear, mNum, min, max);

                  return (
                    <button
                      key={mStr}
                      type="button"
                      disabled={disabledMonth}
                      aria-label={`${viewYear}年${mLabel}`}
                      aria-pressed={isSelected}
                      aria-current={isCurrent ? 'date' : undefined}
                      onClick={() => !disabledMonth && emitCommittedValue(mStr)}
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
                    parseInt(todayMonthStr.slice(5, 7), 10),
                    min,
                    max
                  )}
                  onClick={() => emitCommittedValue(todayMonthStr)}
                >
                  本月
                </button>
                <button
                  type="button"
                  className="custom-date-quick-btn clear-btn"
                  onClick={() => emitCommittedValue('')}
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
