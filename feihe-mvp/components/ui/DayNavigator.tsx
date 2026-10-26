'use client';

import React, { useMemo, useId } from 'react';
import { CustomDatePicker } from './CustomDatePicker';
import './DayNavigator.css';

export interface DayNavigatorProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  latestDate?: string;
  ariaLabel?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export function isValidIsoDate(str?: string | null): boolean {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function stepIsoDate(iso: string, step: -1 | 1): string | null {
  if (!isValidIsoDate(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + step));
  const nextY = date.getUTCFullYear();
  if (nextY < 1000 || nextY > 9999) return null;
  const yStr = String(nextY).padStart(4, '0');
  const nextM = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextD = String(date.getUTCDate()).padStart(2, '0');
  return `${yStr}-${nextM}-${nextD}`;
}

export function DayNavigator({
  value,
  onChange,
  min,
  max,
  latestDate,
  ariaLabel,
  id,
  className = '',
  disabled = false,
}: DayNavigatorProps) {
  const generatedId = useId();
  const effectiveId = id || `day-navigator-${generatedId}`;
  const isValValid = isValidIsoDate(value);
  const validMin = isValidIsoDate(min) ? min : undefined;
  const validMax = isValidIsoDate(max) ? max : undefined;

  const canStepPrev = useMemo(() => {
    if (disabled || !isValValid) return false;
    const prev = stepIsoDate(value, -1);
    if (!prev) return false;
    if (validMin && (prev < validMin || value <= validMin)) return false;
    return true;
  }, [disabled, isValValid, value, validMin]);

  const canStepNext = useMemo(() => {
    if (disabled || !isValValid) return false;
    const next = stepIsoDate(value, 1);
    if (!next) return false;
    if (validMax && (next > validMax || value >= validMax)) return false;
    return true;
  }, [disabled, isValValid, value, validMax]);

  const handlePrev = () => {
    if (!canStepPrev) return;
    const prev = stepIsoDate(value, -1);
    if (prev) onChange(prev);
  };

  const handleNext = () => {
    if (!canStepNext) return;
    const next = stepIsoDate(value, 1);
    if (next) onChange(next);
  };

  const rawTarget = latestDate || max;
  const targetLatest = isValidIsoDate(rawTarget) ? rawTarget : null;
  const showLatestBtn = Boolean(
    targetLatest &&
      isValValid &&
      targetLatest !== value
  );

  return (
    <div className={`day-navigator-root ${className}`}>
      <div className="day-navigator-controls">
        <button
          type="button"
          className="day-nav-step-btn day-nav-prev-btn"
          onClick={handlePrev}
          disabled={!canStepPrev}
          aria-label="前一日"
          title={canStepPrev ? '切换至前一日' : '已到达最早可选日期'}
        >
          <svg
            className="day-nav-chevron"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10 12L6 8l4-4" />
          </svg>
          <span>前一日</span>
        </button>

        <CustomDatePicker
          id={effectiveId}
          ariaLabel={ariaLabel || '选择业务日期'}
          title="选择或输入业务日期"
          placeholder="选择或输入日期"
          value={value}
          min={validMin}
          max={validMax}
          disabled={disabled}
          className="day-nav-custom-picker"
          onValueChange={onChange}
        />

        <button
          type="button"
          className="day-nav-step-btn day-nav-next-btn"
          onClick={handleNext}
          disabled={!canStepNext}
          aria-label="后一日"
          title={canStepNext ? '切换至后一日' : '已到达最晚可选日期'}
        >
          <span>后一日</span>
          <svg
            className="day-nav-chevron"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>
      </div>

      {showLatestBtn && (
        <button
          type="button"
          className="day-nav-latest-btn"
          onClick={() => onChange(targetLatest!)}
          disabled={disabled}
          title={`切换至最新数据日 (${targetLatest})`}
          aria-label={`切换至最新数据日 ${targetLatest}`}
        >
          最新数据日
        </button>
      )}
    </div>
  );
}

export default DayNavigator;
