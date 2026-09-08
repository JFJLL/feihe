'use client';

import { useState, useRef, useEffect, useId, useMemo } from 'react';

export type SelectOption = {
  value: string;
  label: string;
  color?: string;
  badge?: string;
  disabled?: boolean;
};

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  ariaLabel,
  disabled = false,
  defaultOpen = false,
  className = '',
  style,
}: {
  value: string;
  onChange: (val: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  defaultOpen?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const listboxId = `custom-select-listbox-${baseId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const normalizedOptions: SelectOption[] = useMemo(() => {
    return options.map((opt) =>
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    );
  }, [options]);

  const selectedIndex = normalizedOptions.findIndex((o) => o.value === value);
  const selectedOption = selectedIndex >= 0 ? normalizedOptions[selectedIndex] : undefined;
  const [internalActiveIndex, setInternalActiveIndex] = useState<number>(-1);
  const [openUpward, setOpenUpward] = useState(false);

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
      const activeEl = listRef.current.children[activeIndex] as HTMLElement | undefined;
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [isActualOpen, activeIndex]);

  const checkUpward = () => {
    if (triggerRef.current && typeof window !== 'undefined') {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 250 && rect.top > 250);
    }
  };

  const selectOption = (opt: SelectOption) => {
    if (disabled || opt.disabled) return;
    if (opt.value !== value) {
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
        setInternalActiveIndex(() => {
          let next = activeIndex + delta;
          if (next < 0) next = normalizedOptions.length - 1;
          if (next >= normalizedOptions.length) next = 0;
          return next;
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
      setInternalActiveIndex(0);
      return;
    }

    if (e.key === 'End' && isActualOpen) {
      e.preventDefault();
      setInternalActiveIndex(normalizedOptions.length - 1);
      return;
    }

    if (e.key === 'Escape' && isActualOpen) {
      e.preventDefault();
      e.stopPropagation();
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
      <button
        ref={triggerRef}
        type="button"
        id={`${listboxId}-trigger`}
        aria-label={ariaLabel || placeholder}
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
          aria-labelledby={`${listboxId}-trigger`}
          tabIndex={-1}
          style={openUpward ? { top: 'auto', bottom: 'calc(100% + 5px)' } : undefined}
        >
          {normalizedOptions.length === 0 ? (
            <li className="custom-select-option" style={{ color: '#94a3b8', cursor: 'default' }}>
              无可选项目
            </li>
          ) : (
            normalizedOptions.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isActive = idx === activeIndex;
            return (
              <li
                key={opt.value}
                id={`${listboxId}-opt-${idx}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setInternalActiveIndex(idx)}
                className={`custom-select-option ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''} ${opt.disabled ? 'is-disabled' : ''}`}
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
            );
          })
          )}
        </ul>
      )}
    </div>
  );
}
