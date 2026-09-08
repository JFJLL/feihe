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
  className = '',
  style,
}: {
  value: string;
  onChange: (val: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
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
  const [activeIndex, setActiveIndex] = useState<number>(() => Math.max(0, selectedIndex));

  useEffect(() => {
    if (open) {
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current && activeIndex >= 0) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement | undefined;
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeIndex]);

  const selectOption = (opt: SelectOption) => {
    if (opt.disabled) return;
    if (opt.value !== value) {
      onChange(opt.value);
    }
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      } else {
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((prev) => {
          let next = prev + delta;
          if (next < 0) next = normalizedOptions.length - 1;
          if (next >= normalizedOptions.length) next = 0;
          return next;
        });
      }
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        const current = normalizedOptions[activeIndex];
        if (current) selectOption(current);
      }
      return;
    }

    if (e.key === 'Home' && open) {
      e.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (e.key === 'End' && open) {
      e.preventDefault();
      setActiveIndex(normalizedOptions.length - 1);
      return;
    }

    if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === 'Tab' && open) {
      setOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${className} ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
      style={{ position: 'relative', display: 'inline-block', ...style }}
    >
      <button
        ref={triggerRef}
        type="button"
        id={`${listboxId}-trigger`}
        aria-label={ariaLabel || placeholder}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen(!open);
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
          className={`custom-select-chevron ${open ? 'is-rotated' : ''}`}
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

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          className="custom-select-dropdown animate-scale-in"
          role="listbox"
          aria-labelledby={`${listboxId}-trigger`}
          tabIndex={-1}
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
                onMouseEnter={() => setActiveIndex(idx)}
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
