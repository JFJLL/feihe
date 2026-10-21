'use client';

import React, { useState, useRef, useEffect, useId, useMemo, Fragment } from 'react';
import './custom-select.css';

export type SelectOption = {
  value: string;
  label: string;
  color?: string;
  badge?: string;
  disabled?: boolean;
  group?: string;
};

export interface CustomSelectProps {
  value?: string | number;
  defaultValue?: string | number;
  onChange: (val: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  defaultOpen?: boolean;
  className?: string;
  style?: React.CSSProperties;
  name?: string;
  id?: string;
  required?: boolean;
  align?: 'left' | 'right';
}

export function CustomSelect({
  value,
  defaultValue,
  onChange,
  options,
  placeholder = '请选择',
  ariaLabel,
  disabled = false,
  defaultOpen = false,
  className = '',
  style,
  name,
  id,
  required = false,
  align,
}: CustomSelectProps) {
  const [open, setOpen] = useState(defaultOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const rawId = id || baseId.replace(/[^a-zA-Z0-9_-]/g, '');
  const listboxId = `custom-select-listbox-${rawId}`;
  const triggerId = id || `${listboxId}-trigger`;

  const stringValue = value !== undefined && value !== null ? String(value) : '';
  const initialDefault = defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : '';

  const normalizedOptions: SelectOption[] = useMemo(() => {
    return options.map((opt) =>
      typeof opt === 'string'
        ? { value: opt, label: opt }
        : { ...opt, value: String(opt.value) }
    );
  }, [options]);

  const selectedIndex = normalizedOptions.findIndex((o) => o.value === stringValue);
  const selectedOption = selectedIndex >= 0 ? normalizedOptions[selectedIndex] : undefined;
  const [internalActiveIndex, setInternalActiveIndex] = useState<number>(-1);
  const [openUpward, setOpenUpward] = useState(false);
  const [alignRight, setAlignRight] = useState(align === 'right');

  useEffect(() => {
    const input = hiddenInputRef.current;
    if (!input || !input.form) return;
    const form = input.form;
    const handleReset = () => {
      setTimeout(() => {
        onChange(initialDefault);
      }, 0);
    };
    form.addEventListener('reset', handleReset);
    return () => form.removeEventListener('reset', handleReset);
  }, [initialDefault, onChange]);

  const isActualOpen = open && !disabled;
  const activeIndex =
    normalizedOptions.length === 0
      ? -1
      : internalActiveIndex >= 0 && internalActiveIndex < normalizedOptions.length
      ? internalActiveIndex
      : selectedIndex >= 0
      ? selectedIndex
      : 0;

  useEffect(() => {
    if (!isActualOpen) return;
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isActualOpen]);

  useEffect(() => {
    if (isActualOpen && listRef.current && activeIndex >= 0) {
      const activeEl = listRef.current.querySelector(`#${listboxId}-opt-${activeIndex}`) as HTMLElement | null;
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [isActualOpen, activeIndex, listboxId]);

  const checkUpward = () => {
    if (triggerRef.current && typeof window !== 'undefined') {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelowViewport = window.innerHeight - rect.bottom;
      let spaceBelowParent = spaceBelowViewport;
      let parent = triggerRef.current.parentElement;
      while (parent && parent !== document.body) {
        const computed = window.getComputedStyle(parent);
        if (/(auto|scroll|hidden)/.test(computed.overflowY + computed.overflow)) {
          const parentRect = parent.getBoundingClientRect();
          spaceBelowParent = Math.min(spaceBelowParent, parentRect.bottom - rect.bottom);
          break;
        }
        parent = parent.parentElement;
      }
      const minSpace = 220;
      setOpenUpward((spaceBelowParent < minSpace || spaceBelowViewport < minSpace) && rect.top > minSpace);

      const spaceRight = window.innerWidth - rect.left;
      if (align === 'right' || spaceRight < 240) {
        setAlignRight(true);
      } else {
        setAlignRight(false);
      }
    }
  };

  const selectOption = (opt: SelectOption) => {
    if (disabled || opt.disabled) return;
    if (opt.value !== stringValue) {
      onChange(opt.value);
    }
    setOpen(false);
    setInternalActiveIndex(-1);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isActualOpen) {
        checkUpward();
        setOpen(true);
        setInternalActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      } else {
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        setInternalActiveIndex((curr) => {
          const base = curr >= 0 ? curr : (selectedIndex >= 0 ? selectedIndex : 0);
          for (let step = 1; step <= normalizedOptions.length; step++) {
            const target = (base + delta * step + normalizedOptions.length) % normalizedOptions.length;
            if (!normalizedOptions[target]?.disabled) {
              return target;
            }
          }
          return base;
        });
      }
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isActualOpen) {
        checkUpward();
        setOpen(true);
        setInternalActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      } else {
        const current = normalizedOptions[activeIndex];
        if (current) selectOption(current);
      }
      return;
    }

    if (e.key === 'Home' && isActualOpen) {
      e.preventDefault();
      const firstIdx = normalizedOptions.findIndex((o) => !o.disabled);
      if (firstIdx >= 0) setInternalActiveIndex(firstIdx);
      return;
    }

    if (e.key === 'End' && isActualOpen) {
      e.preventDefault();
      let lastIdx = -1;
      for (let i = normalizedOptions.length - 1; i >= 0; i--) {
        if (!normalizedOptions[i].disabled) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx >= 0) setInternalActiveIndex(lastIdx);
      return;
    }

    if (e.key === 'Escape' && isActualOpen) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent?.stopImmediatePropagation?.();
      setOpen(false);
      setInternalActiveIndex(-1);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === 'Tab' && isActualOpen) {
      setOpen(false);
      setInternalActiveIndex(-1);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${className} ${isActualOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
      style={{ position: 'relative', display: 'inline-block', ...style }}
    >
      <input
        ref={hiddenInputRef}
        type="text"
        name={name}
        value={stringValue}
        disabled={disabled}
        required={required}
        tabIndex={-1}
        aria-hidden="true"
        onChange={() => {}}
        onInvalid={(e) => {
          e.preventDefault();
          triggerRef.current?.focus();
        }}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          margin: -1,
          padding: 0,
          border: 0,
          clip: 'rect(0, 0, 0, 0)',
          overflow: 'hidden',
          pointerEvents: 'none',
          opacity: 0,
        }}
      />
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        aria-label={ariaLabel}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isActualOpen}
        aria-controls={isActualOpen ? listboxId : undefined}
        aria-activedescendant={isActualOpen && normalizedOptions.length > 0 && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            if (!isActualOpen) checkUpward();
            setOpen(!isActualOpen);
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className="custom-select-trigger"
      >
        <span className="custom-select-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {selectedOption?.color && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: selectedOption.color, display: 'inline-block' }} />
          )}
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`custom-select-chevron ${isActualOpen ? 'is-rotated' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isActualOpen && (
        <ul
          ref={listRef}
          id={listboxId}
          className="custom-select-dropdown animate-scale-in"
          role="listbox"
          aria-labelledby={triggerId}
          tabIndex={-1}
          style={{
            ...(openUpward ? { top: 'auto', bottom: 'calc(100% + 5px)' } : {}),
            ...(alignRight ? { left: 'auto', right: 0 } : { left: 0, right: 'auto' }),
          }}
        >
          {normalizedOptions.length === 0 ? (
            <li className="custom-select-option" style={{ color: '#94a3b8', cursor: 'default' }}>
              无可选项目
            </li>
          ) : (
            normalizedOptions.map((opt, idx) => {
            const isSelected = opt.value === stringValue;
            const isActive = idx === activeIndex;
            const prevOpt = idx > 0 ? normalizedOptions[idx - 1] : undefined;
            const showGroupHeader = opt.group && (!prevOpt || prevOpt.group !== opt.group);

            return (
              <Fragment key={`${opt.value}-${idx}`}>
                {showGroupHeader && (
                  <li className="custom-select-group-header" role="presentation">
                    {opt.group}
                  </li>
                )}
                <li
                  id={`${listboxId}-opt-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    selectOption(opt);
                  }}
                  onMouseEnter={() => {
                    if (!opt.disabled) setInternalActiveIndex(idx);
                  }}
                  className={`custom-select-option ${opt.group ? 'is-grouped' : ''} ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''} ${opt.disabled ? 'is-disabled' : ''}`}
                >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: opt.disabled ? 0.5 : 1 }}>
                  {opt.color && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color, display: 'inline-block' }} />
                  )}
                  {opt.label}
                  {opt.badge && (
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#f1f5f9', color: '#64748b' }}>
                      {opt.badge}
                    </span>
                  )}
                </span>
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                </li>
              </Fragment>
            );
          })
          )}
        </ul>
      )}
    </div>
  );
}
