'use client';

import { useState, useRef, useEffect, useId } from 'react';

export type SelectOption = {
  value: string;
  label: string;
  color?: string;
  badge?: string;
};

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  ariaLabel,
  className = '',
  style,
}: {
  value: string;
  onChange: (val: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  const normalizedOptions: SelectOption[] = options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find(o => o.value === value);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('pointerdown', handleOutsideClick);
    }
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [open]);

  return (
    <div
      ref={ref}
      className={`custom-select-container ${className} ${open ? 'is-open' : ''}`}
      style={{ position: 'relative', display: 'inline-block', ...style }}
    >
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
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
          className="custom-select-dropdown animate-scale-in"
          role="listbox"
          aria-labelledby={id}
        >
          {normalizedOptions.map(opt => {
            const isSelected = opt.value === value;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`custom-select-option ${isSelected ? 'is-selected' : ''}`}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {opt.color && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color, display: 'inline-block' }} />
                  )}
                  {opt.label}
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
          })}
        </ul>
      )}
    </div>
  );
}
