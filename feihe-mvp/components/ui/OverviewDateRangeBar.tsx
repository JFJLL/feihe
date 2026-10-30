'use client';

import React, { useCallback, useId } from 'react';
import { CustomDatePicker } from './CustomDatePicker';
import { isValidIsoDate } from './custom-date-picker-utils';
import './OverviewDateRangeBar.css';

export interface OverviewDateRangeBarProps {
  from: string;
  to: string;
  minDate?: string;
  maxDate?: string;
  onChange: (from: string, to: string) => void;
  className?: string;
  disabled?: boolean;
  totalValidDays?: number;
}

export function shiftIsoDays(iso: string, days: number): string | null {
  if (!isValidIsoDate(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  const nextY = date.getUTCFullYear();
  if (nextY < 1000 || nextY > 9999) return null;
  const yStr = String(nextY).padStart(4, '0');
  const nextM = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextD = String(date.getUTCDate()).padStart(2, '0');
  return `${yStr}-${nextM}-${nextD}`;
}

export function OverviewDateRangeBar({
  from,
  to,
  minDate,
  maxDate,
  onChange,
  className = '',
  disabled = false,
  totalValidDays,
}: OverviewDateRangeBarProps) {
  const reactId = useId();
  const fromId = `ca-overview-from-${reactId}`;
  const toId = `ca-overview-to-${reactId}`;

  const isFullPeriod = Boolean(minDate && maxDate && from === minDate && to === maxDate);
  const effectiveAnchorTo = to && isValidIsoDate(to) ? to : (maxDate || '');
  const expected7dFrom = effectiveAnchorTo ? shiftIsoDays(effectiveAnchorTo, -6) : null;
  const clamped7dFrom = expected7dFrom && minDate && expected7dFrom < minDate ? minDate : expected7dFrom;
  const is7d = Boolean(!isFullPeriod && effectiveAnchorTo && from === clamped7dFrom && to === effectiveAnchorTo);

  const expectedMonthFrom = effectiveAnchorTo ? effectiveAnchorTo.slice(0, 7) + '-01' : null;
  const clampedMonthFrom = expectedMonthFrom && minDate && expectedMonthFrom < minDate ? minDate : expectedMonthFrom;
  const isMonth = Boolean(!isFullPeriod && !is7d && effectiveAnchorTo && from === clampedMonthFrom && to === effectiveAnchorTo);

  const handleQuickSelect = useCallback((kind: '7d' | 'month' | 'all') => {
    if (disabled) return;
    const effectiveTo = to && isValidIsoDate(to) ? to : (maxDate || '');
    if (!effectiveTo) return;

    if (kind === 'all') {
      if (minDate && maxDate) {
        onChange(minDate, maxDate);
      }
      return;
    }

    if (kind === '7d') {
      const computedFrom = shiftIsoDays(effectiveTo, -6);
      if (computedFrom) {
        const clampedFrom = minDate && computedFrom < minDate ? minDate : computedFrom;
        onChange(clampedFrom, effectiveTo);
      }
      return;
    }

    if (kind === 'month') {
      const monthStart = effectiveTo.slice(0, 7) + '-01';
      const clampedFrom = minDate && monthStart < minDate ? minDate : monthStart;
      onChange(clampedFrom, effectiveTo);
    }
  }, [disabled, to, maxDate, minDate, onChange]);

  const handleFromChange = useCallback((e: { target: { value: string } }) => {
    const val = e.target.value;
    if (!val) {
      onChange('', to);
      return;
    }
    let nextTo = to;
    if (to && isValidIsoDate(to) && val > to) {
      nextTo = val;
    }
    onChange(val, nextTo);
  }, [to, onChange]);

  const handleToChange = useCallback((e: { target: { value: string } }) => {
    const val = e.target.value;
    if (!val) {
      onChange(from, '');
      return;
    }
    let nextFrom = from;
    if (from && isValidIsoDate(from) && val < from) {
      nextFrom = val;
    }
    onChange(nextFrom, val);
  }, [from, onChange]);

  return (
    <div
      className={`ca-overview-date-bar ${className}`}
      role="group"
      aria-label="总览数据时间区间选择器"
    >
      <div className="ca-overview-quick-pills" role="group" aria-label="快捷区间">
        <button
          type="button"
          className={`ca-overview-quick-btn ${is7d ? 'active' : ''}`}
          disabled={disabled}
          onClick={() => handleQuickSelect('7d')}
        >
          近7天
        </button>
        <button
          type="button"
          className={`ca-overview-quick-btn ${isMonth ? 'active' : ''}`}
          disabled={disabled}
          onClick={() => handleQuickSelect('month')}
        >
          本月
        </button>
        <button
          type="button"
          className={`ca-overview-quick-btn ${isFullPeriod ? 'active' : ''}`}
          disabled={disabled}
          onClick={() => handleQuickSelect('all')}
        >
          全周期
        </button>
      </div>

      <div className="ca-overview-pickers-wrap">
        <div className="ca-overview-picker-field">
          <label htmlFor={fromId} className="ca-overview-picker-label">从</label>
          <div className="ca-overview-custom-picker">
            <CustomDatePicker
              id={fromId}
              value={from}
              min={minDate}
              max={to && isValidIsoDate(to) ? to : maxDate}
              disabled={disabled}
              ariaLabel="选择统计开始日期"
              onChange={handleFromChange}
            />
          </div>
        </div>

        <div className="ca-overview-picker-field">
          <label htmlFor={toId} className="ca-overview-picker-label">至</label>
          <div className="ca-overview-custom-picker">
            <CustomDatePicker
              id={toId}
              value={to}
              min={from && isValidIsoDate(from) ? from : minDate}
              max={maxDate}
              disabled={disabled}
              ariaLabel="选择统计结束日期"
              onChange={handleToChange}
            />
          </div>
        </div>
      </div>

      {typeof totalValidDays === 'number' && totalValidDays > 0 && (
        <span className="ca-overview-days-badge" title={`所选区间包含 ${totalValidDays} 个有效数据日`}>
          {totalValidDays}天
        </span>
      )}
    </div>
  );
}

export default OverviewDateRangeBar;
